import { expect, it } from "vitest";
import type { CondorcetSummary } from "./condorcet.ts";
import { summarizeMethods } from "./voting-methods.ts";

function matrixFrom(
  rows: readonly (readonly number[])[],
  candidateIds: readonly number[] = rows.map((_, index) => index),
): CondorcetSummary["matrix"] {
  return Object.fromEntries(
    rows.map((row, rowIndex) => {
      const rowId = candidateIds[rowIndex];
      if (rowId === undefined) throw new Error("Missing candidate ID for row");
      return [
        rowId,
        Object.fromEntries(
          row.map((votes, columnIndex) => {
            const columnId = candidateIds[columnIndex];
            if (columnId === undefined) throw new Error("Missing candidate ID for column");
            return [columnId, votes];
          }),
        ),
      ];
    }),
  );
}

function winners(result: { winnerIds: number[]; unresolved: boolean }): number[] {
  expect(result.unresolved).toBe(false);
  return result.winnerIds;
}

it("finds strict winners with all methods and supports candidate ID zero", () => {
  const result = summarizeMethods(
    [0, 87, 130],
    matrixFrom(
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
  const tied = summarizeMethods(
    [0, 87, 130],
    matrixFrom(
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

  const cycle = summarizeMethods(
    [0, 87, 130],
    matrixFrom(
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
  const result = summarizeMethods(
    [0, 1, 2, 3],
    matrixFrom([
      [0, 6, 3, 3],
      [4, 0, 3, 3],
      [3, 3, 0, 5],
      [3, 3, 1, 0],
    ]),
  );
  expect(winners(result.rankedPairs)).toEqual([0, 2]);
});

it("subtracts Copeland losses when tied contests make win counts alone misleading", () => {
  const result = summarizeMethods(
    [0, 1, 2, 3],
    matrixFrom([
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
  const matrix = matrixFrom(
    ids.map((id) => ids.map((other) => (id < other && !(id === 0 && other === 1) ? 1 : 0))),
  );
  expect(summarizeMethods(ids, matrix).rankedPairs).toEqual({
    winnerIds: [0, 1],
    unresolved: false,
  });
});

it("does not let cycles among losers obscure an already proven strict winner", () => {
  const matrix = matrixFrom([
    [0, 2, 2, 2],
    [1, 0, 2, 1],
    [1, 1, 0, 2],
    [1, 2, 1, 0],
  ]);
  expect(summarizeMethods([0, 1, 2, 3], matrix, { maxExplorationStates: 1 }).rankedPairs).toEqual({
    winnerIds: [0],
    unresolved: false,
  });
});

it("uses winning votes to order Ranked Pairs victories with equal margins", () => {
  const result = summarizeMethods(
    [0, 1, 2],
    matrixFrom([
      [0, 6, 3],
      [4, 0, 4],
      [5, 3, 0],
    ]),
  );
  expect(winners(result.rankedPairs)).toEqual([2]);
});

it("uses winning votes as the Schulze path strength", () => {
  const result = summarizeMethods(
    [0, 1, 2],
    matrixFrom([
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
  const result = summarizeMethods(
    [0, 1, 2, 3, 4],
    matrixFrom([
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
  const matrix = matrixFrom([
    [0, 2, 1],
    [1, 0, 2],
    [2, 1, 0],
  ]);
  expect(winners(summarizeMethods([0, 1, 2], matrix).rankedPairs)).toEqual([0, 1, 2]);
});

it("is invariant to roster permutations and does not mutate IDs or matrix", () => {
  const ids = [0, 87, 130] as const;
  const matrix = matrixFrom(
    [
      [0, 6, 4],
      [4, 0, 6],
      [6, 4, 0],
    ],
    ids,
  );
  const before = structuredClone(matrix);
  const first = summarizeMethods(ids, matrix);
  const reversed = summarizeMethods([...ids].reverse(), matrix);

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

it("marks Ranked Pairs unresolved when its explicit exploration budget is exhausted", () => {
  const ids = Array.from({ length: 12 }, (_, index) => index);
  const matrix = matrixFrom(
    ids.map((id) =>
      ids.map((other) => {
        if (id === other) return 0;
        const distance = (other - id + 12) % 12;
        return distance < 6 || (distance === 6 && id < other) ? 2 : 1;
      }),
    ),
  );
  const result = summarizeMethods(ids, matrix);
  expect(result.rankedPairs).toEqual({ winnerIds: [], unresolved: true });
  expect(result.copeland.unresolved).toBe(false);
  expect(result.schulze.unresolved).toBe(false);
  expect(summarizeMethods(ids, matrix, { maxExplorationStates: 50 }).rankedPairs).toEqual({
    winnerIds: [],
    unresolved: true,
  });
});

it("rejects duplicate IDs, invalid matrix cells and an invalid exploration budget", () => {
  const matrix = matrixFrom([
    [0, 1],
    [0, 0],
  ]);
  expect(() => summarizeMethods([0, 0], matrix)).toThrow(/unique/);
  expect(() => summarizeMethods([0, 1], matrixFrom([[0], [0, 0]]))).toThrow(/nonnegative integers/);
  expect(() => summarizeMethods([0, 1], matrix, { maxExplorationStates: 0 })).toThrow(
    /positive safe integer/,
  );
});
