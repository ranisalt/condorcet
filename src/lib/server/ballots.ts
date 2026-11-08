import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import type { Election } from "../election.ts";
import type { PairwiseCount } from "../voting-methods.ts";
import { getDb } from "./db/index.ts";
import { ballotRank, electionParticipant } from "./db/election.schema.ts";

export type Participation = { acknowledgedAt: Date; submittedAt: Date | null };

export type ElectionCounts = { validCount: number; blankCount: number };

/** One consistent D1 read of everything the results gate and tally need. */
export type BallotSnapshot = ElectionCounts & {
  participation: Participation | null;
  pairs: PairwiseCount[];
};

export async function acknowledgeElection(
  d1: D1Database,
  electionId: string,
  voterId: string,
  now: Date,
): Promise<void> {
  const db = getDb(d1);
  await db
    .insert(electionParticipant)
    .values({ electionId, voterId, acknowledgedAt: now, submittedAt: null })
    .onConflictDoNothing({ target: [electionParticipant.electionId, electionParticipant.voterId] });
}

function participationQuery(db: ReturnType<typeof getDb>, electionId: string, voterId: string) {
  return db
    .select({
      acknowledgedAt: electionParticipant.acknowledgedAt,
      submittedAt: electionParticipant.submittedAt,
    })
    .from(electionParticipant)
    .where(
      and(eq(electionParticipant.electionId, electionId), eq(electionParticipant.voterId, voterId)),
    )
    .limit(1);
}

export async function readParticipation(
  d1: D1Database,
  electionId: string,
  voterId: string,
): Promise<Participation | null> {
  const rows = await participationQuery(getDb(d1), electionId, voterId);
  return rows[0] ?? null;
}

function ownRankingQuery(db: ReturnType<typeof getDb>, electionId: string, voterId: string) {
  return db
    .select({ candidateId: ballotRank.candidateId })
    .from(ballotRank)
    .where(and(eq(ballotRank.electionId, electionId), eq(ballotRank.voterId, voterId)))
    .orderBy(asc(ballotRank.position));
}

export async function readOwnRanking(
  d1: D1Database,
  electionId: string,
  voterId: string,
): Promise<number[]> {
  const rows = await ownRankingQuery(getDb(d1), electionId, voterId);
  return rows.map((row) => row.candidateId);
}

/** The voter's participation and stored ranking, read together in one D1 round trip. */
export async function readOwnBallot(
  d1: D1Database,
  electionId: string,
  voterId: string,
): Promise<{ participation: Participation | null; ranked: number[] }> {
  const db = getDb(d1);
  const [participationRows, rankRows] = await db.batch([
    participationQuery(db, electionId, voterId),
    ownRankingQuery(db, electionId, voterId),
  ]);
  return {
    participation: participationRows[0] ?? null,
    ranked: rankRows.map((row) => row.candidateId),
  };
}

export async function replaceBallot(
  d1: D1Database,
  electionId: string,
  voterId: string,
  ranked: readonly number[],
  now: Date,
): Promise<void> {
  // Callers admit the voter through enterStep first. The ballot_rank -> election_participant
  // foreign key still rejects ranks for a voter who never acknowledged, failing the whole batch.
  const db = getDb(d1);
  const updateSubmission = db
    .update(electionParticipant)
    .set({ submittedAt: sql`coalesce(${electionParticipant.submittedAt}, ${now.getTime()})` })
    .where(
      and(eq(electionParticipant.electionId, electionId), eq(electionParticipant.voterId, voterId)),
    );
  const deleteRanks = db
    .delete(ballotRank)
    .where(and(eq(ballotRank.electionId, electionId), eq(ballotRank.voterId, voterId)));

  if (ranked.length === 0) {
    await db.batch([updateSubmission, deleteRanks]);
    return;
  }

  const insertRanks = db
    .insert(ballotRank)
    .values(
      ranked.map((candidateId, position) => ({ electionId, voterId, candidateId, position })),
    );
  await db.batch([updateSubmission, deleteRanks, insertRanks]);
}

function electionCountsQuery(db: ReturnType<typeof getDb>, electionId: string) {
  return db
    .select({
      submittedCount: sql<number>`count(*)`,
      validCount: sql<number>`count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM ballot_rank r
        WHERE r.election_id = "election_participant"."election_id"
          AND r.voter_id = "election_participant"."voter_id"
      ))`,
    })
    .from(electionParticipant)
    .where(
      and(
        eq(electionParticipant.electionId, electionId),
        isNotNull(electionParticipant.submittedAt),
      ),
    );
}

/** Submitted ballots with no ranked candidate are blank. */
function toElectionCounts(row: { submittedCount: number; validCount: number } | undefined) {
  if (row === undefined) return { validCount: 0, blankCount: 0 };
  return { validCount: row.validCount, blankCount: row.submittedCount - row.validCount };
}

export async function readElectionCounts(
  d1: D1Database,
  electionId: string,
): Promise<ElectionCounts> {
  return toElectionCounts(await electionCountsQuery(getDb(d1), electionId).get());
}

function pairwiseCountsQuery(db: ReturnType<typeof getDb>, election: Election) {
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

/**
 * Reads the voter's participation, the election counts and the pairwise preference counts in one
 * D1 batch, so all three describe the same moment.
 */
export async function readBallotSnapshot(
  d1: D1Database,
  election: Election,
  voterId: string,
): Promise<BallotSnapshot> {
  const db = getDb(d1);
  const [participationRows, countRows, pairs] = await db.batch([
    participationQuery(db, election.id, voterId),
    electionCountsQuery(db, election.id),
    pairwiseCountsQuery(db, election),
  ]);
  return { participation: participationRows[0] ?? null, ...toElectionCounts(countRows[0]), pairs };
}
