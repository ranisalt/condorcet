import { fail, redirect } from "@sveltejs/kit";
import { RESULTS_THRESHOLD } from "$app/env/private";
import { env } from "cloudflare:workers";
import { currentElection } from "#lib/server/election.ts";
import { readElectionCounts } from "#lib/server/ballots.ts";
import { oidcConfigFor } from "#lib/server/oidc-config.ts";
import { beginLogin } from "#lib/server/oidc.ts";
import { clearVoter } from "#lib/server/voter-session.ts";
import { isElectionOpen } from "#lib/election.ts";
import type { Actions, PageServerLoad } from "./$types";

export const load = (async ({ locals, url }) => {
  const election = currentElection;
  if (election === null) {
    return {
      election: null,
      open: false,
      validCount: 0,
      signedIn: locals.voter !== undefined,
      loginError: url.searchParams.get("loginError") === "1",
    };
  }

  const { validCount } = await readElectionCounts(env.DB, election.id);
  return {
    election: {
      id: election.id,
      titleKey: election.titleKey,
      closesAt: election.closesAt,
      resultsThreshold: RESULTS_THRESHOLD,
    },
    open: isElectionOpen(election, new Date()),
    validCount,
    signedIn: locals.voter !== undefined,
    loginError: url.searchParams.get("loginError") === "1",
  };
}) satisfies PageServerLoad;

export const actions = {
  login: async ({ url, cookies }) => {
    let authorizeUrl: URL;
    try {
      authorizeUrl = await beginLogin(oidcConfigFor(url), cookies, new Date());
    } catch {
      return fail(502, { loginFailed: true });
    }
    redirect(303, authorizeUrl.href, { external: [authorizeUrl.origin] });
  },
  logout: async ({ url, cookies }) => {
    clearVoter(cookies, url.protocol === "https:");
    redirect(303, "/");
  },
} satisfies Actions;
