import type { APIRoute } from 'astro';
import { fetchLibraryProxy } from '../../lib/library-proxy';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const isbn = url.searchParams.get('isbn') || '';
  const region = url.searchParams.get('region') || '';
  const dtlRegion = url.searchParams.get('dtl_region') || '';

  if (!isbn) {
    return new Response(JSON.stringify({ error: 'ISBN is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await fetchLibraryProxy(locals, '/v1/libSrchByBook', {
      isbn,
      pageSize: 100,
      region: region || undefined,
      dtl_region: dtlRegion || undefined,
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Library search API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

