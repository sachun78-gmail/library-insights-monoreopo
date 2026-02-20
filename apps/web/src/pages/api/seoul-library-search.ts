import type { APIRoute } from 'astro';

export const prerender = false;

// Helper to get env variable (works in both local and Cloudflare)
function getEnvVar(locals: any, key: string): string | undefined {
  if (locals?.runtime?.env?.[key]) {
    return locals.runtime.env[key];
  }
  return (import.meta.env as any)[key];
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const isbn = url.searchParams.get('isbn') || '';
  const title = url.searchParams.get('title') || ' ';
  const author = url.searchParams.get('author') || ' ';
  const publisher = url.searchParams.get('publisher') || ' ';
  const classNo = url.searchParams.get('class_no') || ' ';

  if (!isbn && title.trim() === '') {
    return new Response(JSON.stringify({ error: 'ISBN or title is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const authKey = getEnvVar(locals, 'SEOUL_OPENDATA_API_KEY');

  if (!authKey) {
    return new Response(JSON.stringify({ error: 'Seoul OpenData API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // 서울열린데이터광장 - 서울도서관 소장자료 검색 API
    // URL 형식: http://openAPI.seoul.go.kr:8088/{KEY}/{FORMAT}/SeoulLibraryBookSearchInfo/{START}/{END}/{도서명}/{저자}/{출판사}/{ISBN}/{분류}/
    const params = [
      encodeURIComponent(title),
      encodeURIComponent(author),
      encodeURIComponent(publisher),
      encodeURIComponent(isbn || ' '),
      encodeURIComponent(classNo)
    ].join('/');

    const apiUrl = `http://openAPI.seoul.go.kr:8088/${authKey}/json/SeoulLibraryBookSearchInfo/1/10/${params}/`;

    const response = await fetch(apiUrl);
    const data = await response.json();

    // 응답 구조 정리
    if (data.SeoulLibraryBookSearchInfo) {
      const result = data.SeoulLibraryBookSearchInfo;

      // 에러 체크
      if (result.RESULT?.CODE !== 'INFO-000') {
        return new Response(JSON.stringify({
          success: false,
          error: result.RESULT?.MESSAGE || 'API error',
          code: result.RESULT?.CODE
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      // 성공 응답
      const books = result.row || [];
      return new Response(JSON.stringify({
        success: true,
        totalCount: result.list_total_count || 0,
        books: books.map((book: any) => ({
          title: book.TITLE,
          author: book.AUTHOR,
          publisher: book.PUBLER,
          publishYear: book.PUBLER_YEAR,
          isbn: book.ISBN,
          callNo: book.CALL_NO,
          classNo: book.CLASS_NO,
          location: book.LOCA_NAME,
          locationCode: book.LOCA,
          subLocation: book.SUB_LOCA_NAME,
          loanStatus: book.LOAN_STATUS,
          loanStatusName: book.LOAN_STATUS_NAME,
          language: book.LANG_NAME,
          country: book.CONTRY_NAME,
          page: book.PAGE,
          createDate: book.CREATE_DATE
        }))
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Seoul Library API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch data' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
