import { error, redirect } from "@sveltejs/kit";
import { env } from "cloudflare:workers";
import { m } from "#lib/paraglide/messages.js";
import type { Election } from "../election.ts";
import { readParticipation, type Participation } from "./ballots.ts";
import { currentElection } from "./election.ts";
import type { VoterId } from "./voter-session.ts";

/** The pages of the Participation journey, in order: acknowledge, rank, confirm. */
export type JourneyStep = "acknowledgment" | "ballot" | "thanks";

export type JourneyEntry = {
  election: Election;
  voterId: VoterId;
  participation: Participation | null;
};

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
): Promise<JourneyEntry | { error: "invalid" | "stale" }>;
export async function enterStep(
  locals: App.Locals,
  step: JourneyStep,
  electionIds?: readonly FormDataEntryValue[],
): Promise<JourneyEntry | { error: "invalid" | "stale" }> {
  if (locals.voter === undefined) redirect(303, "/");
  const election = currentElection;
  if (election === null) error(404, m.no_election());

  if (electionIds !== undefined) {
    if (electionIds.length !== 1 || typeof electionIds[0] !== "string") return { error: "invalid" };
    if (electionIds[0] !== election.id) return { error: "stale" };
  }

  const participation = await readParticipation(env.DB, election.id, locals.voter);
  if (step === "acknowledgment") {
    if (participation !== null) redirect(303, "/ballot");
  } else {
    if (participation === null) redirect(303, "/acknowledgment");
    if (step === "thanks" && participation.submittedAt === null) redirect(303, "/ballot");
  }

  return { election, voterId: locals.voter, participation };
}
