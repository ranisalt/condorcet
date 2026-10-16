import type { CondorcetSummary } from "./condorcet.ts";

export type MethodResult = { winnerIds: number[]; unresolved: boolean };
export const methodIds = ["copeland", "schulze", "rankedPairs"] as const;
export type MethodId = (typeof methodIds)[number];
export type VotingMethods = Record<MethodId, MethodResult>;

type Victory = { winner: number; loser: number; margin: number; winningVotes: number };
type LockState = { graph: string; remaining: bigint };

const DEFAULT_EXPLORATION_BUDGET = 10_000;

function resolved(winnerIds: number[]): MethodResult {
  return { winnerIds, unresolved: false };
}

function validateInput(candidateIds: readonly number[], matrix: CondorcetSummary["matrix"]): void {
  if (new Set(candidateIds).size !== candidateIds.length) {
    throw new TypeError("Candidate IDs must be unique");
  }
  for (const id of candidateIds) {
    if (!Number.isInteger(id)) throw new TypeError("Candidate IDs must be integers");
  }
  for (const rowId of candidateIds) {
    const row = matrix[rowId];
    if (row === undefined || row === null || typeof row !== "object") {
      throw new TypeError("Pairwise matrix is missing a candidate row");
    }
    for (const columnId of candidateIds) {
      const votes = row[columnId];
      if (!Number.isInteger(votes) || votes < 0) {
        throw new TypeError("Pairwise counts must be nonnegative integers");
      }
    }
  }
}

function winnersAtMaximum(candidateIds: readonly number[], scores: readonly number[]): number[] {
  if (scores.length === 0) return [];
  let maximum = Number.NEGATIVE_INFINITY;
  for (const score of scores) maximum = Math.max(maximum, score);
  return candidateIds.filter((_, index) => scores[index] === maximum);
}

// Copeland scores are wins minus losses, with pairwise ties contributing zero.
function copeland(
  candidateIds: readonly number[],
  matrix: CondorcetSummary["matrix"],
): MethodResult {
  const scores = candidateIds.map(() => 0);
  for (let first = 0; first < candidateIds.length; first += 1) {
    const firstId = candidateIds[first];
    if (firstId === undefined) continue;
    for (let second = first + 1; second < candidateIds.length; second += 1) {
      const secondId = candidateIds[second];
      if (secondId === undefined) continue;
      const firstVotes = matrix[firstId]?.[secondId] ?? 0;
      const secondVotes = matrix[secondId]?.[firstId] ?? 0;
      if (firstVotes > secondVotes) {
        scores[first] = (scores[first] ?? 0) + 1;
        scores[second] = (scores[second] ?? 0) - 1;
      } else if (secondVotes > firstVotes) {
        scores[second] = (scores[second] ?? 0) + 1;
        scores[first] = (scores[first] ?? 0) - 1;
      }
    }
  }
  return resolved(winnersAtMaximum(candidateIds, scores));
}

