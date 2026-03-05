import type { APIRoute } from 'astro';
import { verifyAuth, getSupabase, isAdmin } from '../../../lib/auth';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const auth = await verifyAuth(request, locals);
  if (auth instanceof Response) return auth;

  return new Response(JSON.stringify({ isAdmin: isAdmin(auth.userId, locals) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
