import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';

const TEST_SECRET = 'test-secret-key';

async function buildApp() {
  const app = Fastify({ logger: false });

  await app.register(cors, { origin: true });
  await app.register(rateLimit, { global: true, max: 120, timeWindow: 60_000 });

  const ALLOWED_ENDPOINTS = new Set([
    'srchBooks', 'srchDtlList', 'bookExist', 'libSrchByBook',
    'loanItemSrch', 'hotTrend', 'monthlyKeywords', 'recommandList', 'usageAnalysisList',
  ]);

  app.get('/healthz', async () => ({ ok: true }));

  app.get<{ Params: { endpoint: string } }>(
    '/v1/:endpoint',
    {
      preHandler: async (req, reply) => {
        const key = Array.isArray(req.headers['x-proxy-key'])
          ? req.headers['x-proxy-key'][0]
          : req.headers['x-proxy-key'];
        if ((key ?? '').trim() !== TEST_SECRET) {
          return reply.code(401).send({ error: 'Unauthorized' });
        }
      },
    },
    async (req, reply) => {
      const { endpoint } = req.params;
      if (!ALLOWED_ENDPOINTS.has(endpoint)) {
        return reply.code(404).send({ error: 'Not found' });
      }
      return reply.send({ ok: true, endpoint });
    }
  );

  return app;
}

describe('Proxy API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('인증', () => {
    it('x-proxy-key 없으면 401을 반환한다', async () => {
      const res = await app.inject({ method: 'GET', url: '/v1/srchBooks' });
      expect(res.statusCode).toBe(401);
    });

    it('잘못된 x-proxy-key면 401을 반환한다', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/srchBooks',
        headers: { 'x-proxy-key': 'wrong-key' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('올바른 x-proxy-key면 통과한다', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/srchBooks',
        headers: { 'x-proxy-key': TEST_SECRET },
      });
      expect(res.statusCode).not.toBe(401);
    });
  });

  describe('엔드포인트 허용 목록', () => {
    it('허용된 엔드포인트는 통과한다', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/hotTrend',
        headers: { 'x-proxy-key': TEST_SECRET },
      });
      expect(res.statusCode).not.toBe(404);
    });

    it('허용되지 않은 엔드포인트는 404를 반환한다', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/v1/deleteAll',
        headers: { 'x-proxy-key': TEST_SECRET },
      });
      expect(res.statusCode).toBe(404);
    });
  });
});
