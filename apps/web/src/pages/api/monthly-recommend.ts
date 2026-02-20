import type { APIRoute } from 'astro';
import { getCachedResponse, setCachedResponse } from '../../lib/cache';
import { fetchLibraryProxy } from '../../lib/library-proxy';

export const prerender = false;

const CACHE_TTL = 24 * 60 * 60; // 24 hours

export const GET: APIRoute = async ({ request, locals }) => {
  const today = new Date().toISOString().split('T')[0];
  const cacheKey = `${new URL(request.url).origin}/api/monthly-recommend?date=${today}`;
  const cached = await getCachedResponse(cacheKey);
  if (cached) return cached;

  try {
    const now = new Date();
    now.setMonth(now.getMonth() - 1);
    const month = now.toISOString().slice(0, 7);

    const keywordsData = await fetchLibraryProxy(locals, '/v1/monthlyKeywords', {
      month,
    });
    const keywords = keywordsData.response?.keywords || [];

    if (keywords.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'No keywords found',
          keyword: null,
          book: null,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const shuffledKeywords = [...keywords].sort(() => Math.random() - 0.5);

    let keyword = '';
    let book = null;

    for (const keywordObj of shuffledKeywords) {
      const tryKeyword = keywordObj.keyword?.word || '';
      if (!tryKeyword) continue;

      const searchData = await fetchLibraryProxy(locals, '/v1/srchBooks', {
        keyword: tryKeyword,
        pageNo: 1,
        pageSize: 10,
      });
      const books = searchData.response?.docs || [];

      if (books.length > 0) {
        const randomBook = books[Math.floor(Math.random() * Math.min(books.length, 5))];
        book = randomBook.doc;
        keyword = tryKeyword;
        break;
      }
    }

    if (!book) {
      return new Response(
        JSON.stringify({
          error: 'No books found for any keyword',
          keyword: null,
          book: null,
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    let bookDetail = null;
    if (book.isbn13) {
      const detailData = await fetchLibraryProxy(locals, '/v1/srchDtlList', {
        isbn13: book.isbn13,
      });
      if (detailData.response?.detail?.[0]?.book) {
        bookDetail = detailData.response.detail[0].book;
      }
    }

    const result = {
      keyword,
      month,
      book: {
        bookname: book.bookname || bookDetail?.bookname || '',
        authors: book.authors || bookDetail?.authors || '',
        publisher: book.publisher || bookDetail?.publisher || '',
        publication_year: book.publication_year || bookDetail?.publication_year || '',
        isbn13: book.isbn13 || bookDetail?.isbn13 || '',
        bookImageURL: book.bookImageURL || bookDetail?.bookImageURL || '',
        description: bookDetail?.description || book.description || '',
        class_nm: book.class_nm || bookDetail?.class_nm || '',
        loan_count: book.loan_count || bookDetail?.loan_count || '',
      },
    };

    await setCachedResponse(cacheKey, result, CACHE_TTL);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Monthly recommend API error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch recommendation',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

