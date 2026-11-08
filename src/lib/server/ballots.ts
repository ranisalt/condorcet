import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import { getDb } from "./db/index.ts";
import { ballotRank, electionParticipant } from "./db/election.schema.ts";

export type Participation = { acknowledgedAt: Date; submittedAt: Date | null };

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

export function buildParticipationQuery(
  db: ReturnType<typeof getDb>,
  electionId: string,
  voterId: string,
) {
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
  const rows = await buildParticipationQuery(getDb(d1), electionId, voterId);
  return rows[0] ?? null;
}

export async function readOwnRanking(
  d1: D1Database,
  electionId: string,
  voterId: string,
): Promise<number[]> {
  const rows = await getDb(d1)
    .select({ candidateId: ballotRank.candidateId })
    .from(ballotRank)
    .where(and(eq(ballotRank.electionId, electionId), eq(ballotRank.voterId, voterId)))
    .orderBy(asc(ballotRank.position));
  return rows.map((row) => row.candidateId);
}

export async function replaceBallot(
  d1: D1Database,
  electionId: string,
  voterId: string,
  ranked: readonly number[],
  now: Date,
): Promise<void> {
  const db = getDb(d1);
  if ((await readParticipation(d1, electionId, voterId)) === null) {
    throw new Error("Election acknowledgment is required before submitting a ballot");
  }

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

export function buildElectionCountsQuery(db: ReturnType<typeof getDb>, electionId: string) {
  return db
    .select({
      validCount: sql<number>`count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM ballot_rank r
        WHERE r.election_id = "election_participant"."election_id"
          AND r.voter_id = "election_participant"."voter_id"
      ))`,
      blankCount: sql<number>`count(*) FILTER (WHERE NOT EXISTS (
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

export async function readElectionCounts(
  d1: D1Database,
  electionId: string,
): Promise<{ validCount: number; blankCount: number }> {
  const counts = await buildElectionCountsQuery(getDb(d1), electionId).get();
  return counts ?? { validCount: 0, blankCount: 0 };
}
