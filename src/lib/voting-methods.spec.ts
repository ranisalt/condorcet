import { expect, it } from "vitest";
import { explainTally, tally, type PairwiseCount } from "./voting-methods.ts";

/** Pairwise counts from a square matrix (rows[i][j] = ballots ranking i above j). */
function pairsFrom(
  rows: readonly (readonly number[])[],
  candidateIds: readonly number[] = rows.map((_, index) => index),
): PairwiseCount[] {
  return rows.flatMap((row, rowIndex) =>
    row.flatMap((votes, columnIndex) =>
      rowIndex === columnIndex
        ? []
        : [{ preferredId: candidateIds[rowIndex], otherId: candidateIds[columnIndex], votes }],
    ),
  );
}

function methodsOf(...args: Parameters<typeof tally>) {
  return tally(...args).methods;
}

function winners(result: { winnerIds: number[]; unresolved: boolean }): number[] {
  expect(result.unresolved).toBe(false);
  return result.winnerIds;
}

it("finds strict winners with all methods and supports candidate ID zero", () => {
  const result = methodsOf(
    [0, 87, 130],
    pairsFrom(
      [
        [0, 8, 7],
        [2, 0, 6],
        [3, 4, 0],
      ],
      [0, 87, 130],
    ),
  );
  expect(winners(result.copeland)).toEqual([0]);
  expect(winners(result.schulze)).toEqual([0]);
  expect(winners(result.rankedPairs)).toEqual([0]);
});

it("preserves all tied winners for equal preferences and a symmetric cycle", () => {
  const tied = methodsOf(
    [0, 87, 130],
    pairsFrom(
      [
        [0, 4, 4],
        [4, 0, 4],
        [4, 4, 0],
      ],
      [0, 87, 130],
    ),
  );
  expect(winners(tied.copeland)).toEqual([0, 87, 130]);
  expect(winners(tied.schulze)).toEqual([0, 87, 130]);
  expect(winners(tied.rankedPairs)).toEqual([0, 87, 130]);

  const cycle = methodsOf(
    [0, 87, 130],
    pairsFrom(
      [
        [0, 5, 3],
        [3, 0, 5],
        [5, 3, 0],
      ],
      [0, 87, 130],
    ),
  );
  expect(winners(cycle.copeland)).toEqual([0, 87, 130]);
  expect(winners(cycle.schulze)).toEqual([0, 87, 130]);
  expect(winners(cycle.rankedPairs)).toEqual([0, 87, 130]);
});

it("uses pairwise margin before winning votes when ordering Ranked Pairs strengths", () => {
  const result = methodsOf(
    [0, 1, 2, 3],
    pairsFrom([
      [0, 6, 3, 3],
      [4, 0, 3, 3],
      [3, 3, 0, 5],
      [3, 3, 1, 0],
    ]),
  );
  expect(winners(result.rankedPairs)).toEqual([0, 2]);
});

it("subtracts Copeland losses when tied contests make win counts alone misleading", () => {
  const result = methodsOf(
    [0, 1, 2, 3],
    pairsFrom([
      [0, 0, 0, 0],
      [1, 0, 0, 0],
      [1, 1, 0, 0],
      [1, 0, 1, 0],
    ]),
  );
  // Wins are [0,1,2,2], but wins minus losses are [-3,0,1,2].
  expect(result.copeland).toEqual({ winnerIds: [3], unresolved: false });
});

it("resolves large acyclic tied-strength groups without enumerating equivalent orders", () => {
  const ids = Array.from({ length: 12 }, (_, index) => index);
  const matrix = pairsFrom(
    ids.map((id) => ids.map((other) => (id < other && !(id === 0 && other === 1) ? 1 : 0))),
  );
  expect(methodsOf(ids, matrix).rankedPairs).toEqual({
    winnerIds: [0, 1],
    unresolved: false,
  });
});

it("does not let cycles among losers obscure an already proven strict winner", () => {
  const matrix = pairsFrom([
    [0, 2, 2, 2],
    [1, 0, 2, 1],
    [1, 1, 0, 2],
    [1, 2, 1, 0],
  ]);
  expect(methodsOf([0, 1, 2, 3], matrix, { maxExplorationStates: 1 }).rankedPairs).toEqual({
    winnerIds: [0],
    unresolved: false,
  });
});

it("uses winning votes to order Ranked Pairs victories with equal margins", () => {
  const result = methodsOf(
    [0, 1, 2],
    pairsFrom([
      [0, 6, 3],
      [4, 0, 4],
      [5, 3, 0],
    ]),
  );
  expect(winners(result.rankedPairs)).toEqual([2]);
});

it("uses winning votes as the Schulze path strength", () => {
  const result = methodsOf(
    [0, 1, 2],
    pairsFrom([
      [0, 5, 6],
      [4, 0, 5],
      [5, 4, 0],
    ]),
  );
  expect(winners(result.schulze)).toEqual([0]);
});

