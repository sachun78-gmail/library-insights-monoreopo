# library-insights monorepo

Astro 웹앱과 Fastify 서버를 한 저장소에서 관리하는 npm workspaces 모노레포입니다.

## Structure

```text
apps/
  web/        Astro + Tailwind + Cloudflare Pages
  server/     Fastify proxy server
```

## Prerequisites

- Node.js 18+
- npm

## Install

```bash
npm install
```

## Local Development

웹 + 서버 동시 실행:

```bash
npm run dev
```

개별 실행:

```bash
npm run dev:web
npm run dev:server
```

Cloudflare Pages 런타임 테스트(웹):

```bash
npm run dev:cf
```

## Build / Preview

```bash
npm run build
npm run preview
npm run preview:cf
```

## Local Health Checks

개발 서버 실행 후:

```bash
npm run check:server
npm run check:web
npm run check:local
```

웹 포트가 기본값(4321)과 다르면:

```bash
powershell -ExecutionPolicy Bypass -File scripts/check-web.ps1 -WebBaseUrl http://127.0.0.1:4322
```

## Environment Variables

- 웹: `apps/web/.env`, `apps/web/.dev.vars`
- 서버: `apps/server/.env` (템플릿: `apps/server/.env.example`)

배포용 템플릿:

- 웹: `apps/web/.env.production.example`
- 서버: `apps/server/.env.production.example`

서버 주요 키:

- `PORT` (기본 `8080`)
- `DATA4LIBRARY_API_KEY`
- `PROXY_SHARED_SECRET`

웹 주요 키:

- `LIB_PROXY_BASE_URL` (예: `http://127.0.0.1:8080` 또는 배포 서버 URL)
- `LIB_PROXY_SHARED_SECRET` (서버 `PROXY_SHARED_SECRET`와 동일)

## Notes

- 기존 루트 `.env`, `.dev.vars`는 유지됩니다. 현재 실행 경로 기준으로는 `apps/web` / `apps/server` 내부 파일을 우선 사용합니다.

## Troubleshooting

- `Library proxy not configured`
  - 원인: 웹에서 `LIB_PROXY_BASE_URL`, `LIB_PROXY_SHARED_SECRET`를 읽지 못함.
  - 조치: `apps/web/.env` 또는 `apps/web/.dev.vars`에 두 키를 추가하고 `npm run dev` 재시작.

- `Unauthorized` (web API 호출 시)
  - 원인: 웹 `LIB_PROXY_SHARED_SECRET`와 서버 `PROXY_SHARED_SECRET` 불일치.
  - 조치: `apps/web/.env`, `apps/web/.dev.vars`, `apps/server/.env` 값 동일하게 맞춘 뒤 재시작.

- env를 바꿨는데 반영이 안 됨
  - 원인: dev 프로세스가 이전 env를 유지 중.
  - 조치: 실행 중인 `npm run dev`를 완전히 종료 후 다시 실행.

## Production Deployment

- systemd service template: `deploy/systemd/bookreserch-server.service`
- nginx reverse proxy template: `deploy/nginx/bookreserch-server.conf`
- setup guide: `deploy/README.md`
