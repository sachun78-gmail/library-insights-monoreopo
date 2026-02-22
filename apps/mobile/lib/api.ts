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
    if (!res.ok) {
      throw new Error(`API error ${res.status} on ${path}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  search: (keyword: string, type: string, pageNo: number, pageSize = 20) =>
    get("/api/search", { keyword, type, pageNo, pageSize }),

  aiSearch: (keyword: string, lat?: number, lon?: number) =>
    get("/api/ai-search", { keyword, lat, lon }),

  newArrivals: () => get("/api/new-arrivals"),

  monthlyRecommend: () => get("/api/monthly-recommend"),

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

  bookDetail: (isbn: string, title?: string) =>
    get("/api/book-detail", { isbn, title }),

  bookAIInsight: (title: string, author?: string) =>
    get("/api/book-ai-insight", { title, author }),
};
