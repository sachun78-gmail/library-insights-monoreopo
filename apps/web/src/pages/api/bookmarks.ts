import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';

export const prerender = false;

function createAdminClient(url: string, serviceKey: string) {
  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getSupabase(locals: any) {
  const runtime = locals.runtime;
  const supabaseUrl = runtime?.env?.SUPABASE_URL || import.meta.env.PUBLIC_SUPABASE_URL;
  const supabaseKey = runtime?.env?.SUPABASE_SECRET_KEY || import.meta.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  return createAdminClient(supabaseUrl, supabaseKey);
}

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');

  if (!userId) {
    return jsonResponse({ error: 'userId is required' }, 400);
  }

  const supabase = getSupabase(locals);
  if (!supabase) {
    return jsonResponse({ error: 'Supabase not configured' }, 500);
  }

  try {
    const { data, error } = await supabase
      .from('bookmarks')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return jsonResponse({ bookmarks: data || [] });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  const supabase = getSupabase(locals);
  if (!supabase) {
    return jsonResponse({ error: 'Supabase not configured' }, 500);
  }

  try {
    const body = await request.json();
    const { userId, isbn13, bookname, authors, publisher, publication_year, book_image_url } = body;

    if (!userId || !isbn13) {
      return jsonResponse({ error: 'userId and isbn13 are required' }, 400);
    }

    const { data, error } = await supabase
      .from('bookmarks')
      .upsert({
        user_id: userId,
        isbn13,
        bookname: bookname || '',
        authors: authors || '',
        publisher: publisher || '',
        publication_year: publication_year || '',
        book_image_url: book_image_url || '',
      }, { onConflict: 'user_id,isbn13' })
      .select()
      .single();

    if (error) throw error;

    return jsonResponse({ bookmark: data });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const supabase = getSupabase(locals);
  if (!supabase) {
    return jsonResponse({ error: 'Supabase not configured' }, 500);
  }

  try {
    const body = await request.json();
    const { userId, isbn13 } = body;

    if (!userId || !isbn13) {
      return jsonResponse({ error: 'userId and isbn13 are required' }, 400);
    }

    const { error } = await supabase
      .from('bookmarks')
      .delete()
      .eq('user_id', userId)
      .eq('isbn13', isbn13);

    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (error: any) {
    return jsonResponse({ error: error.message }, 500);
  }
};
