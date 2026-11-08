import { describe, expect, it } from "vitest";
import { summarizeCondorcet } from "./condorcet.ts";
import {
  candidateIds,
  copelandScores,
  cycle,
  duel,
  duels,
  firstChoices,
  lockSequence,
  lockedOrder,
  pairwise,
  squeeze,
  strength,
  strongestPath,
  supporters,
  total,
  type BallotGroup,
} from "./explainers.ts";
import { summarizeMethods } from "./voting-methods.ts";

const letters = (ids: number[]) => ids.map((id) => "ABC"[id]);

function methods(groups: readonly BallotGroup[]) {
  const { matrix, winnerId } = summarizeCondorcet(candidateIds, pairwise(groups));
  return { winnerId, ...summarizeMethods(candidateIds, matrix) };
}

describe("cycle example", () => {
  it("forms a cycle with no Condorcet winner", () => {
    expect(duels(cycle).map((d) => [d.winner, d.loser, d.winnerVotes, d.loserVotes])).toEqual([
      ["A", "B", 2, 1],
      ["B", "C", 2, 1],
      ["C", "A", 2, 1],
    ]);
    expect(methods(cycle).winnerId).toBeNull();
  });
});

describe("squeeze example", () => {
  it("makes C the Condorcet winner while plurality and the runoff pick A", () => {
    expect(total(squeeze)).toBe(100);
    expect(firstChoices(squeeze)).toEqual({ A: 35, B: 33, C: 32 });
    expect(duel(squeeze, "A", "B")).toMatchObject({ winner: "A", winnerVotes: 67, loserVotes: 33 });
    expect(duel(squeeze, "C", "A")).toMatchObject({ winner: "C", winnerVotes: 65, loserVotes: 35 });
    expect(duel(squeeze, "C", "B")).toMatchObject({ winner: "C", winnerVotes: 67, loserVotes: 33 });
    expect(methods(squeeze).winnerId).toBe(2);
  });

  it("splits the ballots into the groups behind each side of a duel", () => {
    const forC = supporters(squeeze, "C", "A");
    const forA = supporters(squeeze, "A", "C");
    expect(forC.map((g) => g.count)).toEqual([33, 32]);
    expect(forA.map((g) => g.count)).toEqual([35]);
    expect(total(forC)).toBe(duel(squeeze, "C", "A").winnerVotes);
  });
});

describe("strength example", () => {
  it("is a cycle that Copeland ties and Schulze and Tideman resolve to A", () => {
    const result = methods(strength);
    expect(result.winnerId).toBeNull();
    expect(copelandScores(strength)).toEqual({ A: 0, B: 0, C: 0 });
    expect(letters(result.copeland.winnerIds)).toEqual(["A", "B", "C"]);
    expect(letters(result.schulze.winnerIds)).toEqual(["A"]);
    expect(letters(result.rankedPairs.winnerIds)).toEqual(["A"]);
  });

  it("locks B over C and A over B, then skips C over A because it closes a cycle", () => {
    expect(lockSequence(strength).map((s) => [s.duel.winner, s.duel.loser, s.locked])).toEqual([
      ["B", "C", true],
      ["A", "B", true],
      ["C", "A", false],
    ]);
    expect(lockedOrder(strength)).toEqual(["A", "B", "C"]);
  });

  it("gives A a stronger path to each rival than any rival has back to A", () => {
    const summary = (from: "A" | "B" | "C", to: "A" | "B" | "C") => {
      const { path, strength: s, links } = strongestPath(strength, from, to);
      return { path, strength: s, links: links.map((d) => d.winnerVotes) };
    };
    expect(summary("A", "B")).toEqual({ path: ["A", "B"], strength: 65, links: [65] });
    expect(summary("B", "A")).toEqual({ path: ["B", "C", "A"], strength: 60, links: [75, 60] });
    expect(summary("A", "C")).toEqual({ path: ["A", "B", "C"], strength: 65, links: [65, 75] });
    expect(summary("C", "A")).toEqual({ path: ["C", "A"], strength: 60, links: [60] });
  });
});
