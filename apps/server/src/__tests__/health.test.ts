import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';

// 최소 서버 인스턴스 (환경변수 없이 healthz만 테스트)
async function buildApp() {
  const app = Fastify();
  app.get('/healthz', { config: { rateLimit: false } }, async () => ({ ok: true }));
  return app;
}

describe('GET /healthz', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('200 OK와 { ok: true }를 반환한다', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true });
  });
});
