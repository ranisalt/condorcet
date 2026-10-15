import { error, fail, redirect } from "@sveltejs/kit";
import { env } from "cloudflare:workers";
import { m } from "#lib/paraglide/messages.js";
import {
  editDraft,
  InvalidBallotError,
  isElectionOpen,
  parseDraft,
  parseDraftEdit,
  shuffle,
} from "#lib/election.ts";
import type { BallotDraft, Election } from "#lib/election.ts";
import { currentElection } from "#lib/server/election.ts";
import { readOwnRanking, readParticipation, replaceBallot } from "#lib/server/ballots.ts";
import type { Actions, PageServerLoad } from "./$types";

type BallotActionError = "invalid" | "closed" | "stale" | "save";
type PostGuard =
  { election: Election; userId: string } | { error: Exclude<BallotActionError, "save"> };

async function guardBallotPost(locals: App.Locals, form: FormData): Promise<PostGuard> {
  if (locals.user === undefined) redirect(303, "/");
  const election = currentElection;
  if (election === null) error(404, m.no_election());

  const electionIds = form.getAll("electionId");
  if (electionIds.length !== 1 || typeof electionIds[0] !== "string") {
    return { error: "invalid" };
  }
  if (electionIds[0] !== election.id) return { error: "stale" };

  const participation = await readParticipation(env.DB, election.id, locals.user.id);
  if (participation === null) redirect(303, "/acknowledgment");
  if (!isElectionOpen(election, new Date())) return { error: "closed" };

  return { election, userId: locals.user.id };
}

function errorResponse(reason: Exclude<BallotActionError, "save">) {
  if (reason === "stale") return fail(409, { error: "stale" });
  if (reason === "closed") return fail(403, { error: "closed" });
  return fail(400, { error: "invalid" });
}

export const load = (async ({ locals }) => {
  if (locals.user === undefined) redirect(303, "/");
  const election = currentElection;
  if (election === null) error(404, m.no_election());

  const participation = await readParticipation(env.DB, election.id, locals.user.id);
  if (participation === null) redirect(303, "/acknowledgment");

  const ranked = await readOwnRanking(env.DB, election.id, locals.user.id);
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
      await replaceBallot(env.DB, guard.election.id, guard.userId, draft.ranked, new Date());
    } catch {
      return fail(503, { error: "save", draft });
    }

    redirect(303, `/thanks?electionId=${guard.election.id}`);
  },
} satisfies Actions;
