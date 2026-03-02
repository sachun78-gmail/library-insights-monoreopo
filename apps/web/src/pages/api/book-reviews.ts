import type { APIRoute } from 'astro';
import { verifyAuth, getSupabase, safeErrorResponse } from '../../lib/auth';

/**
 * 해당 isbn13을 찜한 사용자들(리뷰 작성자 제외)의 Expo Push Token을 조회하여 알림을 발송합니다.
 */
async function sendReviewPushNotifications(
  supabase: any,
  isbn13: string,
  reviewerUserId: string,
  bookname: string,
  displayName: string,
) {
  try {
    // 해당 책을 찜한 사람들의 push_token 조회 (작성자 본인 제외)
    const { data: bookmarks } = await supabase
      .from('bookmarks')
      .select('user_id')
      .eq('isbn13', isbn13)
      .neq('user_id', reviewerUserId);

    if (!bookmarks || bookmarks.length === 0) return;

    const userIds = bookmarks.map((b: any) => b.user_id);

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .in('user_id', userIds);

    if (!tokens || tokens.length === 0) return;

    const pushTokens: string[] = tokens.map((t: any) => t.token);

    // Expo Push API로 알림 발송
    const messages = pushTokens.map((token: string) => ({
      to: token,
      sound: 'default',
      title: '새 한줄평이 달렸어요!',
      body: `"${bookname}"에 ${displayName}님이 한줄평을 남겼습니다.`,
      data: { isbn13, screen: 'bookDetail' },
    }));

    // Expo Push API는 최대 100개 묶음으로 처리
    const chunkSize = 100;
    for (let i = 0; i < messages.length; i += chunkSize) {
      const chunk = messages.slice(i, i + chunkSize);
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(chunk),
      });
    }
  } catch (err) {
    // 알림 발송 실패는 리뷰 저장 성공에 영향을 주지 않도록 무시
    console.error('[Push] 알림 발송 실패:', err instanceof Error ? err.message : String(err));
  }
}

export const prerender = false;

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const isbn13 = url.searchParams.get('isbn13');
  const userId = url.searchParams.get('userId');
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);

  const supabase = getSupabase(locals);
  if (!supabase) return jsonResponse({ error: 'Supabase not configured' }, 500);

  try {
    if (isbn13) {
      const { data, error } = await supabase
        .from('book_reviews')
        .select('*')
        .eq('isbn13', isbn13)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return jsonResponse({ reviews: data || [] });
    }

    if (userId) {
      const { data, error } = await supabase
        .from('book_reviews')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return jsonResponse({ reviews: data || [] });
    }

    // Paginated all reviews (board view)
    const offset = (page - 1) * limit;
    const { data, error, count } = await supabase
      .from('book_reviews')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return jsonResponse({ reviews: data || [], total: count || 0, page, limit });
  } catch (error) {
    return safeErrorResponse(error);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const auth = await verifyAuth(request, locals);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const supabase = getSupabase(locals);
  if (!supabase) return jsonResponse({ error: 'Supabase not configured' }, 500);

  try {
    const body = await request.json();
    const { isbn13, bookname, authors, publisher, book_image_url, display_name, rating, review_text } = body;

    if (!isbn13 || !rating || !review_text) {
      return jsonResponse({ error: 'isbn13, rating, and review_text are required' }, 400);
    }

    if (rating < 1 || rating > 5) {
      return jsonResponse({ error: 'rating must be between 1 and 5' }, 400);
    }

    if (review_text.length < 1 || review_text.length > 100) {
      return jsonResponse({ error: 'review_text must be between 1 and 100 characters' }, 400);
    }

    const { data, error } = await supabase
      .from('book_reviews')
      .upsert(
        {
          user_id: userId,
          isbn13,
          bookname: bookname || '',
          authors: authors || '',
          publisher: publisher || '',
          book_image_url: book_image_url || '',
          display_name: display_name || '',
          rating,
          review_text,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,isbn13' }
      )
      .select()
      .single();

    if (error) throw error;

    // 찜한 사용자들에게 푸쉬 알림 발송 (비동기, 결과 무시)
    sendReviewPushNotifications(
      supabase,
      isbn13,
      userId,
      bookname || '알 수 없는 책',
      display_name || '누군가',
    );

    return jsonResponse({ review: data });
  } catch (error) {
    return safeErrorResponse(error);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const auth = await verifyAuth(request, locals);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const supabase = getSupabase(locals);
  if (!supabase) return jsonResponse({ error: 'Supabase not configured' }, 500);

  try {
    const body = await request.json();
    const { isbn13 } = body;

    if (!isbn13) return jsonResponse({ error: 'isbn13 is required' }, 400);

    const { error } = await supabase
      .from('book_reviews')
      .delete()
      .eq('user_id', userId)
      .eq('isbn13', isbn13);

    if (error) throw error;
    return jsonResponse({ success: true });
  } catch (error) {
    return safeErrorResponse(error);
  }
};
