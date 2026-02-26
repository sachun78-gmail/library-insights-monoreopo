import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import dotenv from "dotenv";
import OpenAI from "openai";

// Prefer service-specific env file, then fall back to repository-root .env.
dotenv.config({ path: "apps/server/.env" });
dotenv.config();

const app = Fastify({ logger: true });

const {
  HOST = "127.0.0.1",
  PORT = "8080",
  DATA4LIBRARY_API_KEY,
  PROXY_SHARED_SECRET,
  OPENAI_API_KEY,
} = process.env;

if (!DATA4LIBRARY_API_KEY) {
  throw new Error("DATA4LIBRARY_API_KEY is required");
}

if (!PROXY_SHARED_SECRET) {
  throw new Error("PROXY_SHARED_SECRET is required");
}

// CORS: 브라우저 직접 접근 차단 (서버는 Cloudflare Workers에서만 호출됨)
const ALLOWED_ORIGINS = [
  "https://library-insights.work",
  "https://www.library-insights.work",
];
await app.register(cors, {
  origin: (origin, cb) => {
    // origin이 없으면 서버-서버 요청 (Cloudflare Workers 등) → 허용
    if (!origin) return cb(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error("CORS: origin not allowed"), false);
  },
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "x-proxy-key"],
});

// Rate limiting: IP 기반, 엔드포인트별로 다른 제한 적용
await app.register(rateLimit, {
  global: true,
  max: 120,          // 기본: IP당 분당 120 요청
  timeWindow: 60_000,
  errorResponseBuilder: () => ({
    error: "Too Many Requests",
    message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
  }),
});

const ALLOWED_ENDPOINTS = new Set([
  "srchBooks",
  "srchDtlList",
  "bookExist",
  "libSrchByBook",
  "loanItemSrch",
  "hotTrend",
  "monthlyKeywords",
  "recommandList",
  "usageAnalysisList",
]);

const API_BASE = "https://data4library.kr/api";

app.get("/healthz", { config: { rateLimit: false } }, async () => ({ ok: true }));

const AI_RECOMMEND_PROMPT = `You are a Korean publishing curation expert.
Return exactly 12 Korean-language recommended books for the user's keyword.
Output must be strict JSON array only:
[
  { "title": "Book title", "author": "Author" }
]`;

const AI_INSIGHT_PROMPT = `너는 전 세계 출판 트렌드와 독자들의 니즈를 꿰뚫고 있는 '글로벌 북 큐레이션 전문가'야
입력으로 받은 도서에 대해서 아래 정보를 줘
1. 3줄 요약
2. 핵심 메시지
3. 이런 사람에게 추천
4. 난이도 평가

반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마.
{
  "summary": "3줄 요약 텍스트",
  "keyMessage": "핵심 메시지 텍스트",
  "recommendFor": "이런 사람에게 추천 텍스트",
  "difficulty": "난이도 평가 텍스트"
}`;

// AI 도서 추천 — IP당 분당 10 요청 (OpenAI 비용 절감)
app.get<{ Querystring: { keyword?: string } }>(
  "/v1/ai-recommend",
  {
    config: { rateLimit: { max: 10, timeWindow: 60_000 } },
    preHandler: async (req, reply) => {
      const headerValue = req.headers["x-proxy-key"];
      const requestKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      if ((requestKey ?? "").trim() !== PROXY_SHARED_SECRET!.trim()) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    },
  },
  async (req, reply) => {
    const { keyword } = req.query;
    if (!keyword) return reply.code(400).send({ error: "keyword is required" });
    if (!OPENAI_API_KEY) return reply.code(500).send({ error: "AI not configured" });

    try {
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: AI_RECOMMEND_PROMPT },
          { role: "user", content: keyword },
        ],
        temperature: 0,
        max_tokens: 420,
      });
      const content = response.choices[0].message.content ?? "[]";
      const books = JSON.parse(content);
      return reply.send({ books });
    } catch (err: any) {
      req.log.error(err);
      return reply.code(500).send({ error: "AI recommend failed" });
    }
  }
);

// AI 도서 인사이트 — IP당 분당 20 요청
app.get<{ Querystring: { title?: string; author?: string; isbn13?: string } }>(
  "/v1/ai-insight",
  {
    config: { rateLimit: { max: 20, timeWindow: 60_000 } },
    preHandler: async (req, reply) => {
      const headerValue = req.headers["x-proxy-key"];
      const requestKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      if ((requestKey ?? "").trim() !== PROXY_SHARED_SECRET!.trim()) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    },
  },
  async (req, reply) => {
    const { title, author } = req.query;
    if (!title) return reply.code(400).send({ error: "title is required" });
    if (!OPENAI_API_KEY) return reply.code(500).send({ error: "AI not configured" });

    try {
      const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
      const userInput = author ? `${title} (${author})` : title;
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: AI_INSIGHT_PROMPT },
          { role: "user", content: userInput },
        ],
        temperature: 0.7,
        max_tokens: 1024,
        response_format: { type: "json_object" },
      });
      const content = response.choices[0].message.content ?? "{}";
      const insight = JSON.parse(content);
      return reply.send({ insight });
    } catch (err: any) {
      req.log.error(err);
      return reply.code(500).send({ error: "AI insight failed" });
    }
  }
);

app.get<{ Params: { endpoint: string }; Querystring: Record<string, unknown> }>(
  "/v1/:endpoint",
  {
    preHandler: async (req, reply) => {
      const headerValue = req.headers["x-proxy-key"];
      const requestKey = Array.isArray(headerValue) ? headerValue[0] : headerValue;
      if ((requestKey ?? "").trim() !== PROXY_SHARED_SECRET.trim()) {
        return reply.code(401).send({ error: "Unauthorized" });
      }
    },
  },
  async (req, reply) => {
    const { endpoint } = req.params;

    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
      return reply.code(404).send({ error: "Not found" });
    }

    const q = new URLSearchParams();
    q.set("authKey", DATA4LIBRARY_API_KEY);
    q.set("format", "json");

    for (const [k, v] of Object.entries(req.query || {})) {
      if (v !== undefined && v !== null) {
        q.set(k, String(v));
      }
    }

    const url = `${API_BASE}/${endpoint}?${q.toString()}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const res = await fetch(url, { signal: controller.signal });
      const body = await res.text();

      return reply
        .header("Content-Type", "application/json; charset=utf-8")
        .code(res.status)
        .send(body);
    } catch (err) {
      req.log.error(err);
      return reply.code(502).send({ error: "Upstream error" });
    } finally {
      clearTimeout(timeoutId);
    }
  },
);

await app.listen({ port: Number(PORT), host: HOST });
