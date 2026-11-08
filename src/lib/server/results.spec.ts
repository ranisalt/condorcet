import type { VoterId } from "./voter-session.ts";
import { expect, it } from "vitest";
import type { Election } from "../election.ts";
import { tally, type PairwiseCount } from "../voting-methods.ts";
import { acknowledgeElection, readElectionCounts, replaceBallot } from "./ballots.ts";
import { openTestD1 } from "../../test/d1.ts";
import { readPairwiseCounts, readResults } from "./results.ts";

function condorcetOf(candidateIds: number[], pairs: PairwiseCount[]) {
  const { matrix, condorcetWinnerId } = tally(candidateIds, pairs);
  return { matrix, winnerId: condorcetWinnerId };
}

const at = new Date("2026-10-15T12:00:00.000Z");
const election: Election = {
  id: "8bc131c5-3228-46e4-b310-3555653d815d",
  titleKey: "election_br_2026_title",
  closesAt: null,
  sources: ["https://example.invalid/source"],
  candidates: [
    {
      id: 0,
      name: "Candidate 0",
      number: "10",
      party: "TEST",
      vice: { name: "Vice 0", party: "TEST" },
    },
    {
      id: 87,
      name: "Candidate 87",
      number: "20",
      party: "TEST",
      vice: { name: "Vice 87", party: "TEST" },
    },
    {
      id: 130,
      name: "Candidate 130",
      number: "30",
      party: "TEST",
      vice: { name: "Vice 130", party: "TEST" },
    },
  ],
};

async function acknowledge(d1: D1Database, voterId: string) {
  await acknowledgeElection(d1, election.id, voterId, at);
}

it("aggregates omitted-last pairwise preferences inside D1 and isolates elections", async () => {
  const { d1, dispose } = await openTestD1();
  try {
    await acknowledge(d1, "voter-a");
    await acknowledge(d1, "voter-b");
    await acknowledge(d1, "voter-c");
    await acknowledge(d1, "voter-blank");
    await acknowledgeElection(d1, "other-election", "voter-a", at);
    await replaceBallot(d1, election.id, "voter-a", [0, 87], at);
    await replaceBallot(d1, election.id, "voter-b", [130], at);
    await replaceBallot(d1, election.id, "voter-c", [87, 0, 130], at);
    await replaceBallot(d1, election.id, "voter-blank", [], at);
    await replaceBallot(d1, "other-election", "voter-a", [130, 0], at);

    const pairs = await readPairwiseCounts(d1, election);
    expect(condorcetOf([0, 87, 130], pairs)).toEqual({
      matrix: {
        0: { 0: 0, 87: 1, 130: 2 },
        87: { 0: 1, 87: 0, 130: 2 },
        130: { 0: 1, 87: 1, 130: 0 },
      },
      winnerId: null,
    });
    expect(pairs).toHaveLength(6);
  } finally {
    await dispose();
  }
});

