import { redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { SESSION_SECRET } from "$app/env/private";
import { oidcConfigFor } from "#lib/server/oidc-config.ts";
import { completeLogin, LoginError } from "#lib/server/oidc.ts";
import { writeVoter } from "#lib/server/voter-session.ts";

export const GET = (async ({ url, cookies, fetch }) => {
  const now = new Date();
  const config = oidcConfigFor(url);
  try {
    const voterId = await completeLogin(config, cookies, url, fetch, now);
    await writeVoter(cookies, SESSION_SECRET, voterId, now, config.secure);
  } catch (cause) {
    // Provider details are never echoed to the user or logged; the page shows a generic message.
    if (cause instanceof LoginError) redirect(303, "/?loginError=1");
    throw cause;
  }
  redirect(303, "/ballot");
}) satisfies RequestHandler;
