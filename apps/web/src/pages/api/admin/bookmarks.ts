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
  const userId = url.searchParams.get('user_id');

  if (!userId) return json({ error: 'user_id is required' }, 400);

  try {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return json({ bookmarks: data || [] });
  } catch (error) {
    return safeErrorResponse(error);
  }
};
