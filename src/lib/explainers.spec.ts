import { describe, expect, it } from "vitest";
import {
  condorcetWinner,
  copelandRecords,
  cycle,
  duel,
  duels,
  firstChoices,
  firstRound,
  lockSequence,
  lockedOrder,
  margin,
  methodWinners,
  sharedCopelandRecord,
  sharedWinner,
  skippedDuel,
  squeeze,
  strongestPath,
  supporters,
  total,
  uneven,
} from "./explainers.ts";

describe("cycle example", () => {
  it("forms a cycle with no Condorcet winner", () => {
    expect(duels(cycle).map((d) => [d.winner, d.loser, d.winnerVotes, d.loserVotes])).toEqual([
      ["A", "B", 2, 1],
      ["B", "C", 2, 1],
      ["C", "A", 2, 1],
    ]);
    expect(condorcetWinner(cycle)).toBeNull();
  });
});

describe("squeeze example", () => {
  it("makes C the Condorcet winner while plurality and the runoff pick A", () => {
    expect(total(squeeze)).toBe(100);
    expect(firstChoices(squeeze)).toEqual({ A: 35, B: 33, C: 32 });
    expect(duel(squeeze, "A", "B")).toMatchObject({ winner: "A", winnerVotes: 67, loserVotes: 33 });
    expect(duel(squeeze, "C", "A")).toMatchObject({ winner: "C", winnerVotes: 65, loserVotes: 35 });
    expect(duel(squeeze, "C", "B")).toMatchObject({ winner: "C", winnerVotes: 67, loserVotes: 33 });
    expect(condorcetWinner(squeeze)).toBe("C");
  });

  it("eliminates the Condorcet winner in the first round", () => {
    expect(firstRound(squeeze)).toEqual({ finalists: ["A", "B"], eliminated: "C" });
    expect(duel(squeeze, "A", "B").winner).toBe("A");
  });

  it("refuses a first round that a majority already decides", () => {
    expect(() =>
      firstRound([
        { count: 3, order: ["A", "B", "C"] },
        { count: 1, order: ["B", "C", "A"] },
      ]),
    ).toThrow("majority");
  });

  it("splits the ballots into the groups behind each side of a duel", () => {
    const forC = supporters(squeeze, "C", "A");
    const forA = supporters(squeeze, "A", "C");
    expect(forC.map((g) => g.count)).toEqual([33, 32]);
    expect(forA.map((g) => g.count)).toEqual([35]);
    expect(total(forC)).toBe(duel(squeeze, "C", "A").winnerVotes);
  });
});

describe("uneven example", () => {
  it("is a cycle that Copeland ties and Schulze and Tideman resolve to A", () => {
    expect(condorcetWinner(uneven)).toBeNull();
    expect(methodWinners(uneven)).toEqual({
      copeland: ["A", "B", "C"],
      schulze: ["A"],
      tideman: ["A"],
    });
    expect(sharedWinner(uneven)).toBe("A");
  });

  it("gives every candidate one win and one loss under Copeland", () => {
    expect(copelandRecords(uneven)).toEqual({
      A: { wins: 1, losses: 1, score: 0 },
      B: { wins: 1, losses: 1, score: 0 },
      C: { wins: 1, losses: 1, score: 0 },
    });
    expect(sharedCopelandRecord(uneven)).toEqual({ wins: 1, losses: 1, score: 0 });
  });

  it("counts wins and losses apart when the records differ", () => {
    expect(copelandRecords(squeeze).C).toEqual({ wins: 2, losses: 0, score: 2 });
    expect(() => sharedCopelandRecord(squeeze)).toThrow("differ");
  });

  it("locks B over C and A over B, then skips C over A because it closes a cycle", () => {
    expect(lockSequence(uneven).map((s) => [s.duel.winner, s.duel.loser, s.locked])).toEqual([
      ["B", "C", true],
      ["A", "B", true],
      ["C", "A", false],
    ]);
    expect(lockedOrder(uneven)).toEqual(["A", "B", "C"]);
  });

  it("skips the duel with the narrowest margin", () => {
    const skipped = skippedDuel(uneven);
    const margins = duels(uneven).map(margin);
    expect([skipped.winner, skipped.loser]).toEqual(["C", "A"]);
    expect(margin(skipped)).toBe(Math.min(...margins));
  });

  it("has no skipped duel when there is no cycle", () => {
    expect(() => skippedDuel(squeeze)).toThrow("no skipped duel");
  });

  it("gives A a stronger path to each rival than any rival has back to A", () => {
    const summary = (from: "A" | "B" | "C", to: "A" | "B" | "C") => {
      const { path, strength, links } = strongestPath(uneven, from, to);
      return { path, strength, links: links.map((d) => d.winnerVotes) };
    };
    expect(summary("A", "B")).toEqual({ path: ["A", "B"], strength: 65, links: [65] });
    expect(summary("B", "A")).toEqual({ path: ["B", "C", "A"], strength: 60, links: [75, 60] });
    expect(summary("A", "C")).toEqual({ path: ["A", "B", "C"], strength: 65, links: [65, 75] });
    expect(summary("C", "A")).toEqual({ path: ["C", "A"], strength: 60, links: [60] });
  });
});