it("only exposes aggregates to submitted voters while the nonempty threshold holds", async () => {
  const { d1, dispose } = await openTestD1();
  try {
    for (const voterId of ["never", "ack-only", "blank", "valid-a", "valid-b"]) {
      await acknowledge(d1, voterId);
    }
    await replaceBallot(d1, election.id, "valid-a", [0, 87, 130], at);
    await replaceBallot(d1, election.id, "valid-b", [87, 0], at);
    await acknowledge(d1, "valid-c");
    await replaceBallot(d1, election.id, "valid-c", [130], at);
    await replaceBallot(d1, election.id, "blank", [], at);

    expect(await readElectionCounts(d1, election.id)).toEqual({ validCount: 3, blankCount: 1 });
    const neverSubmitted = await readResults(d1, election, "never" as VoterId, 2);
    const acknowledgmentOnly = await readResults(d1, election, "ack-only" as VoterId, 2);
    expect(neverSubmitted).toEqual({
      state: "locked",
      validCount: 3,
      threshold: 2,
      reason: "not-submitted",
    });
    expect(acknowledgmentOnly).toEqual({
      state: "locked",
      validCount: 3,
      threshold: 2,
      reason: "not-submitted",
    });
    for (const locked of [neverSubmitted, acknowledgmentOnly]) {
      expect(Object.keys(locked)).not.toContain("methods");
      expect(Object.keys(locked)).not.toContain("matrix");
      expect(Object.keys(locked)).not.toContain("winnerId");
      expect(Object.keys(locked)).not.toContain("blankCount");
    }

    const available = await readResults(d1, election, "blank" as VoterId, 2);
    expect(available.state).toBe("available");
    if (available.state !== "available")
      throw new Error("Submitted blank voter should be eligible");
    expect(available.validCount).toBe(3);
    expect(available.blankCount).toBe(1);
    // The 0↔87 tie is real; neither roster order nor ID 0 may break it.
    expect(available).toHaveProperty("methods", {
      copeland: { winnerIds: [0, 87], unresolved: false },
      schulze: { winnerIds: [0, 87], unresolved: false },
      rankedPairs: { winnerIds: [0, 87], unresolved: false },
    });
    expect(JSON.stringify(available)).not.toContain("voter-");
    expect(JSON.stringify(available)).not.toContain("valid-a");

    await replaceBallot(d1, election.id, "valid-c", [], new Date("2026-10-16T12:00:00.000Z"));
    await replaceBallot(d1, election.id, "valid-b", [], new Date("2026-10-16T12:00:00.000Z"));
    const relocked = await readResults(d1, election, "blank" as VoterId, 2);
    expect(relocked).toEqual({ state: "locked", validCount: 1, threshold: 2, reason: "threshold" });
    expect(Object.keys(relocked)).not.toContain("matrix");
    expect(Object.keys(relocked)).not.toContain("methods");
    expect(Object.keys(relocked)).not.toContain("winnerId");
    expect(Object.keys(relocked)).not.toContain("blankCount");

    await replaceBallot(d1, election.id, "valid-c", [130], new Date("2026-10-17T12:00:00.000Z"));
    const unlockedAgain = await readResults(d1, election, "blank" as VoterId, 2);
    expect(unlockedAgain.state).toBe("available");
    expect(tally([0, 87, 130], await readPairwiseCounts(d1, election)).matrix).toEqual(
      unlockedAgain.state === "available" ? unlockedAgain.matrix : {},
    );

    const boundaryElection = { ...election, id: "boundary-election" };
    await acknowledgeElection(d1, boundaryElection.id, "boundary-valid", at);
    await acknowledgeElection(d1, boundaryElection.id, "boundary-blank", at);
    await replaceBallot(d1, boundaryElection.id, "boundary-valid", [0], at);
    await replaceBallot(d1, boundaryElection.id, "boundary-blank", [], at);
    expect(await readElectionCounts(d1, boundaryElection.id)).toEqual({
      validCount: 1,
      blankCount: 1,
    });
    expect(await readResults(d1, boundaryElection, "boundary-blank" as VoterId, 2)).toEqual({
      state: "locked",
      validCount: 1,
      threshold: 2,
      reason: "threshold",
    });
    expect(await readResults(d1, boundaryElection, "boundary-never" as VoterId, 2)).toEqual({
      state: "locked",
      validCount: 1,
      threshold: 2,
      reason: "not-submitted",
    });
    expect(await readResults(d1, boundaryElection, "boundary-valid" as VoterId, 1)).toMatchObject({
      state: "available",
    });
    expect(await readResults(d1, boundaryElection, "boundary-valid" as VoterId, null)).toEqual({
      state: "locked",
      validCount: 1,
      threshold: null,
      reason: "threshold",
    });
  } finally {
    await dispose();
  }
});

