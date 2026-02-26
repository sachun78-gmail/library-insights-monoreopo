import { supabase } from "./supabase";
import type {
  Book,
  Bookmark,
  UserProfile,
  BookReview,
  AIInsight,
  AISearchResult,
} from "./types";

const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4321";

const TIMEOUT_MS = 10_000;
const AI_TIMEOUT_MS = 40_000;
const DEBUG_API = typeof __DEV__ !== "undefined" && __DEV__;

type Params = Record<string, string | number | boolean | undefined | null>;
type ExtraHeaders = Record<string, string>;

/** 현재 Supabase 세션에서 Authorization 헤더를 가져옵니다.
 *  토큰이 만료된 경우 자동으로 갱신합니다. */
async function getAuthHeader(): Promise<ExtraHeaders> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error("Not authenticated");
  }
  return { Authorization: `Bearer ${session.access_token}` };
}

async function get(
  path: string,
  params: Params = {},
  timeoutMs = TIMEOUT_MS,
  extraHeaders?: ExtraHeaders
): Promise<any> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null) {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (DEBUG_API) console.log("[API][GET][REQ]", url.toString());
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      headers: extraHeaders,
    });
    if (DEBUG_API) console.log("[API][GET][RES]", path, res.status);
    if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
    return res.json();
  } catch (error) {
    if (DEBUG_API) console.log("[API][GET][ERR]", path, error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function post(
  path: string,
  body: Record<string, any>,
  extraHeaders?: ExtraHeaders
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    if (DEBUG_API) console.log("[API][POST][REQ]", `${BASE_URL}${path}`, body);
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (DEBUG_API) console.log("[API][POST][RES]", path, res.status);
    if (!res.ok) {
      let errorBody: any = null;
      try { errorBody = await res.json(); } catch {
        try { errorBody = await res.text(); } catch { errorBody = null; }
      }
      if (DEBUG_API) console.log("[API][POST][ERR_BODY]", path, errorBody);
      throw new Error(
        `API error ${res.status} on ${path}${errorBody?.error ? `: ${errorBody.error}` : ""}`
      );
    }
    return res.json();
  } catch (error) {
    if (DEBUG_API) console.log("[API][POST][ERR]", path, error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function del(
  path: string,
  body: Record<string, any>,
  extraHeaders?: ExtraHeaders
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    if (DEBUG_API) console.log("[API][DELETE][REQ]", `${BASE_URL}${path}`, body);
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json", ...extraHeaders },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (DEBUG_API) console.log("[API][DELETE][RES]", path, res.status);
    if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
    return res.json();
  } catch (error) {
    if (DEBUG_API) console.log("[API][DELETE][ERR]", path, error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function postForm(
  path: string,
  formData: FormData,
  extraHeaders?: ExtraHeaders
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    if (DEBUG_API) console.log("[API][FORM][REQ]", `${BASE_URL}${path}`);
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: extraHeaders,
      body: formData,
      signal: controller.signal,
    });
    if (DEBUG_API) console.log("[API][FORM][RES]", path, res.status);
    if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
    return res.json();
  } catch (error) {
    if (DEBUG_API) console.log("[API][FORM][ERR]", path, error);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  // ── 검색 ──
  search: (keyword: string, type: string, pageNo: number, pageSize = 20): Promise<any> =>
    get("/api/search", { keyword, type, pageNo, pageSize }),

  aiSearch: (keyword: string, lat?: number, lon?: number): Promise<AISearchResult> =>
    get("/api/ai-search", { keyword, lat, lon }, AI_TIMEOUT_MS),

  // ── 홈 ──
  newArrivals: (): Promise<any> => get("/api/new-arrivals"),
  monthlyRecommend: (): Promise<any> => get("/api/monthly-recommend"),
  personalizedRecommend: (isbn13List: string): Promise<any> =>
    get("/api/personalized-recommend", { isbn13: isbn13List }),

  // ── 인기 도서 ──
  popularBooks: (params: {
    startDt?: string;
    endDt?: string;
    gender?: string;
    from_age?: string;
    to_age?: string;
    region?: string;
    pageNo?: number;
    pageSize?: number;
  }): Promise<any> => get("/api/popular-books", params),

  hotTrend: (searchDt?: string): Promise<any> =>
    get("/api/hot-trend", { searchDt }),

  // ── 도서 상세 ──
  bookDetail: (isbn: string, title?: string): Promise<any> =>
    get("/api/book-detail", { isbn, title }),

  bookIntro: (isbn13: string): Promise<any> =>
    get("/api/book-intro", { isbn13 }).then(
      (res) => res?.response?.detail?.[0]?.book ?? null
    ),

  bookAIInsight: (title: string, author?: string, isbn13?: string): Promise<AIInsight | null> =>
    get("/api/book-ai-insight", { title, author, isbn13 }).then(
      (res) => res?.insight ?? null
    ),

  // ── 도서관 검색 ──
  libraryByBook: (isbn: string, region: string, dtlRegion?: string): Promise<any[]> =>
    get("/api/library-by-book", { isbn, region, dtl_region: dtlRegion || undefined }).then(
      (res) => (res?.response?.libs ?? []).map((item: any) => item.lib ?? item)
    ),

  bookExist: (isbn: string, libCode: string): Promise<any> =>
    get("/api/book-exist", { isbn, libCode }),

  // ── 북마크 (인증 자동) ──
  bookmarks: async (): Promise<Bookmark[]> => {
    const headers = await getAuthHeader();
    return get("/api/bookmarks", {}, TIMEOUT_MS, headers).then(
      (res) => res?.bookmarks ?? []
    );
  },

  addBookmark: async (book: {
    isbn13: string;
    bookname: string;
    authors: string;
    publisher: string;
    publication_year: string;
    bookImageURL: string;
  }): Promise<void> => {
    const headers = await getAuthHeader();
    return post("/api/bookmarks", {
      isbn13: book.isbn13,
      bookname: book.bookname,
      authors: book.authors,
      publisher: book.publisher,
      publication_year: book.publication_year,
      book_image_url: book.bookImageURL,
    }, headers);
  },

  removeBookmark: async (isbn13: string): Promise<void> => {
    const headers = await getAuthHeader();
    return del("/api/bookmarks", { isbn13 }, headers);
  },

  // ── 프로필 (인증 자동) ──
  profile: async (): Promise<UserProfile | null> => {
    const headers = await getAuthHeader();
    return get("/api/profile", {}, TIMEOUT_MS, headers).then(
      (res) => res?.profile ?? null
    );
  },

  updateProfile: async (data: {
    birth_date?: string;
    gender?: string;
    region_code?: string;
    region_name?: string;
    sub_region_code?: string;
    sub_region_name?: string;
    avatar_url?: string;
  }): Promise<UserProfile | null> => {
    const headers = await getAuthHeader();
    return post("/api/profile", {
      birthDate: data.birth_date,
      gender: data.gender,
      regionCode: data.region_code,
      regionName: data.region_name,
      subRegionCode: data.sub_region_code,
      subRegionName: data.sub_region_name,
      avatarUrl: data.avatar_url,
    }, headers).then((res) => res?.profile ?? null);
  },

  deleteAccount: async (): Promise<void> => {
    const headers = await getAuthHeader();
    return post("/api/delete-account", {}, headers);
  },

  // ── 한줄평 ──
  bookReviews: (isbn13: string): Promise<BookReview[]> =>
    get("/api/book-reviews", { isbn13 }).then((res) => res?.reviews ?? []),

  allReviews: (page = 1, limit = 20): Promise<{ reviews: BookReview[]; total: number; page: number }> =>
    get("/api/book-reviews", { page, limit }),

  upsertReview: async (params: {
    isbn13: string;
    bookname: string;
    authors: string;
    publisher: string;
    book_image_url: string;
    display_name: string;
    rating: number;
    review_text: string;
  }): Promise<void> => {
    const headers = await getAuthHeader();
    return post("/api/book-reviews", params, headers);
  },

  deleteReview: async (isbn13: string): Promise<void> => {
    const headers = await getAuthHeader();
    return del("/api/book-reviews", { isbn13 }, headers);
  },

  uploadProfileImage: async (file: {
    uri: string;
    name?: string;
    type?: string;
  }): Promise<string> => {
    const headers = await getAuthHeader();
    const form = new FormData();
    form.append("file", {
      uri: file.uri,
      name: file.name ?? `profile_${Date.now()}.jpg`,
      type: file.type ?? "image/jpeg",
    } as any);
    const res = await postForm("/api/upload-image", form, headers);
    return res?.url as string;
  },
};
