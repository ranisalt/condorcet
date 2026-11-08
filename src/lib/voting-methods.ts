export type PairwiseCount = { preferredId: number; otherId: number; votes: number };
/** matrix[x][y] is how many ballots rank x above y. */
export type PairwiseMatrix = Record<number, Record<number, number>>;
export type MethodResult = { winnerIds: number[]; unresolved: boolean };
export const methodIds = ["copeland", "schulze", "rankedPairs"] as const;
export type MethodId = (typeof methodIds)[number];
export type VotingMethods = Record<MethodId, MethodResult>;
export type Tally = {
  matrix: PairwiseMatrix;
  /** The strict Condorcet winner, or null for a cycle or a pairwise tie. */
  condorcetWinnerId: number | null;
  methods: VotingMethods;
};

/** One victory in Ranked Pairs order. `locked` is null when the outcome depends on a tie order. */
export type LockStep = {
  winnerId: number;
  loserId: number;
  margin: number;
  winningVotes: number;
  locked: boolean | null;
};
/** The Schulze strongest path from one candidate to another; empty with strength 0 if none. */
export type StrongestPath = { path: number[]; strength: number };
export type TallyExplanation = {
  rankedPairs: LockStep[];
  schulze: Record<number, Record<number, StrongestPath>>;
};

type Victory = { winner: number; loser: number; margin: number; winningVotes: number };
type LockState = { graph: string; remaining: bigint };

const DEFAULT_EXPLORATION_BUDGET = 10_000;

function resolved(winnerIds: number[]): MethodResult {
  return { winnerIds, unresolved: false };
}

function buildMatrix(
  candidateIds: readonly number[],
  pairs: readonly PairwiseCount[],
): PairwiseMatrix {
  if (new Set(candidateIds).size !== candidateIds.length) {
    throw new TypeError("Candidate IDs must be unique");
  }
  for (const id of candidateIds) {
    if (!Number.isInteger(id)) throw new TypeError("Candidate IDs must be integers");
  }

  const matrix: PairwiseMatrix = {};
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
  return matrix;
}

function condorcetWinner(candidateIds: readonly number[], matrix: PairwiseMatrix): number | null {
  const winnerId = candidateIds.find((id) =>
    candidateIds.every((other) => id === other || matrix[id][other] > matrix[other][id]),
  );
  return winnerId ?? null;
}

function winnersAtMaximum(candidateIds: readonly number[], scores: readonly number[]): number[] {
  if (scores.length === 0) return [];
  let maximum = Number.NEGATIVE_INFINITY;
  for (const score of scores) maximum = Math.max(maximum, score);
  return candidateIds.filter((_, index) => scores[index] === maximum);
}

// Copeland scores are wins minus losses, with pairwise ties contributing zero.
function copeland(candidateIds: readonly number[], matrix: PairwiseMatrix): MethodResult {
  const scores = candidateIds.map(() => 0);
  for (let first = 0; first < candidateIds.length; first += 1) {
    const firstId = candidateIds[first];
    for (let second = first + 1; second < candidateIds.length; second += 1) {
      const secondId = candidateIds[second];
      const firstVotes = matrix[firstId]?.[secondId] ?? 0;
      const secondVotes = matrix[secondId]?.[firstId] ?? 0;
      if (firstVotes > secondVotes) {
        scores[first] += 1;
        scores[second] -= 1;
      } else if (secondVotes > firstVotes) {
        scores[second] += 1;
        scores[first] -= 1;
      }
    }
  }
  return resolved(winnersAtMaximum(candidateIds, scores));
}

// Schulze, "The Schulze Method of Voting" (arXiv:1804.02973), §2.3:
// Floyd-style max-min strongest paths, with direct winning-vote strengths.
// next[from][to] is the index of the first hop on the strongest path, or -1 when there is none.
function strongestPaths(
  candidateIds: readonly number[],
  matrix: PairwiseMatrix,
): { strengths: number[][]; next: number[][] } {
  const strengths = candidateIds.map((id, rowIndex) =>
    candidateIds.map((otherId, columnIndex) => {
      if (rowIndex === columnIndex) return 0;
      const votes = matrix[id][otherId];
      return votes > matrix[otherId][id] ? votes : 0;
    }),
  );
  const next = strengths.map((row) => row.map((strength, to) => (strength > 0 ? to : -1)));

  for (let via = 0; via < candidateIds.length; via += 1) {
    for (let from = 0; from < candidateIds.length; from += 1) {
      if (from === via) continue;
      for (let to = 0; to < candidateIds.length; to += 1) {
        if (to === from || to === via) continue;
        const throughVia = Math.min(strengths[from][via], strengths[via][to]);
        if (throughVia > strengths[from][to]) {
          strengths[from][to] = throughVia;
          next[from][to] = next[from][via];
        }
      }
    }
  }
  return { strengths, next };
}

