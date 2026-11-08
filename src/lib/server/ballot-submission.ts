import type { BallotError } from "../components/ballot-error.ts";
import {
  editDraft,
  InvalidBallotError,
  isElectionOpen,
  parseDraft,
  parseDraftEdit,
  type BallotDraft,
  type Election,
} from "../election.ts";
import { env } from "cloudflare:workers";
import { replaceBallot } from "./ballots.ts";
import { enterStep } from "./participation.ts";

/** What a ballot form POST asks for: apply one edit to the draft, or save the draft. */
export type BallotSubmissionKind = "edit" | "save";

export type BallotSubmission =
  | { draft: BallotDraft; electionId: string }
  | { error: BallotError; status: 400 | 403 | 409 | 503; draft?: BallotDraft };

function readDraft(form: FormData, election: Election, kind: BallotSubmissionKind): BallotDraft {
  const draft = parseDraft(form, election);
  if (kind === "save") return draft;
  const operations = form.getAll("operation");
  if (operations.length !== 1)
    throw new InvalidBallotError("Edit operation is missing or duplicated");
  return editDraft(draft, parseDraftEdit(operations[0] ?? null, election.candidates));
}

/**
 * Handles a ballot form POST for the current election. Signed-out voters and voters outside the
 * ballot step get the journey's redirect (thrown); every other rejection comes back as a ballot
 * error with its HTTP status. A successful save has replaced the voter's stored ballot.
 */
export async function submitBallotForm(
  locals: App.Locals,
  form: FormData,
  kind: BallotSubmissionKind,
  now: Date,
): Promise<BallotSubmission> {
  const entry = await enterStep(locals, "ballot", form.getAll("electionId"));
  if ("error" in entry) return { error: entry.error, status: entry.error === "stale" ? 409 : 400 };
  const { election, voterId } = entry;
  if (!isElectionOpen(election, now)) return { error: "closed", status: 403 };

  let draft: BallotDraft;
  try {
    draft = readDraft(form, election, kind);
  } catch (cause) {
    if (cause instanceof InvalidBallotError) return { error: "invalid", status: 400 };
    throw cause;
  }

  if (kind === "save") {
    try {
      await replaceBallot(env.DB, election.id, voterId, draft.ranked, now);
    } catch {
      return { error: "save", status: 503, draft };
    }
  }
  return { draft, electionId: election.id };
}
