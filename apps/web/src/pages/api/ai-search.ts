import type { APIRoute } from 'astro';
import { getCachedResponse, setCachedResponse } from '../../lib/cache';
import { fetchLibraryProxy } from '../../lib/library-proxy';

export const prerender = false;

const CACHE_TTL = 24 * 60 * 60; // 24 hours
const OPENAI_TIMEOUT_MS = 8000;
const FETCH_TIMEOUT_MS = 5000;
const MAX_AI_BOOKS = 12;
const MAX_SEED_LOOKUPS = 12;
const MAX_SEED_ISBNS = 5;
const MAX_LIB_CHECK_BOOKS = 12;
const MAX_RETURN_BOOKS = 12;

function getEnvVar(locals: any, key: string): string | undefined {
  if (locals?.runtime?.env?.[key]) {
    return locals.runtime.env[key];
  }
  return (import.meta.env as any)[key];
}

const regionCenters = [
  { code: '11', name: 'Seoul', lat: 37.5665, lon: 126.9780 },
  { code: '21', name: 'Busan', lat: 35.1796, lon: 129.0756 },
  { code: '22', name: 'Daegu', lat: 35.8714, lon: 128.6014 },
  { code: '23', name: 'Incheon', lat: 37.4563, lon: 126.7052 },
  { code: '24', name: 'Gwangju', lat: 35.1595, lon: 126.8526 },
  { code: '25', name: 'Daejeon', lat: 36.3504, lon: 127.3845 },
  { code: '26', name: 'Ulsan', lat: 35.5384, lon: 129.3114 },
  { code: '29', name: 'Sejong', lat: 36.48, lon: 127.0 },
  { code: '31', name: 'Gyeonggi', lat: 37.4138, lon: 127.5183 },
  { code: '32', name: 'Gangwon', lat: 37.8228, lon: 128.1555 },
  { code: '33', name: 'Chungbuk', lat: 36.6357, lon: 127.4917 },
  { code: '34', name: 'Chungnam', lat: 36.5184, lon: 126.8 },
  { code: '35', name: 'Jeonbuk', lat: 35.8203, lon: 127.1089 },
  { code: '36', name: 'Jeonnam', lat: 34.8161, lon: 126.4629 },
  { code: '37', name: 'Gyeongbuk', lat: 36.4919, lon: 128.8889 },
  { code: '38', name: 'Gyeongnam', lat: 35.4606, lon: 128.2132 },
  { code: '39', name: 'Jeju', lat: 33.489, lon: 126.4983 },
];

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getNearestRegions(lat: number, lon: number, count = 2) {
  return regionCenters
    .map((r) => ({ ...r, dist: haversineDistance(lat, lon, r.lat, r.lon) }))
    .sort((a, b) => a.dist - b.dist)
    .slice(0, count);
}

const SYSTEM_PROMPT = `You are a Korean publishing curation expert.
Return exactly 12 Korean-language recommended books for the user's keyword.
Output must be strict JSON array only:
[
  { "title": "Book title", "author": "Author" }
]`;

function cleanTitle(title: string): string {
  let cleaned = title.replace(/\s*\(.*?\)\s*/g, '').trim();
  cleaned = cleaned.replace(/\s*:.*$/, '').trim();
  return cleaned;
}

// AI 저자명과 DB 저자명의 토큰 일치 여부 확인
function authorMatches(aiAuthor: string, dbAuthors: string): boolean {
  if (!aiAuthor || !dbAuthors) return false;
  const aiTokens = normalizeText(aiAuthor)
    .split(/[\s,]+/)
    .filter((t) => t.length >= 2);
  const dbNorm = normalizeText(dbAuthors);
  return aiTokens.some((token) => dbNorm.includes(token));
}

// AI 추천 1건을 공공도서관 DB에서 검색해 가장 적합한 도서 반환
async function findBookInDB(
  locals: any,
  rec: { title: string; author: string }
): Promise<any | null> {
  const trySearch = async (keyword: string): Promise<any[]> => {
    try {
      const data = await fetchLibraryData(locals, 'srchBooks', {
        keyword,
        pageNo: 1,
        pageSize: 5,
      });
      if (data.response?.error) return [];
      const docs = data.response?.docs || [];
      return docs.map((d: any) => d.doc || d).filter((d: any) => d?.isbn13);
    } catch {
      return [];
    }
  };

  // 1차: cleanTitle로 검색 후 저자 일치 우선 선택
  const byTitle = await trySearch(cleanTitle(rec.title));
  if (byTitle.length > 0) {
    const matched = byTitle.find((d) => authorMatches(rec.author, d.authors ?? ''));
    if (matched) return matched;
    // 저자 일치 없어도 isbn13만 있으면 첫 결과 반환
    return byTitle[0];
  }

  // 2차: "제목 저자" 조합으로 재검색
  const byTitleAuthor = await trySearch(`${cleanTitle(rec.title)} ${rec.author}`);
  if (byTitleAuthor.length > 0) {
    const matched = byTitleAuthor.find((d) => authorMatches(rec.author, d.authors ?? ''));
    return matched ?? byTitleAuthor[0];
  }

  return null;
}

