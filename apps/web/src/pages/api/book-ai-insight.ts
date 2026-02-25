import type { APIRoute } from 'astro';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { getCachedResponse, setCachedResponse } from '../../lib/cache';

export const prerender = false;

const CACHE_TTL = 7 * 24 * 60 * 60; // 7일

function getEnvVar(locals: any, key: string): string | undefined {
  if (locals?.runtime?.env?.[key]) {
    return locals.runtime.env[key];
  }
  return (import.meta.env as any)[key];
}

const SYSTEM_PROMPT = `너는 전 세계 출판 트렌드와 독자들의 니즈를 꿰뚫고 있는 '글로벌 북 큐레이션 전문가'야
입력으로 받은 도서에 대해서 아래 정보를 줘
1. 3줄 요약
2. 핵심 메시지
3. 이런 사람에게 추천
4. 난이도 평가

반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마.
{
  "summary": "3줄 요약 텍스트",
  "keyMessage": "핵심 메시지 텍스트",
  "recommendFor": "이런 사람에게 추천 텍스트",
  "difficulty": "난이도 평가 텍스트"
}`;

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

  // 3. OpenAI 호출
  const openaiKey = getEnvVar(locals, 'OPENAI_API_KEY');
  if (!openaiKey) {
    return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    const userInput = author ? `${title} (${author})` : title;

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userInput },
      ],
      temperature: 0.7,
      max_tokens: 1024,
      response_format: { type: 'json_object' },
    });

    let insight: any;
    try {
      insight = JSON.parse(aiResponse.choices[0].message.content ?? '{}');
    } catch {
      insight = { raw: aiResponse.choices[0].message.content };
    }

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
