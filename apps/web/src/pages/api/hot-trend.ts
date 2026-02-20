import type { APIRoute } from 'astro';
import { getCachedResponse, setCachedResponse } from '../../lib/cache';
import { fetchLibraryProxy } from '../../lib/library-proxy';

export const prerender = false;

const CACHE_TTL = 6 * 60 * 60; // 6 hours

export const GET: APIRoute = async ({ request, locals }) => {
  const cacheKey = request.url;
  const cached = await getCachedResponse(cacheKey);
  if (cached) return cached;

  const url = new URL(request.url);
  const defaultDate = new Date().toISOString().split('T')[0];
  const searchDt = url.searchParams.get('searchDt') || defaultDate;

  try {
    const data = await fetchLibraryProxy(locals, '/v1/hotTrend', {
      searchDt,
    });

    await setCachedResponse(cacheKey, data, CACHE_TTL);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Hot trend API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
