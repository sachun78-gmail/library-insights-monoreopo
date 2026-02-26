import Fastify from "fastify";
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

app.get("/healthz", async () => ({ ok: true }));

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

// AI 도서 추천
app.get<{ Querystring: { keyword?: string } }>(
  "/v1/ai-recommend",
  {
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
    if (!OPENAI_API_KEY) return reply.code(500).send({ error: "OpenAI not configured" });

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
      return reply.code(500).send({ error: "AI recommend failed", detail: err?.message });
    }
  }
);

// AI 도서 인사이트
app.get<{ Querystring: { title?: string; author?: string; isbn13?: string } }>(
  "/v1/ai-insight",
  {
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
    if (!OPENAI_API_KEY) return reply.code(500).send({ error: "OpenAI not configured" });

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
      return reply.code(500).send({ error: "AI insight failed", detail: err?.message });
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
