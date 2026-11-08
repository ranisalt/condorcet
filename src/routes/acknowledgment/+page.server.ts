import { fail, redirect } from "@sveltejs/kit";
import { env } from "cloudflare:workers";
import { acknowledgeElection } from "#lib/server/ballots.ts";
import { enterStep, entryErrorResponse } from "#lib/server/participation.ts";
import type { Actions, PageServerLoad } from "./$types";

export const load = (async ({ locals }) => {
  const { election } = await enterStep(locals, "acknowledgment");
  return { election: { id: election.id, titleKey: election.titleKey } };
}) satisfies PageServerLoad;

export const actions = {
  default: async ({ locals, request }) => {
    const form = await request.formData();
    const entry = await enterStep(locals, "acknowledgment", form.getAll("electionId"));
    if ("error" in entry) {
      const { status, message } = entryErrorResponse(entry.error);
      return fail(status, { message });
    }

    const acknowledgments = form.getAll("acknowledged");
    if (acknowledgments.length !== 1 || acknowledgments[0] !== "yes") {
      return fail(400, { required: true });
    }

    await acknowledgeElection(env.DB, entry.election.id, entry.voterId, new Date());
    redirect(303, "/ballot");
  },
} satisfies Actions;
