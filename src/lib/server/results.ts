import { and, eq, sql } from "drizzle-orm";
import { summarizeCondorcet } from "../condorcet.ts";
import type { CondorcetSummary, PairwiseCount } from "../condorcet.ts";
import { summarizeMethods } from "../voting-methods.ts";
import type { Election } from "../election.ts";
import {
  buildElectionCountsQuery,
  buildParticipationQuery,
  readElectionCounts,
  readParticipation,
} from "./ballots.ts";
import { getDb } from "./db/index.ts";
import { ballotRank } from "./db/election.schema.ts";
import type { VoterId } from "./voter-session.ts";

export type ResultsView =
  | {
      state: "locked";
      validCount: number;
      threshold: number | null;
      reason: "not-submitted" | "threshold";
    }
  | {
      state: "available";
      validCount: number;
      blankCount: number;
      threshold: number | null;
      matrix: CondorcetSummary["matrix"];
      winnerId: number | null;
      methods: ReturnType<typeof summarizeMethods>;
    };

/**
 * The single lock rule, applied twice by readResults: once on a cheap precheck that skips the
 * pairwise aggregate for the common locked case, and again on the batched snapshot so the
 * published outcome is consistent with the counts it was computed from.
 */
function lockReason(
  threshold: number | null,
  participation: { submittedAt: Date | null } | undefined,
  validCount: number,
): "not-submitted" | "threshold" | null {
  if (participation === undefined || participation.submittedAt === null) return "not-submitted";
  if (threshold === null || validCount < threshold) return "threshold";
  return null;
}

function locked(
  threshold: number | null,
  validCount: number,
  reason: "not-submitted" | "threshold",
): ResultsView {
  return { state: "locked", validCount, threshold, reason };
}

export function buildPairwiseCountsQuery(db: ReturnType<typeof getDb>, election: Election) {
  const candidateIds = JSON.stringify(election.candidates.map((candidate) => candidate.id));
  return db
    .select({
      preferredId: ballotRank.candidateId,
      otherId: sql<number>`CAST(candidate.value AS INTEGER)`,
      votes: sql<number>`count(*)`,
    })
    .from(ballotRank)
    .innerJoin(
      sql`json_each(${candidateIds}) AS candidate`,
      sql`"ballot_rank"."candidate_id" <> CAST(candidate.value AS INTEGER)`,
    )
    .leftJoin(
      sql`ballot_rank AS opponent`,
      sql`opponent.election_id = "ballot_rank"."election_id"
        AND opponent.voter_id = "ballot_rank"."voter_id"
        AND opponent.candidate_id = CAST(candidate.value AS INTEGER)`,
    )
    .where(
      and(
        eq(ballotRank.electionId, election.id),
        sql`(opponent.position IS NULL OR "ballot_rank"."position" < opponent.position)`,
      ),
    )
    .groupBy(ballotRank.candidateId, sql`CAST(candidate.value AS INTEGER)`);
}

export async function readPairwiseCounts(
  d1: D1Database,
  election: Election,
): Promise<PairwiseCount[]> {
  return buildPairwiseCountsQuery(getDb(d1), election).all();
}

export async function readResults(
  d1: D1Database,
  election: Election,
  voterId: VoterId | null,
  threshold: number | null,
): Promise<ResultsView> {
  const db = getDb(d1);
  const [precheckParticipation, precheckCounts] = await Promise.all([
    voterId === null ? Promise.resolve(null) : readParticipation(d1, election.id, voterId),
    readElectionCounts(d1, election.id),
  ]);

  if (voterId === null) return locked(threshold, precheckCounts.validCount, "not-submitted");
  const precheckReason = lockReason(
    threshold,
    precheckParticipation ?? undefined,
    precheckCounts.validCount,
  );
  if (precheckReason !== null) return locked(threshold, precheckCounts.validCount, precheckReason);

  const [participationRows, countRows, pairs] = await db.batch([
    buildParticipationQuery(db, election.id, voterId),
    buildElectionCountsQuery(db, election.id),
    buildPairwiseCountsQuery(db, election),
  ]);
  const snapshotCounts = countRows[0] ?? { validCount: 0, blankCount: 0 };
  const snapshotReason = lockReason(threshold, participationRows[0], snapshotCounts.validCount);
  if (snapshotReason !== null) return locked(threshold, snapshotCounts.validCount, snapshotReason);

  const candidateIds = election.candidates.map((candidate) => candidate.id);
  const summary = summarizeCondorcet(candidateIds, pairs);

  return {
    state: "available",
    validCount: snapshotCounts.validCount,
    blankCount: snapshotCounts.blankCount,
    threshold,
    matrix: summary.matrix,
    winnerId: summary.winnerId,
    methods: summarizeMethods(candidateIds, summary.matrix),
  };
}
