import type { APIRoute } from 'astro';
import OpenAI from 'openai';
import { getCachedResponse, setCachedResponse } from '../../lib/cache';

export const prerender = false;

const CACHE_TTL = 7 * 24 * 60 * 60; // 7일 (도서 정보는 잘 변하지 않음)

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

  if (!title) {
    return new Response(JSON.stringify({ error: 'title parameter required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 캐시 키: 도서 제목 기반
  const cacheKey = `${url.origin}/api/book-ai-insight?title=${encodeURIComponent(title)}`;
  const cached = await getCachedResponse(cacheKey);
  if (cached) return cached;

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

    const aiResponse = await openai.responses.create({
      model: 'gpt-4.1-mini',
      input: [
        { role: 'developer', content: [{ type: 'input_text', text: SYSTEM_PROMPT }] },
        { role: 'user', content: [{ type: 'input_text', text: userInput }] },
      ],
      temperature: 0.7,
      max_output_tokens: 1024,
    });

    let insight: any;
    try {
      insight = JSON.parse(aiResponse.output_text);
    } catch {
      // JSON 파싱 실패 시 텍스트 그대로 반환
      insight = { raw: aiResponse.output_text };
    }

    const result = { success: true, insight };
    await setCachedResponse(cacheKey, result, CACHE_TTL);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Book AI insight error:', error);
    return new Response(JSON.stringify({
      error: 'AI 분석 중 오류가 발생했습니다.',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
