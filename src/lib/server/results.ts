import { and, eq, sql } from "drizzle-orm";
import { summarizeCondorcet } from "../condorcet.ts";
import type { CondorcetSummary, PairwiseCount } from "../condorcet.ts";
import type { Election } from "../election.ts";
import { buildElectionCountsQuery, readElectionCounts, readParticipation } from "./ballots.ts";
import { getDb } from "./db/index.ts";
import { ballotRank, electionParticipant } from "./db/election.schema.ts";

export type ResultsView =
  | {
      state: "locked";
      validCount: number;
      threshold: number;
      reason: "not-submitted" | "threshold";
    }
  | {
      state: "available";
      validCount: number;
      blankCount: number;
      threshold: number;
      matrix: CondorcetSummary["matrix"];
      winnerId: number | null;
    };

function buildPairwiseCountsQuery(db: ReturnType<typeof getDb>, election: Election) {
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
        AND opponent.user_id = "ballot_rank"."user_id"
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
  userId: string | null,
): Promise<ResultsView> {
  const db = getDb(d1);
  const [precheckParticipation, precheckCounts] = await Promise.all([
    userId === null ? Promise.resolve(null) : readParticipation(d1, election.id, userId),
    readElectionCounts(d1, election.id),
  ]);

  if (
    userId === null ||
    precheckParticipation === null ||
    precheckParticipation.submittedAt === null
  ) {
    return {
      state: "locked",
      validCount: precheckCounts.validCount,
      threshold: election.resultsThreshold,
      reason: "not-submitted",
    };
  }
  if (precheckCounts.validCount < election.resultsThreshold) {
    return {
      state: "locked",
      validCount: precheckCounts.validCount,
      threshold: election.resultsThreshold,
      reason: "threshold",
    };
  }

  const participationQuery = db
    .select({ submittedAt: electionParticipant.submittedAt })
    .from(electionParticipant)
    .where(
      and(eq(electionParticipant.electionId, election.id), eq(electionParticipant.userId, userId)),
    )
    .limit(1);
  const [participationRows, countRows, pairs] = await db.batch([
    participationQuery,
    buildElectionCountsQuery(db, election.id),
    buildPairwiseCountsQuery(db, election),
  ]);
  const snapshotCounts = countRows[0] ?? { validCount: 0, blankCount: 0 };
  const snapshotParticipation = participationRows[0];
  if (snapshotParticipation === undefined || snapshotParticipation.submittedAt === null) {
    return {
      state: "locked",
      validCount: snapshotCounts.validCount,
      threshold: election.resultsThreshold,
      reason: "not-submitted",
    };
  }
  if (snapshotCounts.validCount < election.resultsThreshold) {
    return {
      state: "locked",
      validCount: snapshotCounts.validCount,
      threshold: election.resultsThreshold,
      reason: "threshold",
    };
  }

  const summary = summarizeCondorcet(
    election.candidates.map((candidate) => candidate.id),
    pairs,
  );

  return {
    state: "available",
    validCount: snapshotCounts.validCount,
    blankCount: snapshotCounts.blankCount,
    threshold: election.resultsThreshold,
    matrix: summary.matrix,
    winnerId: summary.winnerId,
  };
}
