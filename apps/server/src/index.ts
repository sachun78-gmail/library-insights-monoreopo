import Fastify from "fastify";
import dotenv from "dotenv";

// Prefer service-specific env file, then fall back to repository-root .env.
dotenv.config({ path: "apps/server/.env" });
dotenv.config();

const app = Fastify({ logger: true });

const {
  HOST = "127.0.0.1",
  PORT = "8080",
  DATA4LIBRARY_API_KEY,
  PROXY_SHARED_SECRET,
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
]);

const API_BASE = "https://data4library.kr/api";

app.get("/healthz", async () => ({ ok: true }));

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