// Schulze, "The Schulze Method of Voting" (arXiv:1804.02973), §2.3:
// Floyd-style max-min strongest paths, with direct winning-vote strengths.
function schulze(
  candidateIds: readonly number[],
  matrix: CondorcetSummary["matrix"],
): MethodResult {
  const paths = candidateIds.map((id, rowIndex) =>
    candidateIds.map((otherId, columnIndex) => {
      if (rowIndex === columnIndex) return 0;
      const votes = matrix[id]?.[otherId] ?? 0;
      const opposingVotes = matrix[otherId]?.[id] ?? 0;
      return votes > opposingVotes ? votes : 0;
    }),
  );

  for (let via = 0; via < candidateIds.length; via += 1) {
    for (let from = 0; from < candidateIds.length; from += 1) {
      if (from === via) continue;
      for (let to = 0; to < candidateIds.length; to += 1) {
        if (to === from || to === via) continue;
        const pathRow = paths[from];
        const viaRow = paths[via];
        if (pathRow === undefined || viaRow === undefined) continue;
        const fromTo = pathRow[to] ?? 0;
        const fromVia = pathRow[via] ?? 0;
        const viaTo = viaRow[to] ?? 0;
        pathRow[to] = Math.max(fromTo, Math.min(fromVia, viaTo));
      }
    }
  }

  const winnerIds = candidateIds.filter((_, candidateIndex) =>
    candidateIds.every((__, otherIndex) => {
      if (candidateIndex === otherIndex) return true;
      return (
        (paths[candidateIndex]?.[otherIndex] ?? 0) >= (paths[otherIndex]?.[candidateIndex] ?? 0)
      );
    }),
  );
  return resolved(winnerIds);
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

// Tideman ranked pairs; equal-strength groups explore every possible lock order.
// Parallel-universe winners are the union of roots across all valid final DAGs.
// See Tideman (1987), https://doi.org/10.1007/BF00433944; and Wang et al.,
// https://arxiv.org/abs/1805.06992 for parallel-universe tie handling.
function rankedPairs(
  candidateIds: readonly number[],
  matrix: CondorcetSummary["matrix"],
  maxExplorationStates: number,
): MethodResult {
  // Ranked Pairs is Condorcet-consistent; losing-candidate cycles cannot change this result.
  const strictWinner = candidateIds.find((id) =>
    candidateIds.every((other) => id === other || matrix[id][other] > matrix[other][id]),
  );
  if (strictWinner !== undefined) return resolved([strictWinner]);

  const victories: Victory[] = [];
  for (let first = 0; first < candidateIds.length; first += 1) {
    const firstId = candidateIds[first];
    if (firstId === undefined) continue;
    for (let second = first + 1; second < candidateIds.length; second += 1) {
      const secondId = candidateIds[second];
      if (secondId === undefined) continue;
      const firstVotes = matrix[firstId]?.[secondId] ?? 0;
      const secondVotes = matrix[secondId]?.[firstId] ?? 0;
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
  victories.sort(
    (left, right) => right.margin - left.margin || right.winningVotes - left.winningVotes,
  );

  const candidateCount = candidateIds.length;
  let possibleGraphs = new Set(["0".repeat(candidateCount * candidateCount)]);
  let exploredStates = 0;
  for (let groupStart = 0; groupStart < victories.length;) {
    const firstVictory = victories[groupStart];
    if (firstVictory === undefined) break;
    let groupEnd = groupStart + 1;
    while (groupEnd < victories.length) {
      const next = victories[groupEnd];
      if (
        next === undefined ||
        next.margin !== firstVictory.margin ||
        next.winningVotes !== firstVictory.winningVotes
      ) {
        break;
      }
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
      if (exploredStates >= maxExplorationStates) return { winnerIds: [], unresolved: true };
      exploredStates += 1;

      if (state.remaining === 0n) {
        nextGraphs.add(state.graph);
        continue;
      }
      for (let edgeIndex = 0; edgeIndex < group.length; edgeIndex += 1) {
        const bit = 1n << BigInt(edgeIndex);
        if ((state.remaining & bit) === 0n) continue;
        const victory = group[edgeIndex];
        if (victory === undefined) continue;
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
    possibleGraphs = nextGraphs;
    groupStart = groupEnd;
  }

  const possibleRoots = new Set<number>();
  for (const graph of possibleGraphs) {
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

export function summarizeMethods(
  candidateIds: readonly number[],
  matrix: CondorcetSummary["matrix"],
  options: { maxExplorationStates?: number } = {},
): VotingMethods {
  validateInput(candidateIds, matrix);
  const maxExplorationStates = options.maxExplorationStates ?? DEFAULT_EXPLORATION_BUDGET;
  if (!Number.isSafeInteger(maxExplorationStates) || maxExplorationStates < 1) {
    throw new TypeError("Exploration budget must be a positive safe integer");
  }
  return {
    copeland: copeland(candidateIds, matrix),
    schulze: schulze(candidateIds, matrix),
    rankedPairs: rankedPairs(candidateIds, matrix, maxExplorationStates),
  };
}
