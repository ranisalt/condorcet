import { expect, it } from "vitest";
import { summarizeCondorcet } from "./condorcet.ts";

it("finds a candidate only when it strictly beats every opponent", () => {
  const result = summarizeCondorcet(
    [0, 87, 130],
    [
      { preferredId: 0, otherId: 87, votes: 6 },
      { preferredId: 87, otherId: 0, votes: 4 },
      { preferredId: 0, otherId: 130, votes: 7 },
      { preferredId: 130, otherId: 0, votes: 3 },
    ],
  );
  expect(result.winnerId).toBe(0);
  expect(result.matrix[87]?.[130]).toBe(0);
});

it("does not manufacture a winner for a cycle or pairwise tie", () => {
  const cycle = summarizeCondorcet(
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
  expect(cycle.winnerId).toBeNull();
  expect(
    summarizeCondorcet(
      [0, 87],
      [
        { preferredId: 0, otherId: 87, votes: 1 },
        { preferredId: 87, otherId: 0, votes: 1 },
      ],
    ).winnerId,
  ).toBeNull();
  expect(summarizeCondorcet([0, 87, 130], []).winnerId).toBeNull();
  expect(summarizeCondorcet([], []).winnerId).toBeNull();
});