function normalizeIsbn(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/[^0-9Xx]/g, '').toUpperCase();
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return '';
  return String(value).replace(/\s+/g, ' ').trim().toLowerCase();
}

function getBookKey(book: any): string {
  const isbn = normalizeIsbn(book?.isbn13 || book?.isbn);
  if (isbn) return `isbn:${isbn}`;

  const title = normalizeText(book?.bookname || book?.bookName || book?.title);
  const author = normalizeText(book?.authors || book?.author);
  if (!title) return '';
  return `meta:${title}|${author}`;
}

function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label)), timeoutMs);
    promise
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

async function fetchLibraryData(
  locals: any,
  endpoint: string,
  params: Record<string, string | number | boolean | undefined>,
  timeoutMs = FETCH_TIMEOUT_MS
): Promise<any> {
  return fetchLibraryProxy(locals, `/v1/${endpoint}`, params, timeoutMs);
}

function getCacheRegionKey(lat: number, lon: number): string {
  if (Number.isNaN(lat) || Number.isNaN(lon)) return 'nogps';
  const nearest = getNearestRegions(lat, lon, 2);
  if (nearest.length === 0) return 'nogps';
  return nearest.map((r) => r.code).join('-');
}

function buildCacheKey(url: URL, keyword: string, lat: number, lon: number): string {
  const normalizedKeyword = keyword.trim().toLowerCase();
  const regionKey = getCacheRegionKey(lat, lon);
  return `${url.origin}/api/ai-search?keyword=${encodeURIComponent(normalizedKeyword)}&region=${regionKey}`;
}

