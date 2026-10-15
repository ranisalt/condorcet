import { fail, redirect } from "@sveltejs/kit";
import { isAPIError } from "better-auth/api";
import { env } from "cloudflare:workers";
import { currentElection } from "#lib/server/election.ts";
import { readElectionCounts } from "#lib/server/ballots.ts";
import { isElectionOpen } from "#lib/election.ts";
import type { Actions, PageServerLoad } from "./$types";

export const load = (async ({ locals, url }) => {
  const election = currentElection;
  if (election === null) {
    return {
      election: null,
      open: false,
      validCount: 0,
      signedIn: locals.user !== undefined,
      loginError: url.searchParams.get("loginError") === "1",
    };
  }

  const { validCount } = await readElectionCounts(env.DB, election.id);
  return {
    election: {
      id: election.id,
      titleKey: election.titleKey,
      closesAt: election.closesAt,
      resultsThreshold: election.resultsThreshold,
    },
    open: isElectionOpen(election, new Date()),
    validCount,
    signedIn: locals.user !== undefined,
    loginError: url.searchParams.get("loginError") === "1",
  };
}) satisfies PageServerLoad;

export const actions = {
  login: async ({ locals, request }) => {
    let result: Awaited<ReturnType<typeof locals.auth.api.signInSocial>>;
    try {
      result = await locals.auth.api.signInSocial({
        body: {
          provider: "google",
          callbackURL: "/ballot",
          errorCallbackURL: "/?loginError=1",
        },
        headers: request.headers,
      });
    } catch (cause) {
      if (isAPIError(cause)) return fail(502, { loginFailed: true });
      throw cause;
    }

    if (!result.url) return fail(502, { loginFailed: true });
    redirect(303, result.url, { external: ["https://accounts.google.com"] });
  },
  logout: async ({ locals, request }) => {
    await locals.auth.api.signOut({ headers: request.headers });
    redirect(303, "/");
  },
} satisfies Actions;