function schulze(candidateIds: readonly number[], matrix: PairwiseMatrix): MethodResult {
  const { strengths } = strongestPaths(candidateIds, matrix);
  const winnerIds = candidateIds.filter((_, candidateIndex) =>
    candidateIds.every(
      (__, otherIndex) =>
        candidateIndex === otherIndex ||
        strengths[candidateIndex][otherIndex] >= strengths[otherIndex][candidateIndex],
    ),
  );
  return resolved(winnerIds);
}

function explainSchulze(
  candidateIds: readonly number[],
  matrix: PairwiseMatrix,
): TallyExplanation["schulze"] {
  const { strengths, next } = strongestPaths(candidateIds, matrix);
  const result: TallyExplanation["schulze"] = {};
  candidateIds.forEach((fromId, from) => {
    const row: Record<number, StrongestPath> = {};
    candidateIds.forEach((toId, to) => {
      const path: number[] = [];
      if (from !== to && next[from][to] !== -1) {
        path.push(fromId);
        for (let hop = from; hop !== to; hop = next[hop][to]) {
          if (path.length > candidateIds.length) throw new Error("Schulze path does not terminate");
          path.push(candidateIds[next[hop][to]]);
        }
      }
      row[toId] = { path, strength: from === to ? 0 : strengths[from][to] };
    });
    result[fromId] = row;
  });
  return result;
}

function reaches(graph: string, candidateCount: number, start: number, target: number): boolean {
  const visited = new Set<number>();
  const pending = [start];
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined) continue;
    if (current === target) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (let next = 0; next < candidateCount; next += 1) {
      if (graph[current * candidateCount + next] === "1" && !visited.has(next)) pending.push(next);
    }
  }
  return false;
}

function lockVictory(graph: string, candidateCount: number, from: number, to: number): string {
  const index = from * candidateCount + to;
  return `${graph.slice(0, index)}1${graph.slice(index + 1)}`;
}

function sortedVictories(candidateIds: readonly number[], matrix: PairwiseMatrix): Victory[] {
  const victories: Victory[] = [];
  for (let first = 0; first < candidateIds.length; first += 1) {
    const firstId = candidateIds[first];
    for (let second = first + 1; second < candidateIds.length; second += 1) {
      const secondId = candidateIds[second];
      const firstVotes = matrix[firstId][secondId];
      const secondVotes = matrix[secondId][firstId];
      if (firstVotes > secondVotes) {
        victories.push({
          winner: first,
          loser: second,
          margin: firstVotes - secondVotes,
          winningVotes: firstVotes,
        });
      } else if (secondVotes > firstVotes) {
        victories.push({
          winner: second,
          loser: first,
          margin: secondVotes - firstVotes,
          winningVotes: secondVotes,
        });
      }
    }
  }
  return victories.sort(
    (left, right) => right.margin - left.margin || right.winningVotes - left.winningVotes,
  );
}

// Tideman ranked pairs; equal-strength groups explore every possible lock order.
// Parallel-universe winners are the union of roots across all valid final DAGs.
// See Tideman (1987), https://doi.org/10.1007/BF00433944; and Wang et al.,
// https://arxiv.org/abs/1805.06992 for parallel-universe tie handling.
// Returns every possible final lock graph (null if the budget ran out) and each victory's step.
function lockVictories(
  candidateIds: readonly number[],
  matrix: PairwiseMatrix,
  maxExplorationStates: number,
): { graphs: Set<string> | null; steps: LockStep[] } {
  const victories = sortedVictories(candidateIds, matrix);
  const candidateCount = candidateIds.length;
  const steps: LockStep[] = [];
  const step = (victory: Victory, locked: boolean | null): LockStep => ({
    winnerId: candidateIds[victory.winner],
    loserId: candidateIds[victory.loser],
    margin: victory.margin,
    winningVotes: victory.winningVotes,
    locked,
  });
  let possibleGraphs = new Set(["0".repeat(candidateCount * candidateCount)]);
  let exploredStates = 0;
  for (let groupStart = 0; groupStart < victories.length;) {
    const firstVictory = victories[groupStart];
    let groupEnd = groupStart + 1;
    while (
      groupEnd < victories.length &&
      victories[groupEnd].margin === firstVictory.margin &&
      victories[groupEnd].winningVotes === firstVictory.winningVotes
    ) {
      groupEnd += 1;
    }

    const group = victories.slice(groupStart, groupEnd);
    const fullMask = (1n << BigInt(group.length)) - 1n;
    const pending: LockState[] = [];
    const nextGraphs = new Set<string>();
    for (const graph of possibleGraphs) {
      let combined = graph;
      let cyclic = false;
      for (const victory of group) {
        if (reaches(combined, candidateCount, victory.loser, victory.winner)) {
          cyclic = true;
          break;
        }
        combined = lockVictory(combined, candidateCount, victory.winner, victory.loser);
      }
      // If their union is acyclic, every order locks every edge to the same DAG.
      if (cyclic) pending.push({ graph, remaining: fullMask });
      else nextGraphs.add(combined);
    }
    const scheduled = new Set(
      pending.map(({ graph, remaining }) => `${remaining.toString()}:${graph}`),
    );
    while (pending.length > 0) {
      const state = pending.pop();
      if (state === undefined) continue;
      if (exploredStates >= maxExplorationStates) {
        for (const victory of victories.slice(groupStart)) steps.push(step(victory, null));
        return { graphs: null, steps };
      }
      exploredStates += 1;

      if (state.remaining === 0n) {
        nextGraphs.add(state.graph);
        continue;
      }
      for (let edgeIndex = 0; edgeIndex < group.length; edgeIndex += 1) {
        const bit = 1n << BigInt(edgeIndex);
        if ((state.remaining & bit) === 0n) continue;
        const victory = group[edgeIndex];
        const graph = reaches(state.graph, candidateCount, victory.loser, victory.winner)
          ? state.graph
          : lockVictory(state.graph, candidateCount, victory.winner, victory.loser);
        const remaining = state.remaining ^ bit;
        const nextKey = `${remaining.toString()}:${graph}`;
        if (!scheduled.has(nextKey)) {
          scheduled.add(nextKey);
          pending.push({ graph, remaining });
        }
      }
    }
    for (const victory of group) {
      const index = victory.winner * candidateCount + victory.loser;
      const lockedIn = [...nextGraphs].map((graph) => graph[index] === "1");
      const locked = lockedIn.every(Boolean) ? true : lockedIn.some(Boolean) ? null : false;
      steps.push(step(victory, locked));
    }
    possibleGraphs = nextGraphs;
    groupStart = groupEnd;
  }
  return { graphs: possibleGraphs, steps };
}

