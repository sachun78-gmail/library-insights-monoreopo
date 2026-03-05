let Sentry: any = null;
let initialized = false;

export async function initSentry(env: Record<string, string | undefined>): Promise<void> {
  const dsn = env.SENTRY_DSN;
  if (!dsn || initialized) return;
  try {
    Sentry = await import("@sentry/cloudflare");
    Sentry.init({
      dsn,
      tracesSampleRate: 0.2,
    });
    initialized = true;
  } catch {
    // @sentry/cloudflare는 Cloudflare 런타임에서만 동작 — 로컬 dev에서는 무시
  }
}

export function captureException(error: unknown): void {
  if (!initialized || !Sentry) return;
  Sentry.captureException(error);
}
