export type PairwiseCount = { preferredId: number; otherId: number; votes: number };
export type CondorcetSummary = {
  matrix: Record<number, Record<number, number>>;
  winnerId: number | null;
};

export function summarizeCondorcet(
  candidateIds: readonly number[],
  pairs: readonly PairwiseCount[],
): CondorcetSummary {
  const candidateSet = new Set(candidateIds);
  if (candidateSet.size !== candidateIds.length) {
    throw new TypeError("Candidate IDs must be unique");
  }

  const matrix: Record<number, Record<number, number>> = {};
  for (const candidateId of candidateIds) {
    const row: Record<number, number> = {};
    for (const otherId of candidateIds) row[otherId] = 0;
    matrix[candidateId] = row;
  }

  for (const pair of pairs) {
    const preferredRow = matrix[pair.preferredId];
    const otherRow = matrix[pair.otherId];
    if (preferredRow === undefined || otherRow === undefined || pair.preferredId === pair.otherId) {
      throw new TypeError("Pairwise count references an invalid candidate pair");
    }
    if (!Number.isInteger(pair.votes) || pair.votes < 0) {
      throw new TypeError("Pairwise votes must be a nonnegative integer");
    }
    preferredRow[pair.otherId] = pair.votes;
  }

  const winnerId = candidateIds.find((candidateId) => {
    const row = matrix[candidateId];
    if (row === undefined) return false;
    return candidateIds.every((otherId) => {
      if (candidateId === otherId) return true;
      const opponentRow = matrix[otherId];
      return opponentRow !== undefined && row[otherId] > opponentRow[candidateId];
    });
  });

  return { matrix, winnerId: winnerId ?? null };
}