it("returns the published Schulze example winner E", () => {
  // Markus Schulze, The Schulze Method of Voting, Example 1 (45 voters).
  // https://en.wikipedia.org/wiki/Schulze_method
  // https://arxiv.org/abs/1804.02973
  const result = methodsOf(
    [0, 1, 2, 3, 4],
    pairsFrom([
      [0, 20, 26, 30, 22],
      [25, 0, 16, 33, 18],
      [19, 29, 0, 17, 24],
      [15, 12, 28, 0, 14],
      [23, 27, 21, 31, 0],
    ]),
  );
  expect(winners(result.schulze)).toEqual([4]);
});

it("branches across tied Ranked Pairs lock orders and unions possible winners", () => {
  // Tideman's parallel-universe tie handling considers every ordering of tied victories.
  // https://arxiv.org/abs/1805.06992
  const matrix = pairsFrom([
    [0, 2, 1],
    [1, 0, 2],
    [2, 1, 0],
  ]);
  expect(winners(methodsOf([0, 1, 2], matrix).rankedPairs)).toEqual([0, 1, 2]);
});

it("is invariant to roster permutations and does not mutate IDs or matrix", () => {
  const ids = [0, 87, 130] as const;
  const matrix = pairsFrom(
    [
      [0, 6, 4],
      [4, 0, 6],
      [6, 4, 0],
    ],
    ids,
  );
  const before = structuredClone(matrix);
  const first = methodsOf(ids, matrix);
  const reversed = methodsOf([...ids].reverse(), matrix);

  for (const method of ["copeland", "schulze", "rankedPairs"] as const) {
    expect(new Set(first[method].winnerIds)).toEqual(new Set(reversed[method].winnerIds));
    expect(first[method].winnerIds).toEqual(
      [...ids].filter((id) => first[method].winnerIds.includes(id)),
    );
    expect(reversed[method].winnerIds).toEqual(
      [...ids].reverse().filter((id) => reversed[method].winnerIds.includes(id)),
    );
  }
  expect(ids).toEqual([0, 87, 130]);
  expect(matrix).toEqual(before);
});

it.each([[0, 0], [1.5]].map((ids) => ({ ids })))(
  "rejects duplicate or noninteger candidate IDs $ids",
  ({ ids }) => {
    expect(() => methodsOf(ids, pairsFrom([[0]]))).toThrow(TypeError);
  },
);

it("marks Ranked Pairs unresolved when its explicit exploration budget is exhausted", () => {
  const ids = Array.from({ length: 12 }, (_, index) => index);
  const matrix = pairsFrom(
    ids.map((id) =>
      ids.map((other) => {
        if (id === other) return 0;
        const distance = (other - id + 12) % 12;
        return distance < 6 || (distance === 6 && id < other) ? 2 : 1;
      }),
    ),
  );
  const result = methodsOf(ids, matrix);
  expect(result.rankedPairs).toEqual({ winnerIds: [], unresolved: true });
  expect(result.copeland.unresolved).toBe(false);
  expect(result.schulze.unresolved).toBe(false);
  expect(methodsOf(ids, matrix, { maxExplorationStates: 50 }).rankedPairs).toEqual({
    winnerIds: [],
    unresolved: true,
  });
});

it("rejects an invalid exploration budget", () => {
  expect(() => methodsOf([0], pairsFrom([[0]]), { maxExplorationStates: 0 })).toThrow(
    /positive safe integer/,
  );
});

it("finds a candidate only when it strictly beats every opponent", () => {
  const result = tally(
    [0, 87, 130],
    [
      { preferredId: 0, otherId: 87, votes: 6 },
      { preferredId: 87, otherId: 0, votes: 4 },
      { preferredId: 0, otherId: 130, votes: 7 },
      { preferredId: 130, otherId: 0, votes: 3 },
    ],
  );
  expect(result.condorcetWinnerId).toBe(0);
  expect(result.matrix[87]?.[130]).toBe(0);
});

it("does not manufacture a Condorcet winner for a cycle or pairwise tie", () => {
  const cycle = tally(
    [0, 87, 130],
    [
      { preferredId: 0, otherId: 87, votes: 2 },
      { preferredId: 87, otherId: 0, votes: 1 },
      { preferredId: 87, otherId: 130, votes: 2 },
      { preferredId: 130, otherId: 87, votes: 1 },
      { preferredId: 130, otherId: 0, votes: 2 },
      { preferredId: 0, otherId: 130, votes: 1 },
    ],
  );
  expect(cycle.condorcetWinnerId).toBeNull();
  expect(
    tally(
      [0, 87],
      [
        { preferredId: 0, otherId: 87, votes: 1 },
        { preferredId: 87, otherId: 0, votes: 1 },
      ],
    ).condorcetWinnerId,
  ).toBeNull();
  expect(tally([0, 87, 130], []).condorcetWinnerId).toBeNull();
  expect(tally([], []).condorcetWinnerId).toBeNull();
});

