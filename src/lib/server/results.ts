import { tally, type Tally } from "../voting-methods.ts";
import type { Election } from "../election.ts";
import { readBallotSnapshot, readElectionCounts, readParticipation } from "./ballots.ts";
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
      matrix: Tally["matrix"];
      winnerId: Tally["condorcetWinnerId"];
      methods: Tally["methods"];
    };

/**
 * The single lock rule, applied twice by readResults: once on a cheap precheck that skips the
 * pairwise aggregate for the common locked case, and again on the batched snapshot so the
 * published outcome is consistent with the counts it was computed from.
 */
function lockReason(
  threshold: number | null,
  participation: { submittedAt: Date | null } | null,
  validCount: number,
): "not-submitted" | "threshold" | null {
  if (participation === null || participation.submittedAt === null) return "not-submitted";
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

export async function readResults(
  d1: D1Database,
  election: Election,
  voterId: VoterId | null,
  threshold: number | null,
): Promise<ResultsView> {
  const [precheckParticipation, precheckCounts] = await Promise.all([
    voterId === null ? Promise.resolve(null) : readParticipation(d1, election.id, voterId),
    readElectionCounts(d1, election.id),
  ]);

  if (voterId === null) return locked(threshold, precheckCounts.validCount, "not-submitted");
  const precheckReason = lockReason(threshold, precheckParticipation, precheckCounts.validCount);
  if (precheckReason !== null) return locked(threshold, precheckCounts.validCount, precheckReason);

  const snapshot = await readBallotSnapshot(d1, election, voterId);
  const snapshotReason = lockReason(threshold, snapshot.participation, snapshot.validCount);
  if (snapshotReason !== null) return locked(threshold, snapshot.validCount, snapshotReason);

  const candidateIds = election.candidates.map((candidate) => candidate.id);
  const { matrix, condorcetWinnerId, methods } = tally(candidateIds, snapshot.pairs);

  return {
    state: "available",
    validCount: snapshot.validCount,
    blankCount: snapshot.blankCount,
    threshold,
    matrix,
    winnerId: condorcetWinnerId,
    methods,
  };
}
