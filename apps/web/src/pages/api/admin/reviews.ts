import type { APIRoute } from 'astro';
import { verifyAuth, getSupabase, isAdmin, safeErrorResponse } from '../../../lib/auth';

export const prerender = false;

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, locals }) => {
  const auth = await verifyAuth(request, locals);
  if (auth instanceof Response) return auth;
  if (!isAdmin(auth.userId, locals)) return json({ error: 'Forbidden' }, 403);

  const supabase = getSupabase(locals);
  if (!supabase) return json({ error: 'Supabase not configured' }, 500);

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '20', 10);
  const search = url.searchParams.get('search') || '';
  const offset = (page - 1) * limit;

  try {
    let query = supabase
      .from('book_reviews')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (search) {
      query = query.or(`bookname.ilike.%${search}%,review_text.ilike.%${search}%,display_name.ilike.%${search}%`);
    }

    const { data, error, count } = await query;
    if (error) throw error;

    return json({ reviews: data || [], total: count || 0, page, limit });
  } catch (error) {
    return safeErrorResponse(error);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const auth = await verifyAuth(request, locals);
  if (auth instanceof Response) return auth;
  if (!isAdmin(auth.userId, locals)) return json({ error: 'Forbidden' }, 403);

  const supabase = getSupabase(locals);
  if (!supabase) return json({ error: 'Supabase not configured' }, 500);

  try {
    const body = await request.json();
    const { review_id } = body;

    if (!review_id) return json({ error: 'review_id is required' }, 400);

    const { error } = await supabase
      .from('book_reviews')
      .delete()
      .eq('id', review_id);

    if (error) throw error;
    return json({ success: true });
  } catch (error) {
    return safeErrorResponse(error);
  }
};
