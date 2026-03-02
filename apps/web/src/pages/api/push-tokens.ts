import type { APIRoute } from 'astro';
import { verifyAuth, getSupabase, safeErrorResponse } from '../../lib/auth';

export const prerender = false;

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// 푸쉬 토큰 등록 (upsert)
export const POST: APIRoute = async ({ request, locals }) => {
  const auth = await verifyAuth(request, locals);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const supabase = getSupabase(locals);
  if (!supabase) return jsonResponse({ error: 'Supabase not configured' }, 500);

  try {
    const body = await request.json();
    const { token, platform } = body;

    if (!token) return jsonResponse({ error: 'token is required' }, 400);

    const validPlatforms = ['android', 'ios'];
    const resolvedPlatform = validPlatforms.includes(platform) ? platform : 'android';

    const { error } = await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: userId,
          token,
          platform: resolvedPlatform,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id,token' }
      );

    if (error) throw error;
    return jsonResponse({ success: true });
  } catch (error) {
    return safeErrorResponse(error);
  }
};

// 푸쉬 토큰 삭제 (앱 로그아웃 시)
export const DELETE: APIRoute = async ({ request, locals }) => {
  const auth = await verifyAuth(request, locals);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const supabase = getSupabase(locals);
  if (!supabase) return jsonResponse({ error: 'Supabase not configured' }, 500);

  try {
    const body = await request.json();
    const { token } = body;

    if (!token) return jsonResponse({ error: 'token is required' }, 400);

    const { error } = await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('token', token);

    if (error) throw error;
    return jsonResponse({ success: true });
  } catch (error) {
    return safeErrorResponse(error);
  }
};
