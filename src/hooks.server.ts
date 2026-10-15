import { building } from "$app/env";
import {
  ORIGIN,
  BETTER_AUTH_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from "$app/env/private";
import { env } from "cloudflare:workers";
import { createAuth } from "#lib/server/auth.ts";
import { privateResponse } from "#lib/server/private-response.ts";
import { svelteKitHandler } from "better-auth/svelte-kit";
import { type Handle, sequence } from "@sveltejs/kit/hooks";
import { getTextDirection } from "#lib/paraglide/runtime.js";
import { paraglideMiddleware } from "#lib/paraglide/server.js";

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

const handleBetterAuth: Handle = async ({ event, resolve }) => {
  if (building) return resolve(event);

  const auth = createAuth(env.DB, {
    origin: ORIGIN,
    secret: BETTER_AUTH_SECRET,
    googleClientId: GOOGLE_CLIENT_ID,
    googleClientSecret: GOOGLE_CLIENT_SECRET,
  });
  event.locals.auth = auth;

  const session = await auth.api.getSession({ headers: event.request.headers });

  if (session) {
    event.locals.session = session.session;
    event.locals.user = session.user;
  }

  return svelteKitHandler({ event, resolve, auth, building });
};

const handlePrivateResponse: Handle = async ({ event, resolve }) => {
  const response = await resolve(event);
  return building ? response : privateResponse(response);
};

export const handle: Handle = sequence(handlePrivateResponse, handleParaglide, handleBetterAuth);
