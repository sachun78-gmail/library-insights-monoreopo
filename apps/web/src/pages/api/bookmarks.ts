import type { APIRoute } from 'astro';
import { verifyAuth, getSupabase, safeErrorResponse } from '../../lib/auth';

export const prerender = false;

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, locals }) => {
  const auth = await verifyAuth(request, locals);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const supabase = getSupabase(locals);
  if (!supabase) return jsonResponse({ error: 'Supabase not configured' }, 500);

  try {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return jsonResponse({ bookmarks: data || [] });
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
    const { isbn13, bookname, authors, publisher, publication_year, book_image_url, reading_status } = body;

    if (!isbn13) return jsonResponse({ error: 'isbn13 is required' }, 400);

    const { data, error } = await supabase
      .from('bookmarks')
      .upsert(
        {
          user_id: userId,
          isbn13,
          bookname: bookname || '',
          authors: authors || '',
          publisher: publisher || '',
          publication_year: publication_year || '',
          book_image_url: book_image_url || '',
          reading_status: reading_status || 'to_read',
        },
        { onConflict: 'user_id,isbn13' }
      )
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ bookmark: data });
  } catch (error) {
    return safeErrorResponse(error);
  }
};

export const PATCH: APIRoute = async ({ request, locals }) => {
  const auth = await verifyAuth(request, locals);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const supabase = getSupabase(locals);
  if (!supabase) return jsonResponse({ error: 'Supabase not configured' }, 500);

  try {
    const body = await request.json();
    const { isbn13, reading_status } = body;

    if (!isbn13) return jsonResponse({ error: 'isbn13 is required' }, 400);
    if (!['to_read', 'reading', 'read'].includes(reading_status)) {
      return jsonResponse({ error: 'Invalid reading_status' }, 400);
    }

    const { data, error } = await supabase
      .from('bookmarks')
      .update({ reading_status })
      .eq('user_id', userId)
      .eq('isbn13', isbn13)
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ bookmark: data });
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
      .from('bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('isbn13', isbn13);

    if (error) throw error;
    return jsonResponse({ success: true });
  } catch (error) {
    return safeErrorResponse(error);
  }
};
