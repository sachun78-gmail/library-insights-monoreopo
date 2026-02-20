import type { APIRoute } from 'astro';
import { getCachedResponse, setCachedResponse } from '../../lib/cache';
import { fetchLibraryProxy } from '../../lib/library-proxy';

export const prerender = false;

const CACHE_TTL = 24 * 60 * 60; // 24 hours

function extractBooks(data: any): any[] {
  if (!data || !data.response) return [];

  const docs = data.response.docs;
  if (Array.isArray(docs) && docs.length > 0) {
    return docs.map((item: any) => item.book || item.doc || item).filter(Boolean);
  }

  const list = data.response.list;
  if (Array.isArray(list) && list.length > 0) {
    return list.map((item: any) => item.book || item.doc || item).filter(Boolean);
  }

  return [];
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const isbn13 = url.searchParams.get('isbn13') || '';

  if (!isbn13) {
    return new Response(JSON.stringify({ error: 'isbn13 parameter required', book: null }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `${url.origin}/api/personalized-recommend?isbn13=${isbn13}&date=${today}`;
  const cached = await getCachedResponse(cacheKey);
  if (cached) return cached;

  try {
    const maniaData = await fetchLibraryProxy(locals, '/v1/recommandList', {
      isbn13,
    });
    let books = extractBooks(maniaData);

    if (books.length === 0) {
      const readerData = await fetchLibraryProxy(locals, '/v1/recommandList', {
        isbn13,
        type: 'reader',
      });
      books = extractBooks(readerData);
    }

    if (books.length === 0) {
      const result = { book: null, source: 'personalized' };
      await setCachedResponse(cacheKey, result, CACHE_TTL);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const firstBook = books[0];
    const result = {
      book: {
        bookname: firstBook.bookname || '',
        authors: firstBook.authors || '',
        publisher: firstBook.publisher || '',
        publication_year: firstBook.publication_year || '',
        isbn13: firstBook.isbn13 || '',
        bookImageURL: firstBook.bookImageURL || '',
        description: firstBook.description || '',
        class_nm: firstBook.class_nm || '',
      },
      source: 'personalized',
    };

    await setCachedResponse(cacheKey, result, CACHE_TTL);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Personalized recommend API error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch personalized recommendation',
        book: null,
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

