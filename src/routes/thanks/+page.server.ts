import { error } from "@sveltejs/kit";
import { env } from "cloudflare:workers";
import { m } from "#lib/paraglide/messages.js";
import { readOwnRanking } from "#lib/server/ballots.ts";
import { enterStep } from "#lib/server/participation.ts";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, url }) => {
  const entry = await enterStep(locals, "thanks", url.searchParams.getAll("electionId"));
  if ("error" in entry) {
    if (entry.error === "stale") error(409, m.stale_election());
    error(400, m.invalid_election_link());
  }

  const ranking = await readOwnRanking(env.DB, entry.election.id, entry.voterId);
  return { blank: ranking.length === 0 };
}) satisfies PageServerLoad;
