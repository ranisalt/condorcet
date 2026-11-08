import { redirect } from "@sveltejs/kit";
import { m } from "#lib/paraglide/messages.js";
import { env } from "cloudflare:workers";
import { checkElectionId, type Election } from "../election.ts";
import { readOwnBallot } from "./ballots.ts";
import { requireCurrentElection } from "./election.ts";
import type { VoterId } from "./voter-session.ts";

/** The pages of the Participation journey, in order: acknowledge, rank, confirm. */
export type JourneyStep = "acknowledgment" | "ballot" | "thanks";

export type JourneyEntry = {
  election: Election;
  voterId: VoterId;
  /** The voter's stored ranking, empty when none or blank. */
  ranked: number[];
};

export type EntryError = "invalid" | "stale";

/** The HTTP status and pt-BR message for an election id that `enterStep` rejected. */
export function entryErrorResponse(problem: EntryError): { status: 400 | 409; message: string } {
  return problem === "stale"
    ? { status: 409, message: m.stale_election() }
    : { status: 400, message: m.invalid_election_link() };
}

/**
 * Admits the signed-in voter to a journey step, or throws the redirect/404 that puts them on the
 * right one. When the request names an election, a malformed or stale id is returned as an error
 * before participation is read, so it never leaks the voter's stage.
 */
export async function enterStep(locals: App.Locals, step: JourneyStep): Promise<JourneyEntry>;
export async function enterStep(
  locals: App.Locals,
  step: JourneyStep,
  electionIds: readonly FormDataEntryValue[],
): Promise<JourneyEntry | { error: EntryError }>;
export async function enterStep(
  locals: App.Locals,
  step: JourneyStep,
  electionIds?: readonly FormDataEntryValue[],
): Promise<JourneyEntry | { error: EntryError }> {
  if (locals.voter === undefined) redirect(303, "/");
  const election = requireCurrentElection();

  if (electionIds !== undefined) {
    const problem = checkElectionId(electionIds, election);
    if (problem !== null) return { error: problem };
  }

  const { participation, ranked } = await readOwnBallot(env.DB, election.id, locals.voter);
  if (step === "acknowledgment") {
    if (participation !== null) redirect(303, "/ballot");
  } else {
    if (participation === null) redirect(303, "/acknowledgment");
    if (step === "thanks" && participation.submittedAt === null) redirect(303, "/ballot");
  }

  return { election, voterId: locals.voter, ranked };
}
