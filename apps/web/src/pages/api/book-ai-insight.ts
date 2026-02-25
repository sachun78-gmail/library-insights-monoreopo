import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { getCachedResponse, setCachedResponse } from '../../lib/cache';
import { fetchLibraryProxy } from '../../lib/library-proxy';

export const prerender = false;

const CACHE_TTL = 7 * 24 * 60 * 60; // 7일

function getEnvVar(locals: any, key: string): string | undefined {
  if (locals?.runtime?.env?.[key]) {
    return locals.runtime.env[key];
  }
  return (import.meta.env as any)[key];
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const title = url.searchParams.get('title') || '';
  const author = url.searchParams.get('author') || '';
  const isbn13 = url.searchParams.get('isbn13') || '';

  if (!title) {
    return new Response(JSON.stringify({ error: 'title parameter required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 1. Cloudflare 엣지 캐시 확인
  const cacheKey = `${url.origin}/api/book-ai-insight?title=${encodeURIComponent(title)}`;
  const edgeCached = await getCachedResponse(cacheKey);
  if (edgeCached) return edgeCached;

  // 2. Supabase DB 캐시 확인
  const supabaseUrl = getEnvVar(locals, 'PUBLIC_SUPABASE_URL') || '';
  const supabaseKey = getEnvVar(locals, 'SUPABASE_SECRET_KEY') || '';

  if (supabaseUrl && supabaseKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      const query = supabase.from('book_insights').select('insight');
      const { data } = isbn13
        ? await query.eq('isbn13', isbn13).maybeSingle()
        : await query.eq('title', title).maybeSingle();

      if (data?.insight) {
        const result = { success: true, insight: data.insight };
        await setCachedResponse(cacheKey, result, CACHE_TTL);
        return new Response(JSON.stringify(result), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    } catch (e) {
      console.error('Supabase cache lookup error:', e);
    }
  }

  // 3. VPS 경유 OpenAI 호출
  try {
    const aiData = await fetchLibraryProxy(locals, '/v1/ai-insight', { title, author, isbn13 });
    const insight = aiData?.insight;
    if (!insight) throw new Error('No insight in response');

    // 4. Supabase에 결과 저장
    if (supabaseUrl && supabaseKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        await supabase.from('book_insights').upsert({
          isbn13: isbn13 || title, // isbn13 없으면 title을 PK로 사용
          title,
          insight,
        });
      } catch (e) {
        console.error('Supabase cache save error:', e);
      }
    }

    const result = { success: true, insight };
    await setCachedResponse(cacheKey, result, CACHE_TTL);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Book AI insight error:', error);
    return new Response(JSON.stringify({
      error: 'AI 분석 중 오류가 발생했습니다.',
      detail: error?.message ?? String(error),
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
