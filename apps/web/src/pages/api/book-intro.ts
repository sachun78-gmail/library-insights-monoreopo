import type { APIRoute } from 'astro';
import { fetchLibraryProxy } from '../../lib/library-proxy';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const isbn13 = url.searchParams.get('isbn13') || '';

  if (!isbn13) {
    return new Response(JSON.stringify({ error: 'isbn13 is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await fetchLibraryProxy(locals, '/v1/srchDtlList', {
      isbn13,
      loaninfoYN: 'Y',
    });

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Book intro API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

