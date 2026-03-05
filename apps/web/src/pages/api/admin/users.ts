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
  const perPage = parseInt(url.searchParams.get('perPage') || '50', 10);

  try {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw error;

    const users = (data?.users || []).map((u: any) => ({
      id: u.id,
      email: u.email,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
      display_name: u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0],
    }));

    return json({ users, total: data?.users?.length || 0 });
  } catch (error) {
    return safeErrorResponse(error);
  }
};
