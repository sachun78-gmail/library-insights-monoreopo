import type { APIRoute } from 'astro';
import { verifyAuth, getSupabase } from '../../lib/auth';

export const prerender = false;

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function normalizeGenderInput(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const v = value.trim();
  if (!v) return null;
  if (v === 'M' || v.toLowerCase() === 'male') return 'male';
  if (v === 'F' || v.toLowerCase() === 'female') return 'female';
  if (v.toLowerCase() === 'other') return 'other';
  return v;
}

export const GET: APIRoute = async ({ request, locals }) => {
  const auth = await verifyAuth(request, locals);
  if (auth instanceof Response) return auth;
  const { userId } = auth;

  const supabase = getSupabase(locals);
  if (!supabase) return jsonResponse({ error: 'Supabase not configured' }, 500);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return jsonResponse({ profile: data });
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
    const { birthDate, gender, regionCode, regionName, subRegionCode, subRegionName, avatarUrl } = body;

    const profileData = {
      id: userId,
      birth_date: birthDate || null,
      gender: normalizeGenderInput(gender),
      region_code: regionCode || null,
      region_name: regionName || null,
      sub_region_code: subRegionCode || null,
      sub_region_name: subRegionName || null,
      avatar_url: avatarUrl || null,
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(profileData, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse({ profile: data });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
};