it("handles empty data, complete rankings, sparse ballots, and Condorcet cycles", async () => {
  const { d1, dispose } = await openTestD1();
  try {
    const emptyPairs = await readPairwiseCounts(d1, election);
    expect(emptyPairs).toEqual([]);
    expect(condorcetOf([0, 87, 130], emptyPairs)).toEqual({
      matrix: {
        0: { 0: 0, 87: 0, 130: 0 },
        87: { 0: 0, 87: 0, 130: 0 },
        130: { 0: 0, 87: 0, 130: 0 },
      },
      winnerId: null,
    });

    const sparseElection = { ...election, id: "sparse-election" };
    await acknowledgeElection(d1, sparseElection.id, "sparse-voter", at);
    await replaceBallot(d1, sparseElection.id, "sparse-voter", [0], at);
    expect(condorcetOf([0, 87, 130], await readPairwiseCounts(d1, sparseElection))).toEqual({
      matrix: {
        0: { 0: 0, 87: 1, 130: 1 },
        87: { 0: 0, 87: 0, 130: 0 },
        130: { 0: 0, 87: 0, 130: 0 },
      },
      winnerId: 0,
    });

    const cycleElection = { ...election, id: "cycle-election" };
    const cycleBallots = [
      { voterId: "cycle-a", ranking: [0, 87, 130] },
      { voterId: "cycle-b", ranking: [87, 130, 0] },
      { voterId: "cycle-c", ranking: [130, 0, 87] },
    ];
    for (const ballot of cycleBallots) {
      await acknowledgeElection(d1, cycleElection.id, ballot.voterId, at);
      await replaceBallot(d1, cycleElection.id, ballot.voterId, ballot.ranking, at);
    }
    expect(condorcetOf([0, 87, 130], await readPairwiseCounts(d1, cycleElection))).toEqual({
      matrix: {
        0: { 0: 0, 87: 2, 130: 1 },
        87: { 0: 1, 87: 0, 130: 2 },
        130: { 0: 2, 87: 1, 130: 0 },
      },
      winnerId: null,
    });
    const cycleResult = await readResults(d1, cycleElection, "cycle-a" as VoterId, 2);
    expect(cycleResult).toMatchObject({
      state: "available",
      winnerId: null,
      methods: {
        copeland: { winnerIds: [0, 87, 130], unresolved: false },
        schulze: { winnerIds: [0, 87, 130], unresolved: false },
        rankedPairs: { winnerIds: [0, 87, 130], unresolved: false },
      },
    });
  } finally {
    await dispose();
  }
});

it.each(["withdrawal", "eligibility loss"] as const)(
  "rechecks the aggregate snapshot after %s between the precheck and transaction",
  async (change) => {
    const { d1, dispose } = await openTestD1();
    try {
      for (const voterId of ["snapshot-a", "snapshot-b", "snapshot-blank"]) {
        await acknowledge(d1, voterId);
      }
      await replaceBallot(d1, election.id, "snapshot-a", [0], at);
      await replaceBallot(d1, election.id, "snapshot-b", [87], at);
      await replaceBallot(d1, election.id, "snapshot-blank", [], at);
      expect(await readResults(d1, election, null, 2)).toEqual({
        state: "locked",
        validCount: 2,
        threshold: 2,
        reason: "not-submitted",
      });

      let changed = false;
      const interceptedD1 = new Proxy(d1, {
        get(target, key) {
          if (key !== "batch") return Reflect.get(target, key, target);
          return async <T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]> => {
            // Write through the original binding before the real snapshot transaction.
            if (change === "withdrawal") {
              await replaceBallot(d1, election.id, "snapshot-b", [], at);
            } else {
              await d1
                .prepare("DELETE FROM election_participant WHERE election_id = ? AND voter_id = ?")
                .bind(election.id, "snapshot-blank")
                .run();
            }
            changed = true;
            return target.batch<T>(statements);
          };
        },
      });
      expect(await readResults(interceptedD1, election, "snapshot-blank" as VoterId, 2)).toEqual({
        state: "locked",
        validCount: change === "withdrawal" ? 1 : 2,
        threshold: 2,
        reason: change === "withdrawal" ? "threshold" : "not-submitted",
      });
      expect(changed).toBe(true);
    } finally {
      await dispose();
    }
  },
);
