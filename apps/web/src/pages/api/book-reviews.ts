import type { APIRoute } from 'astro';
import { verifyAuth, getSupabase } from '../../lib/auth';

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
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
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
    return jsonResponse({ review: data });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
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
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
};
