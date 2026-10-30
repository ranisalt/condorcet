import { building } from "$app/env";
import { SESSION_SECRET } from "$app/env/private";
import { privateResponse } from "#lib/server/private-response.ts";
import { readVoter } from "#lib/server/voter-session.ts";
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

export const handle: Handle = sequence(handlePrivateResponse, handleParaglide, handleVoter);
