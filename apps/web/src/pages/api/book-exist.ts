import type { APIRoute } from 'astro';
import { fetchLibraryProxy } from '../../lib/library-proxy';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const isbn = url.searchParams.get('isbn') || '';
  const libCode = url.searchParams.get('libCode') || '';

  if (!isbn || !libCode) {
    return new Response(JSON.stringify({ error: 'isbn and libCode are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const data = await fetchLibraryProxy(locals, '/v1/bookExist', {
      isbn13: isbn,
      libCode,
    });

    const result = data.response?.result || {};
    return new Response(JSON.stringify({
      hasBook: result.hasBook === 'Y',
      loanAvailable: result.loanAvailable === 'Y',
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Book exist API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
