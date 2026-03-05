import * as Sentry from "@sentry/browser";

const DSN = (import.meta as any).env?.PUBLIC_SENTRY_DSN as string | undefined;

if (DSN) {
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.2,
  });
}

export function captureException(error: unknown): void {
  if (!DSN) return;
  Sentry.captureException(error);
}
