import { error } from "@sveltejs/kit";
import { env } from "cloudflare:workers";
import { readOwnRanking } from "#lib/server/ballots.ts";
import { enterStep, entryErrorResponse } from "#lib/server/participation.ts";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, url }) => {
  const entry = await enterStep(locals, "thanks", url.searchParams.getAll("electionId"));
  if ("error" in entry) {
    const { status, message } = entryErrorResponse(entry.error);
    error(status, message);
  }

  const ranking = await readOwnRanking(env.DB, entry.election.id, entry.voterId);
  return { titleKey: entry.election.titleKey, blank: ranking.length === 0 };
}) satisfies PageServerLoad;
