import { defineMiddleware } from "astro:middleware";
import { initSentry, captureException } from "./lib/sentry-server";

export const onRequest = defineMiddleware(async (context, next) => {
  const env = (context.locals as any)?.runtime?.env ?? import.meta.env;
  initSentry(env);

  try {
    return await next();
  } catch (error) {
    captureException(error);
    throw error;
  }
});
