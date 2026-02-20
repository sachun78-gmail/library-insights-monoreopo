import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

// Create admin client that bypasses RLS
function createAdminClient(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return new Response(JSON.stringify({ error: 'userId is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Try Cloudflare runtime env first, then fall back to import.meta.env
  const runtime = locals.runtime;
  const supabaseUrl = runtime?.env?.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseKey = runtime?.env?.SUPABASE_SECRET_KEY || import.meta.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({
      error: 'Supabase not configured',
      debug: { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createAdminClient(supabaseUrl, supabaseKey);

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return new Response(JSON.stringify({ profile: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  // Try Cloudflare runtime env first, then fall back to import.meta.env
  const runtime = locals.runtime;
  const supabaseUrl = runtime?.env?.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseKey = runtime?.env?.SUPABASE_SECRET_KEY || import.meta.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({
      error: 'Supabase not configured',
      debug: { hasUrl: !!supabaseUrl, hasKey: !!supabaseKey }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createAdminClient(supabaseUrl, supabaseKey);

  try {
    const body = await request.json();
    const { userId, birthDate, gender, regionCode, regionName, subRegionCode, subRegionName, avatarUrl } = body;

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const profileData = {
      id: userId,
      birth_date: birthDate || null,
      gender: gender || null,
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

    if (error) {
      throw error;
    }

    return new Response(JSON.stringify({ profile: data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
