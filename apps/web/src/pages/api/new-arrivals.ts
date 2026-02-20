import type { APIRoute } from 'astro';
import { getCachedResponse, setCachedResponse } from '../../lib/cache';
import { fetchLibraryProxy } from '../../lib/library-proxy';

export const prerender = false;

const CACHE_TTL = 6 * 60 * 60; // 6 hours

export const GET: APIRoute = async ({ request, locals }) => {
  const cacheKey = request.url;
  const cached = await getCachedResponse(cacheKey);
  if (cached) return cached;

  try {
    const today = new Date();
    const weekAgo = new Date(today);
    weekAgo.setDate(today.getDate() - 7);

    const endDt = today.toISOString().split('T')[0];
    const startDt = weekAgo.toISOString().split('T')[0];

    const data = await fetchLibraryProxy(locals, '/v1/loanItemSrch', {
      startDt,
      endDt,
      pageNo: 1,
      pageSize: 20,
    });

    await setCachedResponse(cacheKey, data, CACHE_TTL);

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('New arrivals API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

