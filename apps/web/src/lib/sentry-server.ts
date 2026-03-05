import * as Sentry from "@sentry/cloudflare";

let initialized = false;

export function initSentry(env: Record<string, string | undefined>): void {
  const dsn = env.SENTRY_DSN;
  if (!dsn || initialized) return;
  Sentry.init({
    dsn,
    tracesSampleRate: 0.2,
  });
  initialized = true;
}

export function captureException(error: unknown): void {
  if (!initialized) return;
  Sentry.captureException(error);
}