it("rejects duplicate candidate IDs and invalid pair references", () => {
  expect(() => tally([0, 0], [])).toThrow(/unique/);
  for (const pair of [
    { preferredId: 999, otherId: 87, votes: 1 },
    { preferredId: 0, otherId: 999, votes: 1 },
    { preferredId: 87, otherId: 87, votes: 1 },
  ]) {
    expect(() => tally([0, 87], [pair])).toThrow(/invalid candidate pair/);
  }
});

it("requires every pairwise vote count to be a nonnegative integer", () => {
  for (const votes of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => tally([0, 87], [{ preferredId: 0, otherId: 87, votes }])).toThrow(
      /nonnegative integer/,
    );
  }
});

it("builds a complete zeroed matrix and recognizes a sole candidate", () => {
  expect(tally([87], []).matrix).toEqual({ 87: { 87: 0 } });
  expect(tally([87], []).condorcetWinnerId).toBe(87);
  expect(tally([0, 87], []).matrix).toEqual({
    0: { 0: 0, 87: 0 },
    87: { 0: 0, 87: 0 },
  });
});

it("explains Ranked Pairs as victories in lock order, skipping the one that closes a cycle", () => {
  const ids = [0, 87, 130];
  const steps = explainTally(
    ids,
    pairsFrom(
      [
        [0, 65, 40],
        [35, 0, 75],
        [60, 25, 0],
      ],
      ids,
    ),
  ).rankedPairs;
  expect(steps).toEqual([
    { winnerId: 87, loserId: 130, margin: 50, winningVotes: 75, locked: true },
    { winnerId: 0, loserId: 87, margin: 30, winningVotes: 65, locked: true },
    { winnerId: 130, loserId: 0, margin: 20, winningVotes: 60, locked: false },
  ]);
});

it("explains Ranked Pairs steps even when a strict Condorcet winner settles the result", () => {
  // Two victories tie on strength; their union is acyclic, so both lock in every order.
  const steps = explainTally(
    [0, 1, 2],
    pairsFrom([
      [0, 67, 35],
      [33, 0, 33],
      [65, 67, 0],
    ]),
  ).rankedPairs;
  expect(steps.map((s) => [s.winnerId, s.loserId, s.locked])).toEqual([
    [0, 1, true],
    [2, 1, true],
    [2, 0, true],
  ]);
});

it("marks a Ranked Pairs step as tie-dependent when only some lock orders keep it", () => {
  // A symmetric cycle: each victory is skipped in some order and locked in another.
  const steps = explainTally(
    [0, 1, 2],
    pairsFrom([
      [0, 2, 1],
      [1, 0, 2],
      [2, 1, 0],
    ]),
  ).rankedPairs;
  expect(steps.map((s) => s.locked)).toEqual([null, null, null]);
});

it("marks the remaining Ranked Pairs steps tie-dependent when the budget runs out", () => {
  const steps = explainTally(
    [0, 1, 2],
    pairsFrom([
      [0, 2, 1],
      [1, 0, 2],
      [2, 1, 0],
    ]),
    { maxExplorationStates: 1 },
  ).rankedPairs;
  expect(steps.map((s) => s.locked)).toEqual([null, null, null]);
});

it("explains Schulze with the strongest path and its weakest link between each pair", () => {
  const ids = [0, 87, 130];
  const { schulze } = explainTally(
    ids,
    pairsFrom(
      [
        [0, 65, 40],
        [35, 0, 75],
        [60, 25, 0],
      ],
      ids,
    ),
  );
  expect(schulze[0][87]).toEqual({ path: [0, 87], strength: 65 });
  expect(schulze[87][0]).toEqual({ path: [87, 130, 0], strength: 60 });
  expect(schulze[0][130]).toEqual({ path: [0, 87, 130], strength: 65 });
  expect(schulze[130][0]).toEqual({ path: [130, 0], strength: 60 });
  expect(schulze[0][0]).toEqual({ path: [], strength: 0 });
});

it("explains Schulze with an empty path when no candidate leads to another", () => {
  const { schulze } = explainTally(
    [0, 1],
    pairsFrom([
      [0, 1],
      [1, 0],
    ]),
  );
  expect(schulze[0][1]).toEqual({ path: [], strength: 0 });
});

it("explains the published Schulze example's strongest path from E to A", () => {
  // Schulze (arXiv:1804.02973) Example 1: E reaches A through B (27, then 25), stronger than A's best path back (24).
  const { schulze } = explainTally(
    [0, 1, 2, 3, 4],
    pairsFrom([
      [0, 20, 26, 30, 22],
      [25, 0, 16, 33, 18],
      [19, 29, 0, 17, 24],
      [15, 12, 28, 0, 14],
      [23, 27, 21, 31, 0],
    ]),
  );
  expect(schulze[4][0].strength).toBe(25);
  expect(schulze[0][4].strength).toBe(24);
  expect(schulze[4][0].path).toEqual([4, 1, 0]);
});
