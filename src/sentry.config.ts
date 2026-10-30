import * as env from "$app/env/public";

// Shared by the browser and the Worker.
export const dsn = env.SENTRY_DSN || undefined;
export const environment = env.SENTRY_ENVIRONMENT;
export const tracesSampleRate = env.SENTRY_TRACES_SAMPLE_RATE;
export const enableLogs = true;

// Reports must never carry a ballot or tie it to a voter: ballot POST bodies hold the ranking, and
// the session cookie and forwarded IP headers identify the voter.
export const dataCollection = {
  userInfo: false,
  cookies: false,
  httpHeaders: false,
  httpBodies: [],
};
