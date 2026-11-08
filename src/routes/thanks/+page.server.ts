import { error } from "@sveltejs/kit";
import { enterStep, entryErrorResponse } from "#lib/server/participation.ts";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, url }) => {
  const entry = await enterStep(locals, "thanks", url.searchParams.getAll("electionId"));
  if ("error" in entry) {
    const { status, message } = entryErrorResponse(entry.error);
    error(status, message);
  }
  return { titleKey: entry.election.titleKey, blank: entry.ranked.length === 0 };
}) satisfies PageServerLoad;
