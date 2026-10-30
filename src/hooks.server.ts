// The Workers build of @sentry/sveltekit doesn't re-export this, despite its types.
import { consoleLoggingIntegration } from "@sentry/cloudflare";
import * as Sentry from "@sentry/sveltekit";
import { building } from "$app/env";
import { SESSION_SECRET } from "$app/env/private";
import { privateResponse } from "#lib/server/private-response.ts";
import { readVoter } from "#lib/server/voter-session.ts";
import { type Handle, sequence } from "@sveltejs/kit/hooks";
import { getTextDirection } from "#lib/paraglide/runtime.js";
import { paraglideMiddleware } from "#lib/paraglide/server.js";
import * as config from "./sentry.config";

const handleParaglide: Handle = ({ event, resolve }) =>
  paraglideMiddleware(event.request, ({ request, locale }) => {
    return resolve(
      { ...event, request },
      {
        transformPageChunk: ({ html }) =>
          html
            .replace("%paraglide.lang%", locale)
            .replace("%paraglide.dir%", getTextDirection(locale)),
      },
    );
  });

const handleVoter: Handle = async ({ event, resolve }) => {
  if (!building) {
    const voter = await readVoter(event.cookies, SESSION_SECRET, new Date());
    if (voter !== null) event.locals.voter = voter.id;
  }
  return resolve(event);
};

const handlePrivateResponse: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  return building ? response : privateResponse(response);
};

export const handleError = Sentry.handleErrorWithSentry();

// On Workers there is no long-lived process to init Sentry in: the Cloudflare handle inits it per
// request and must come before sentryHandle().
export const handle: Handle = sequence(
  Sentry.initCloudflareSentryHandle({ ...config, integrations: [consoleLoggingIntegration()] }),
  Sentry.sentryHandle(),
  handlePrivateResponse,
  handleParaglide,
  handleVoter,
);
