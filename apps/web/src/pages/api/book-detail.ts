import type { APIRoute } from 'astro';

export const prerender = false;

// Helper to get env variable (works in both local and Cloudflare)
function getEnvVar(locals: any, key: string): string | undefined {
  if (locals?.runtime?.env?.[key]) {
    return locals.runtime.env[key];
  }
  return (import.meta.env as any)[key];
}

// HTML 태그 제거 함수
function stripHtml(str: string | undefined): string {
  if (!str) return '';
  return str.replace(/<[^>]*>/g, '');
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const isbn = url.searchParams.get('isbn') || '';
  const title = url.searchParams.get('title') || '';

  if (!isbn && !title) {
    return new Response(JSON.stringify({ error: 'ISBN or title is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const clientId = getEnvVar(locals, 'NAVER_CLIENT_ID');
  const clientSecret = getEnvVar(locals, 'NAVER_CLIENT_SECRET');

  // 검색어 준비
  const searchQuery = title || isbn.replace(/-/g, '');
  const naverSearchUrl = `https://search.naver.com/search.naver?where=nexearch&query=${encodeURIComponent(searchQuery + ' 책 리뷰')}`;

  // 네이버 API 키가 없으면 검색 링크만 반환
  if (!clientId || !clientSecret) {
    return new Response(JSON.stringify({
      success: true,
      book: {
        title: title || '',
        description: '',
        link: naverSearchUrl,
        price: null,
        discount: null
      },
      review: null,
      fallback: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 1. 네이버 책 검색 API
    const bookQuery = isbn ? `isbn:${isbn.replace(/-/g, '')}` : title;
    const bookApiUrl = `https://openapi.naver.com/v1/search/book.json?query=${encodeURIComponent(bookQuery)}&display=1`;

    const bookResponse = await fetch(bookApiUrl, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      }
    });

    let bookData = null;
    if (bookResponse.ok) {
      const bookJson = await bookResponse.json();
      if (bookJson.items && bookJson.items.length > 0) {
        const book = bookJson.items[0];
        bookData = {
          title: stripHtml(book.title),
          author: stripHtml(book.author),
          publisher: book.publisher,
          pubdate: book.pubdate,
          description: stripHtml(book.description),
          isbn: book.isbn,
          image: book.image,
          link: book.link,
          discount: book.discount,
          price: book.price
        };
      }
    }

    // 2. 네이버 블로그 검색 API - 책 리뷰 검색
    const reviewQuery = `${title} 책 리뷰`;
    const blogApiUrl = `https://openapi.naver.com/v1/search/blog.json?query=${encodeURIComponent(reviewQuery)}&display=1&sort=sim`;

    const blogResponse = await fetch(blogApiUrl, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret
      }
    });

    let reviewData = null;
    if (blogResponse.ok) {
      const blogJson = await blogResponse.json();
      if (blogJson.items && blogJson.items.length > 0) {
        const blog = blogJson.items[0];
        reviewData = {
          title: stripHtml(blog.title),
          description: stripHtml(blog.description),
          bloggerName: blog.bloggername,
          bloggerLink: blog.bloggerlink,
          postDate: blog.postdate,
          link: blog.link
        };
      }
    }

    // 결과 반환
    return new Response(JSON.stringify({
      success: true,
      book: bookData || {
        title: title || '',
        description: '',
        link: naverSearchUrl,
        price: null,
        discount: null
      },
      review: reviewData
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Naver API error:', error);
    return new Response(JSON.stringify({
      success: true,
      book: {
        title: title || '',
        description: '',
        link: naverSearchUrl,
        price: null,
        discount: null
      },
      review: null,
      fallback: true
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