export const GET: APIRoute = async ({ request, locals }) => {
  const url = new URL(request.url);
  const keyword = url.searchParams.get('keyword') || '';
  const lat = parseFloat(url.searchParams.get('lat') || '');
  const lon = parseFloat(url.searchParams.get('lon') || '');
  const nocache = url.searchParams.get('nocache') === '1';

  if (!keyword) {
    return jsonResponse({ error: 'keyword is required' }, 400);
  }

  const cacheKey = buildCacheKey(url, keyword, lat, lon);
  if (!nocache) {
    const cached = await getCachedResponse(cacheKey);
    if (cached) return cached;
  }

  const respondWithCache = async (payload: any) => {
    await setCachedResponse(cacheKey, payload, CACHE_TTL);
    return jsonResponse(payload);
  };

  try {
    console.log('[AI-Search] Step 1: VPS AI recommend request');
    const aiData = await withTimeout(
      fetchLibraryProxy(locals, '/v1/ai-recommend', { keyword }),
      OPENAI_TIMEOUT_MS,
      'AI recommend timeout'
    );

    const rawBooks = aiData?.books;
    let aiBooks: Array<{ title: string; author: string }>;
    try {
      aiBooks = Array.isArray(rawBooks) ? rawBooks : JSON.parse(rawBooks ?? '[]');
      if (!Array.isArray(aiBooks)) throw new Error('AI output is not array');
    } catch {
      console.error('[AI-Search] Failed to parse AI output:', rawBooks);
      return jsonResponse({ error: 'Failed to parse AI response' }, 500);
    }
    const aiSeen = new Set<string>();
    aiBooks = aiBooks
      .filter((item) => {
        const key = `meta:${normalizeText(item?.title)}|${normalizeText(item?.author)}`;
        if (!key || aiSeen.has(key)) return false;
        aiSeen.add(key);
        return true;
      })
      .slice(0, MAX_AI_BOOKS);

    console.log('[AI-Search] Step 2: Seed book lookup');
    const seedSearchResults = await Promise.all(
      aiBooks.slice(0, MAX_SEED_LOOKUPS).map((rec) => findBookInDB(locals, rec))
    );

    const seedBooks = seedSearchResults.filter((b: any) => b?.isbn13);
    if (seedBooks.length === 0) {
      return respondWithCache({
        mode: 'ai-only',
        recommendations: aiBooks,
        seedBook: null,
        regions: [],
      });
    }

    const primarySeed = seedBooks[0];
    const seedIsbns = seedBooks
      .slice(0, MAX_SEED_ISBNS)
      .map((b: any) => b.isbn13)
      .join(';');

    const seen = new Set<string>();
    const pushUniqueBook = (book: any) => {
      const key = getBookKey(book);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      allRecs.push(book);
      return true;
    };
    seedBooks.forEach((b: any) => {
      const key = getBookKey(b);
      if (key) seen.add(key);
    });
    const allRecs: any[] = [];

    console.log('[AI-Search] Step 3a: usageAnalysisList');
    try {
      const usageData = await fetchLibraryData(
        locals,
        'usageAnalysisList',
        { isbn13: primarySeed.isbn13 },
        3000
      );
      if (!usageData.response?.error) {
        const maniaRec = usageData.response?.maniaRecBooks || [];
        const readerRec = usageData.response?.readerRecBooks || [];
        const coLoan = usageData.response?.coLoanBooks || [];
        for (const item of [...maniaRec, ...readerRec, ...coLoan]) {
          const book = item.book || item;
          pushUniqueBook(book);
        }
      }
    } catch {
      // continue
    }

    if (allRecs.length < MAX_RETURN_BOOKS) {
      console.log('[AI-Search] Step 3b: recommandList');
      try {
        const [maniaData, readerData] = await Promise.all([
          fetchLibraryData(locals, 'recommandList', { isbn13: seedIsbns }).catch(() => ({})),
          fetchLibraryData(locals, 'recommandList', { isbn13: seedIsbns, type: 'reader' }).catch(() => ({})),
        ]);

        const maniaBooks = extractBooks(maniaData);
        const readerBooks = extractBooks(readerData);
        for (const book of [...maniaBooks, ...readerBooks]) {
          pushUniqueBook(book);
        }
      } catch {
        // continue
      }
    }

    if (allRecs.length === 0) {
      for (const book of seedBooks) pushUniqueBook(book);

      if (allRecs.length < MAX_RETURN_BOOKS) {
        const extraResults = await Promise.all(
          aiBooks.slice(seedBooks.length, MAX_RETURN_BOOKS).map(async (rec) => {
            try {
              const data = await fetchLibraryData(locals, 'srchBooks', {
                keyword: cleanTitle(rec.title),
                pageNo: 1,
                pageSize: 1,
              });
              const docs = data.response?.docs || [];
              return docs.length > 0 ? docs[0].doc : null;
            } catch {
              return null;
            }
          })
        );

        for (const book of extraResults) {
          if (book) pushUniqueBook(book);
        }
      }
    }

    if (allRecs.length === 0) {
      return respondWithCache({
        mode: 'ai-only',
        recommendations: aiBooks,
        seedBook: {
          bookname: primarySeed.bookname,
          authors: primarySeed.authors,
          isbn13: primarySeed.isbn13,
          bookImageURL: primarySeed.bookImageURL || '',
        },
        regions: [],
      });
    }

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return respondWithCache({
        mode: 'no-gps',
        seedBook: {
          bookname: primarySeed.bookname,
          authors: primarySeed.authors,
          isbn13: primarySeed.isbn13,
          bookImageURL: primarySeed.bookImageURL || '',
        },
        recommendations: allRecs.slice(0, MAX_RETURN_BOOKS).map((book) => ({ book, nearbyLibCount: 0 })),
        regions: [],
      });
    }

    const nearestRegions = getNearestRegions(lat, lon, 2);
    const booksToCheck = allRecs.slice(0, MAX_LIB_CHECK_BOOKS);

    console.log('[AI-Search] Step 5: library availability check');
    const libCheckResults = await Promise.all(
      booksToCheck.map(async (book) => {
        const isbn = book.isbn13 || book.isbn;
        if (!isbn) return { book, nearbyLibCount: 0 };
        try {
          const regionResults = await Promise.all(
            nearestRegions.map(async (r) => {
              try {
                const data = await fetchLibraryData(
                  locals,
                  'libSrchByBook',
                  { isbn, region: r.code },
                  2000
                );
                return (data.response?.libs || []).length;
              } catch {
                return 0;
              }
            })
          );
          return { book, nearbyLibCount: regionResults.reduce((a, b) => a + b, 0) };
        } catch {
          return { book, nearbyLibCount: 0 };
        }
      })
    );

    libCheckResults.sort((a, b) => b.nearbyLibCount - a.nearbyLibCount);

    return respondWithCache({
      mode: 'full',
      seedBook: {
        bookname: primarySeed.bookname,
        authors: primarySeed.authors,
        isbn13: primarySeed.isbn13,
        bookImageURL: primarySeed.bookImageURL || '',
        publisher: primarySeed.publisher || '',
        publication_year: primarySeed.publication_year || '',
      },
      recommendations: finalRecs,
      regions: nearestRegions.map((r) => r.name),
    });
  } catch (error: any) {
    console.error('[AI-Search] Fatal error:', error);
    return jsonResponse({ error: 'AI recommendation failed', detail: error?.message ?? String(error) }, 500);
  }
};
