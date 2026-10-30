import { fail, redirect } from "@sveltejs/kit";
import { env } from "cloudflare:workers";
import {
  editDraft,
  InvalidBallotError,
  isElectionOpen,
  parseDraft,
  parseDraftEdit,
  shuffle,
} from "#lib/election.ts";
import type { BallotDraft } from "#lib/election.ts";
import { readOwnRanking, replaceBallot } from "#lib/server/ballots.ts";
import { enterStep, type JourneyEntry } from "#lib/server/participation.ts";
import type { Actions, PageServerLoad } from "./$types";

type GuardError = "invalid" | "closed" | "stale";

async function guardBallotPost(
  locals: App.Locals,
  form: FormData,
): Promise<JourneyEntry | { error: GuardError }> {
  const entry = await enterStep(locals, "ballot", form.getAll("electionId"));
  if ("error" in entry) return entry;
  if (!isElectionOpen(entry.election, new Date())) return { error: "closed" };
  return entry;
}

function errorResponse(reason: GuardError) {
  if (reason === "stale") return fail(409, { error: "stale" });
  if (reason === "closed") return fail(403, { error: "closed" });
  return fail(400, { error: "invalid" });
}

export const load = (async ({ locals }) => {
  const { election, voterId } = await enterStep(locals, "ballot");

  const ranked = await readOwnRanking(env.DB, election.id, voterId);
  return {
    election,
    open: isElectionOpen(election, new Date()),
    draft: { ranked, order: shuffle(election.candidates.map((candidate) => candidate.id)) },
  };
}) satisfies PageServerLoad;

export const actions = {
  edit: async ({ locals, request }) => {
    const form = await request.formData();
    const guard = await guardBallotPost(locals, form);
    if ("error" in guard) return errorResponse(guard.error);

    let draft: BallotDraft;
    try {
      draft = parseDraft(form, guard.election);
      const operationValues = form.getAll("operation");
      if (operationValues.length !== 1)
        throw new InvalidBallotError("Edit operation is missing or duplicated");
      const edit = parseDraftEdit(operationValues[0] ?? null, guard.election.candidates);
      return { draft: editDraft(draft, edit) };
    } catch (cause) {
      if (cause instanceof InvalidBallotError) return fail(400, { error: "invalid" });
      throw cause;
    }
  },
  save: async ({ locals, request }) => {
    const form = await request.formData();
    const guard = await guardBallotPost(locals, form);
    if ("error" in guard) return errorResponse(guard.error);

    let draft: BallotDraft;
    try {
      draft = parseDraft(form, guard.election);
    } catch (cause) {
      if (cause instanceof InvalidBallotError) return fail(400, { error: "invalid" });
      throw cause;
    }

    try {
      await replaceBallot(env.DB, guard.election.id, guard.voterId, draft.ranked, new Date());
    } catch {
      return fail(503, { error: "save", draft });
    }

    redirect(303, `/thanks?electionId=${guard.election.id}`);
  },
} satisfies Actions;
