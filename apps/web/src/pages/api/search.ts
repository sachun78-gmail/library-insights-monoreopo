import type { APIRoute } from 'astro';
import { fetchLibraryProxy } from '../../lib/library-proxy';

export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword') || '';
  const isbn = url.searchParams.get('isbn') || '';
  const pageNo = url.searchParams.get('pageNo') || '1';
  const pageSize = url.searchParams.get('pageSize') || '10';

  if (!keyword && !isbn) {
    return new Response(JSON.stringify({ error: 'Keyword or ISBN is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    let data;
    if (isbn) {
      const normalizedIsbn = isbn.replace(/[^0-9Xx]/g, '');
      if (/^\d{13}$/.test(normalizedIsbn)) {
        data = await fetchLibraryProxy(locals, '/v1/srchBooks', {
          isbn13: normalizedIsbn,
          pageNo,
          pageSize,
        });
      } else {
        data = await fetchLibraryProxy(locals, '/v1/srchBooks', {
          isbn,
          pageNo,
          pageSize,
        });
      }
    } else {
      data = await fetchLibraryProxy(locals, '/v1/srchBooks', {
        title: keyword,
        pageNo,
        pageSize,
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Search API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data', details: String(error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
