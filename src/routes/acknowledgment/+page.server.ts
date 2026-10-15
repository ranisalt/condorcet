import { error, fail, redirect } from "@sveltejs/kit";
import { env } from "cloudflare:workers";
import { m } from "#lib/paraglide/messages.js";
import { currentElection } from "#lib/server/election.ts";
import { acknowledgeElection, readParticipation } from "#lib/server/ballots.ts";
import type { Actions, PageServerLoad } from "./$types";

export const load = (async ({ locals }) => {
  if (locals.user === undefined) redirect(303, "/");
  const election = currentElection;
  if (election === null) error(404, m.no_election());

  const participation = await readParticipation(env.DB, election.id, locals.user.id);
  if (participation !== null) redirect(303, "/ballot");
  return { election: { id: election.id, titleKey: election.titleKey } };
}) satisfies PageServerLoad;

export const actions = {
  default: async ({ locals, request }) => {
    if (locals.user === undefined) redirect(303, "/");
    const election = currentElection;
    if (election === null) error(404, m.no_election());

    const form = await request.formData();
    const electionIds = form.getAll("electionId");
    if (electionIds.length !== 1 || typeof electionIds[0] !== "string") {
      return fail(400, { invalid: true });
    }
    if (electionIds[0] !== election.id) return fail(409, { stale: true });

    const acknowledgments = form.getAll("acknowledged");
    if (acknowledgments.length !== 1 || acknowledgments[0] !== "yes") {
      return fail(400, { required: true });
    }

    await acknowledgeElection(env.DB, election.id, locals.user.id, new Date());
    redirect(303, "/ballot");
  },
} satisfies Actions;
