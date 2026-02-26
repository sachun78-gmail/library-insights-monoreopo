import { createClient } from '@supabase/supabase-js';

function createAdminClient(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export function getSupabase(locals: any) {
  const runtime = locals?.runtime;
  const url = runtime?.env?.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
  const key = runtime?.env?.SUPABASE_SECRET_KEY || import.meta.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createAdminClient(url, key);
}

function jsonUnauthorized() {
  return new Response(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 내부 에러를 로깅하고 클라이언트에 안전한 메시지만 반환합니다.
 */
export function safeErrorResponse(error: unknown, publicMessage = 'Internal server error'): Response {
  // 서버 로그에만 상세 에러 기록
  console.error('[API Error]', error instanceof Error ? error.message : String(error));
  return new Response(JSON.stringify({ error: publicMessage }), {
    status: 500,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Verifies the Bearer token in the Authorization header.
 * Returns { userId: string } on success, or a 401/500 Response on failure.
 */
export async function verifyAuth(
  request: Request,
  locals: any
): Promise<{ userId: string } | Response> {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

  if (!token) return jsonUnauthorized();

  const supabase = getSupabase(locals);
  if (!supabase) {
    return new Response(JSON.stringify({ error: 'Supabase not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) return jsonUnauthorized();

  return { userId: user.id };
}
