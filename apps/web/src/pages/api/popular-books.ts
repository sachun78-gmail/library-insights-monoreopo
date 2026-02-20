import type { APIRoute } from 'astro';
import { getCachedResponse, setCachedResponse } from '../../lib/cache';
import { fetchLibraryProxy } from '../../lib/library-proxy';

export const prerender = false;

const CACHE_TTL = 1 * 60 * 60; // 1 hour

export const GET: APIRoute = async ({ request, locals }) => {
  const cacheKey = request.url;
  const cached = await getCachedResponse(cacheKey);
  if (cached) return cached;

  const url = new URL(request.url);
  const startDt = url.searchParams.get('startDt') || '';
  const endDt = url.searchParams.get('endDt') || '';
  const gender = url.searchParams.get('gender') || '';
  const fromAge = url.searchParams.get('from_age') || '';
  const toAge = url.searchParams.get('to_age') || '';
  const region = url.searchParams.get('region') || '';
  const pageNo = url.searchParams.get('pageNo') || '1';
  const pageSize = url.searchParams.get('pageSize') || '10';

  try {
    const data = await fetchLibraryProxy(locals, '/v1/loanItemSrch', {
      pageNo,
      pageSize,
      startDt: startDt || undefined,
      endDt: endDt || undefined,
      gender: gender || undefined,
      from_age: fromAge || undefined,
      to_age: toAge || undefined,
      region: region || undefined,
    });

    await setCachedResponse(cacheKey, data, CACHE_TTL);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Popular books API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

