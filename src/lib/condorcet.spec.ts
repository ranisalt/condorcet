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

it("rejects duplicate candidate IDs and invalid pair references", () => {
  expect(() => summarizeCondorcet([0, 0], [])).toThrow(/unique/);
  for (const pair of [
    { preferredId: 999, otherId: 87, votes: 1 },
    { preferredId: 0, otherId: 999, votes: 1 },
    { preferredId: 87, otherId: 87, votes: 1 },
  ]) {
    expect(() => summarizeCondorcet([0, 87], [pair])).toThrow(/invalid candidate pair/);
  }
});

it("requires every pairwise vote count to be a nonnegative integer", () => {
  for (const votes of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => summarizeCondorcet([0, 87], [{ preferredId: 0, otherId: 87, votes }])).toThrow(
      /nonnegative integer/,
    );
  }
});

it("builds a complete zeroed matrix and recognizes a sole candidate", () => {
  expect(summarizeCondorcet([87], []).matrix).toEqual({ 87: { 87: 0 } });
  expect(summarizeCondorcet([87], []).winnerId).toBe(87);
  expect(summarizeCondorcet([0, 87], []).matrix).toEqual({
    0: { 0: 0, 87: 0 },
    87: { 0: 0, 87: 0 },
  });
});