function rankedPairs(
  candidateIds: readonly number[],
  matrix: PairwiseMatrix,
  maxExplorationStates: number,
): MethodResult {
  // Ranked Pairs is Condorcet-consistent; losing-candidate cycles cannot change this result.
  const strictWinner = condorcetWinner(candidateIds, matrix);
  if (strictWinner !== null) return resolved([strictWinner]);

  const { graphs } = lockVictories(candidateIds, matrix, maxExplorationStates);
  if (graphs === null) return { winnerIds: [], unresolved: true };

  const candidateCount = candidateIds.length;
  const possibleRoots = new Set<number>();
  for (const graph of graphs) {
    for (let candidate = 0; candidate < candidateCount; candidate += 1) {
      let hasIncomingEdge = false;
      for (let other = 0; other < candidateCount; other += 1) {
        if (graph[other * candidateCount + candidate] === "1") {
          hasIncomingEdge = true;
          break;
        }
      }
      if (!hasIncomingEdge) possibleRoots.add(candidate);
    }
  }
  return resolved(candidateIds.filter((_, index) => possibleRoots.has(index)));
}

function explorationBudget(options: { maxExplorationStates?: number }): number {
  const maxExplorationStates = options.maxExplorationStates ?? DEFAULT_EXPLORATION_BUDGET;
  if (!Number.isSafeInteger(maxExplorationStates) || maxExplorationStates < 1) {
    throw new TypeError("Exploration budget must be a positive safe integer");
  }
  return maxExplorationStates;
}

/**
 * Counts an election from its pairwise preference counts: the full matrix (absent pairs are
 * zero), the strict Condorcet winner, and each method's winners. Ties are kept, never broken by
 * ID or roster order. Ranked Pairs is `unresolved` with no winners when exploring its tied lock
 * orders exceeds `maxExplorationStates`. Throws TypeError on duplicate or noninteger IDs, pairs
 * naming unknown or identical candidates, or vote counts that are not nonnegative integers.
 */
export function tally(
  candidateIds: readonly number[],
  pairs: readonly PairwiseCount[],
  options: { maxExplorationStates?: number } = {},
): Tally {
  const maxExplorationStates = explorationBudget(options);
  const matrix = buildMatrix(candidateIds, pairs);
  return {
    matrix,
    condorcetWinnerId: condorcetWinner(candidateIds, matrix),
    methods: {
      copeland: copeland(candidateIds, matrix),
      schulze: schulze(candidateIds, matrix),
      rankedPairs: rankedPairs(candidateIds, matrix, maxExplorationStates),
    },
  };
}

/**
 * The intermediate steps behind `tally`, for teaching: every Ranked Pairs victory in lock order
 * (even when a strict Condorcet winner settles the result), and the Schulze strongest path between
 * every ordered pair of candidates. Same validation and budget as `tally`.
 */
export function explainTally(
  candidateIds: readonly number[],
  pairs: readonly PairwiseCount[],
  options: { maxExplorationStates?: number } = {},
): TallyExplanation {
  const maxExplorationStates = explorationBudget(options);
  const matrix = buildMatrix(candidateIds, pairs);
  return {
    rankedPairs: lockVictories(candidateIds, matrix, maxExplorationStates).steps,
    schulze: explainSchulze(candidateIds, matrix),
  };
}
