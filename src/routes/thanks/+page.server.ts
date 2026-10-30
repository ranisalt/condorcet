import { error, redirect } from "@sveltejs/kit";
import { env } from "cloudflare:workers";
import { m } from "#lib/paraglide/messages.js";
import { currentElection } from "#lib/server/election.ts";
import { readOwnRanking, readParticipation } from "#lib/server/ballots.ts";
import type { PageServerLoad } from "./$types";

export const load = (async ({ locals, url }) => {
  if (locals.voter === undefined) redirect(303, "/");
  const election = currentElection;
  if (election === null) error(404, m.no_election());

  const electionIds = url.searchParams.getAll("electionId");
  if (electionIds.length !== 1) error(400, m.stale_election());
  if (electionIds[0] !== election.id) error(409, m.stale_election());

  const participation = await readParticipation(env.DB, election.id, locals.voter);
  if (participation === null) redirect(303, "/acknowledgment");
  if (participation.submittedAt === null) redirect(303, "/ballot");

  const ranking = await readOwnRanking(env.DB, election.id, locals.voter);
  return { blank: ranking.length === 0 };
}) satisfies PageServerLoad;
