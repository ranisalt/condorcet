import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "./db/index.ts";
import { ballotRank, electionParticipant } from "./db/election.schema.ts";

export type Participation = { acknowledgedAt: Date; submittedAt: Date | null };

export async function acknowledgeElection(
  d1: D1Database,
  electionId: string,
  userId: string,
  now: Date,
): Promise<void> {
  const db = getDb(d1);
  await db
    .insert(electionParticipant)
    .values({ electionId, userId, acknowledgedAt: now, submittedAt: null })
    .onConflictDoNothing({ target: [electionParticipant.electionId, electionParticipant.userId] });
}

export async function readParticipation(
  d1: D1Database,
  electionId: string,
  userId: string,
): Promise<Participation | null> {
  const rows = await getDb(d1)
    .select({
      acknowledgedAt: electionParticipant.acknowledgedAt,
      submittedAt: electionParticipant.submittedAt,
    })
    .from(electionParticipant)
    .where(
      and(eq(electionParticipant.electionId, electionId), eq(electionParticipant.userId, userId)),
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function readOwnRanking(
  d1: D1Database,
  electionId: string,
  userId: string,
): Promise<number[]> {
  const rows = await getDb(d1)
    .select({ candidateId: ballotRank.candidateId })
    .from(ballotRank)
    .where(and(eq(ballotRank.electionId, electionId), eq(ballotRank.userId, userId)))
    .orderBy(asc(ballotRank.position));
  return rows.map((row) => row.candidateId);
}

export async function replaceBallot(
  d1: D1Database,
  electionId: string,
  userId: string,
  ranked: readonly number[],
  now: Date,
): Promise<void> {
  const db = getDb(d1);
  const acknowledged = await db
    .select({ acknowledgedAt: electionParticipant.acknowledgedAt })
    .from(electionParticipant)
    .where(
      and(eq(electionParticipant.electionId, electionId), eq(electionParticipant.userId, userId)),
    )
    .limit(1);
  if (acknowledged.length === 0) {
    throw new Error("Election acknowledgment is required before submitting a ballot");
  }

  const updateSubmission = db
    .update(electionParticipant)
    .set({ submittedAt: sql`coalesce(${electionParticipant.submittedAt}, ${now.getTime()})` })
    .where(
      and(eq(electionParticipant.electionId, electionId), eq(electionParticipant.userId, userId)),
    );
  const deleteRanks = db
    .delete(ballotRank)
    .where(and(eq(ballotRank.electionId, electionId), eq(ballotRank.userId, userId)));

  if (ranked.length === 0) {
    await db.batch([updateSubmission, deleteRanks]);
    return;
  }

  const insertRanks = db
    .insert(ballotRank)
    .values(ranked.map((candidateId, position) => ({ electionId, userId, candidateId, position })));
  await db.batch([updateSubmission, deleteRanks, insertRanks]);
}

export function buildElectionCountsQuery(db: ReturnType<typeof getDb>, electionId: string) {
  return db
    .select({
      validCount: sql<number>`count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM ballot_rank r
        WHERE r.election_id = "election_participant"."election_id"
          AND r.user_id = "election_participant"."user_id"
      ))`,
      blankCount: sql<number>`count(*) FILTER (WHERE NOT EXISTS (
        SELECT 1 FROM ballot_rank r
        WHERE r.election_id = "election_participant"."election_id"
          AND r.user_id = "election_participant"."user_id"
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

export async function readElectionCounts(
  d1: D1Database,
  electionId: string,
): Promise<{ validCount: number; blankCount: number }> {
  const counts = await buildElectionCountsQuery(getDb(d1), electionId).get();
  return counts ?? { validCount: 0, blankCount: 0 };
}
