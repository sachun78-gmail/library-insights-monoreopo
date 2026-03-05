import type { APIRoute } from 'astro';
import { verifyAuth, getSupabase, safeErrorResponse } from '../../lib/auth';

export const prerender = false;

const MAX_FAVORITES = 3;

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
      .from('favorite_libraries')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return jsonResponse({ libraries: data || [] });
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
    const { lib_code, lib_name, address, tel, latitude, longitude, homepage } = body;

    if (!lib_code || !lib_name) {
      return jsonResponse({ error: 'lib_code and lib_name are required' }, 400);
    }

    // 현재 개수 확인
    const { count, error: countError } = await supabase
      .from('favorite_libraries')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countError) throw countError;

    if ((count ?? 0) >= MAX_FAVORITES) {
      return jsonResponse({ error: `즐겨찾기는 최대 ${MAX_FAVORITES}개까지 등록할 수 있습니다.` }, 400);
    }

    const { data, error } = await supabase
      .from('favorite_libraries')
      .upsert(
        {
          user_id: userId,
          lib_code,
          lib_name,
          address: address || '',
          tel: tel || '',
          latitude: latitude || '',
          longitude: longitude || '',
          homepage: homepage || '',
        },
        { onConflict: 'user_id,lib_code' }
      )
      .select()
      .single();

    if (error) throw error;
    return jsonResponse({ library: data });
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
    const { lib_code } = body;

    if (!lib_code) return jsonResponse({ error: 'lib_code is required' }, 400);

    const { error } = await supabase
      .from('favorite_libraries')
      .delete()
      .eq('user_id', userId)
      .eq('lib_code', lib_code);

    if (error) throw error;
    return jsonResponse({ success: true });
  } catch (error) {
    return safeErrorResponse(error);
  }
};
