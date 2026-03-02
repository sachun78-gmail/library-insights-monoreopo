import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DATA4LIBRARY_API_KEY = Deno.env.get("DATA4LIBRARY_API_KEY")!;
const API_BASE = "https://data4library.kr/api";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

/** 찜한 isbn13 기반으로 추천도서 1권을 가져옵니다 */
async function fetchRecommendation(isbn13: string): Promise<{
  isbn13: string;
  bookname: string;
  bookImageURL: string;
} | null> {
  const params = new URLSearchParams({
    authKey: DATA4LIBRARY_API_KEY,
    isbn13,
    format: "json",
  });

  try {
    const res = await fetch(`${API_BASE}/recommandList?${params}`);
    if (!res.ok) return null;
    const data = await res.json();

    const docs = data?.response?.docs ?? data?.response?.list ?? [];
    const first = docs[0]?.book ?? docs[0]?.doc ?? docs[0];
    if (!first?.isbn13) return null;

    return {
      isbn13: first.isbn13,
      bookname: first.bookname ?? "",
      bookImageURL: first.bookImageURL ?? "",
    };
  } catch {
    return null;
  }
}

/** Expo Push API로 알림 발송 - 결과 반환 */
async function sendPushMessages(
  messages: { to: string; title: string; body: string; data: Record<string, string> }[]
): Promise<any[]> {
  if (messages.length === 0) return [];

  const results = [];
  const chunkSize = 100;
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(chunk),
    });
    const result = await res.json();
    results.push(result);
  }
  return results;
}

Deno.serve(async (_req) => {
  try {
    // 1. 푸쉬 토큰이 있는 모든 user_id 조회
    const { data: tokenRows, error: tokenErr } = await supabase
      .from("push_tokens")
      .select("user_id, token");

    if (tokenErr) throw tokenErr;
    if (!tokenRows || tokenRows.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // user_id → tokens[] 매핑
    const userTokenMap = new Map<string, string[]>();
    for (const row of tokenRows) {
      const list = userTokenMap.get(row.user_id) ?? [];
      list.push(row.token);
      userTokenMap.set(row.user_id, list);
    }

    const userIds = Array.from(userTokenMap.keys());

    // 2. 각 유저의 찜 목록에서 isbn13 하나씩 가져오기
    const { data: bookmarks, error: bmErr } = await supabase
      .from("bookmarks")
      .select("user_id, isbn13, bookname")
      .in("user_id", userIds);

    if (bmErr) throw bmErr;
    if (!bookmarks || bookmarks.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // user_id → 전체 bookmark 목록 매핑
    const userBookmarksMap = new Map<string, { isbn13: string; bookname: string }[]>();
    for (const bm of bookmarks) {
      const list = userBookmarksMap.get(bm.user_id) ?? [];
      list.push({ isbn13: bm.isbn13, bookname: bm.bookname });
      userBookmarksMap.set(bm.user_id, list);
    }

    // 3. 각 유저별 추천도서 조회 후 알림 메시지 구성
    // 첫 번째 책이 추천 결과가 없으면 다음 책으로 시도
    const messages: { to: string; title: string; body: string; data: Record<string, string> }[] = [];

    for (const [userId, userBookmarks] of userBookmarksMap.entries()) {
      let recommendation = null;
      let sourceBook = null;

      for (const bookmark of userBookmarks) {
        recommendation = await fetchRecommendation(bookmark.isbn13);
        if (recommendation) {
          sourceBook = bookmark;
          break;
        }
      }

      if (!recommendation || !sourceBook) continue;

      const tokens = userTokenMap.get(userId) ?? [];
      for (const token of tokens) {
        messages.push({
          to: token,
          title: "📚 새 추천도서가 있어요!",
          body: `"${sourceBook.bookname}"을 좋아하신다면 "${recommendation.bookname}"도 좋아하실 거예요.`,
          data: {
            screen: "bookDetail",
            isbn13: recommendation.isbn13,
          },
        });
      }
    }

    // 4. 발송
    const pushResults = await sendPushMessages(messages);

    return new Response(JSON.stringify({ sent: messages.length }), { status: 200 });
  } catch (err) {
    console.error("[추천 알림] 오류:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
