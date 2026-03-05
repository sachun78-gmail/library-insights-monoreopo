import * as Sentry from "@sentry/node";

const DSN = process.env.SENTRY_DSN;

export function initSentry(): void {
  if (!DSN) return;
  Sentry.init({
    dsn: DSN,
    environment: process.env.NODE_ENV || "production",
    tracesSampleRate: 0.2,
  });
}

export function captureException(error: unknown): void {
  if (!DSN) return;
  Sentry.captureException(error);
}
