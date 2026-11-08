import { fail, redirect } from "@sveltejs/kit";
import { isElectionOpen, shuffle } from "#lib/election.ts";
import { submitBallotForm, type BallotSubmission } from "#lib/server/ballot-submission.ts";
import { enterStep } from "#lib/server/participation.ts";
import type { Actions, PageServerLoad } from "./$types";

function failure(result: Exclude<BallotSubmission, { electionId: string }>) {
  const { status, ...data } = result;
  return fail(status, data);
}

export const load = (async ({ locals }) => {
  if (locals.voter === undefined) return { signedIn: false as const };
  const { election, ranked } = await enterStep(locals, "ballot");
  return {
    signedIn: true as const,
    election,
    open: isElectionOpen(election, new Date()),
    draft: { ranked, order: shuffle(election.candidates.map((candidate) => candidate.id)) },
  };
}) satisfies PageServerLoad;

export const actions = {
  edit: async ({ locals, request }) => {
    const result = await submitBallotForm(locals, await request.formData(), "edit", new Date());
    if ("error" in result) return failure(result);
    return { draft: result.draft };
  },
  save: async ({ locals, request }) => {
    const result = await submitBallotForm(locals, await request.formData(), "save", new Date());
    if ("error" in result) return failure(result);
    redirect(303, `/thanks?electionId=${result.electionId}`);
  },
} satisfies Actions;
