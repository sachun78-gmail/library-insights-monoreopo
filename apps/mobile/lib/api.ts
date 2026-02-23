const BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://localhost:4321";

const TIMEOUT_MS = 10_000;

type Params = Record<string, string | number | boolean | undefined | null>;

async function get(path: string, params: Params = {}): Promise<any> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value != null) {
      url.searchParams.set(key, String(value));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function post(path: string, body: Record<string, any>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function del(path: string, body: Record<string, any>): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`API error ${res.status} on ${path}`);
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  // ── 검색 ──
  search: (keyword: string, type: string, pageNo: number, pageSize = 20) =>
    get("/api/search", { keyword, type, pageNo, pageSize }),

  aiSearch: (keyword: string, lat?: number, lon?: number) =>
    get("/api/ai-search", { keyword, lat, lon }),

  // ── 홈 ──
  newArrivals: () => get("/api/new-arrivals"),
  monthlyRecommend: () => get("/api/monthly-recommend"),
  personalizedRecommend: (isbn13List: string) =>
    get("/api/personalized-recommend", { isbn13: isbn13List }),

  // ── 인기 도서 ──
  popularBooks: (params: {
    startDt?: string;
    endDt?: string;
    gender?: string;
    from_age?: string;
    to_age?: string;
    region?: string;
    pageNo?: number;
    pageSize?: number;
  }) => get("/api/popular-books", params),

  hotTrend: (searchDt?: string) => get("/api/hot-trend", { searchDt }),

  // ── 도서 상세 ──
  bookDetail: (isbn: string, title?: string) =>
    get("/api/book-detail", { isbn, title }),

  bookIntro: (isbn13: string) =>
    get("/api/book-intro", { isbn13 }).then(
      (res) => res?.response?.detail?.[0]?.book ?? null
    ),

  bookAIInsight: (title: string, author?: string) =>
    get("/api/book-ai-insight", { title, author }),

  // ── 도서관 검색 ──
  libraryByBook: (isbn: string, region: string) =>
    get("/api/library-by-book", { isbn, region }).then(
      (res) => (res?.response?.libs ?? []).map((item: any) => item.lib ?? item)
    ),

  bookExist: (isbn: string, region: string) =>
    get("/api/book-exist", { isbn, region }),

  // ── 북마크 ──
  bookmarks: (userId: string) =>
    get("/api/bookmarks", { userId }).then((res) => res?.bookmarks ?? []),

  addBookmark: (userId: string, book: {
    isbn13: string;
    bookname: string;
    authors: string;
    publisher: string;
    publication_year: string;
    bookImageURL: string;
  }) =>
    post("/api/bookmarks", {
      userId,
      isbn13: book.isbn13,
      bookname: book.bookname,
      authors: book.authors,
      publisher: book.publisher,
      publication_year: book.publication_year,
      book_image_url: book.bookImageURL,
    }),

  removeBookmark: (userId: string, isbn13: string) =>
    del("/api/bookmarks", { userId, isbn13 }),

  // ── 프로필 ──
  profile: (userId: string) =>
    get("/api/profile", { userId }).then((res) => res?.profile ?? null),

  updateProfile: (userId: string, data: {
    birth_date?: string;
    gender?: string;
    region_code?: string;
    region_name?: string;
  }) =>
    post("/api/profile", { userId, ...data }).then((res) => res?.profile ?? null),

  deleteAccount: (userId: string) =>
    post("/api/delete-account", { userId }),
};
