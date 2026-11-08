import { RESULTS_THRESHOLD } from "$app/env/private";
import { env } from "cloudflare:workers";
import { requireCurrentElection } from "#lib/server/election.ts";
import { readResults } from "#lib/server/results.ts";
import { methodIds } from "#lib/voting-methods.ts";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, url }) => {
  const election = requireCurrentElection();

  const view = await readResults(env.DB, election, locals.voter ?? null, RESULTS_THRESHOLD);
  if (view.state === "locked") {
    return {
      view: { ...view, election: { titleKey: election.titleKey } },
    };
  }

  const requestedMethod = url.searchParams.get("method");
  return {
    view: {
      ...view,
      method: methodIds.find((id) => id === requestedMethod) ?? "copeland",
      election: {
        titleKey: election.titleKey,
        candidates: election.candidates,
      },
    },
  };
}) satisfies PageServerLoad;
