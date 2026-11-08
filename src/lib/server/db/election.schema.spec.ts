import { expect, it } from "vitest";
import { openTestD1 } from "../../../test/d1.ts";

const createdAt = new Date("2026-10-15T12:00:00.000Z");

function insertParticipant(d1: D1Database, electionId: string, voterId: string) {
  return d1
    .prepare(
      "INSERT INTO election_participant (election_id, voter_id, acknowledged_at, submitted_at) VALUES (?, ?, ?, ?)",
    )
    .bind(electionId, voterId, createdAt.getTime(), null)
    .run();
}

function insertRank(
  d1: D1Database,
  electionId: string,
  voterId: string,
  candidateId: number,
  position: number,
) {
  return d1
    .prepare(
      "INSERT INTO ballot_rank (election_id, voter_id, candidate_id, position) VALUES (?, ?, ?, ?)",
    )
    .bind(electionId, voterId, candidateId, position)
    .run();
}

it("enforces participant, ballot-rank, range, and cascade constraints without identity tables", async () => {
  const { d1, dispose } = await openTestD1();
  try {
    const tables = await d1
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all<{ name: string }>();
    const names = tables.results.map((row) => row.name);
    expect(names).not.toContain("user");
    expect(names).not.toContain("session");
    expect(names).not.toContain("account");

    await insertParticipant(d1, "election-a", "voter-a");
    await insertParticipant(d1, "election-b", "voter-a");
    await insertParticipant(d1, "election-a", "voter-b");

    await expect(insertParticipant(d1, "election-a", "voter-a")).rejects.toThrow();

    await insertRank(d1, "election-a", "voter-a", 0, 0);
    await expect(insertRank(d1, "election-a", "voter-a", 87, 0)).rejects.toThrow();
    await expect(insertRank(d1, "election-a", "voter-a", 0, 1)).rejects.toThrow();
    await expect(insertRank(d1, "election-a", "voter-a", -1, 1)).rejects.toThrow();
    await expect(insertRank(d1, "election-a", "voter-a", 256, 1)).rejects.toThrow();
    await expect(insertRank(d1, "missing-election", "voter-a", 130, 1)).rejects.toThrow();
    await expect(insertRank(d1, "election-a", "voter-c", 130, 0)).rejects.toThrow();
    await expect(insertRank(d1, "election-a", "voter-a", 130, -1)).rejects.toThrow();

    const participants = await d1
      .prepare(
        "SELECT election_id, voter_id FROM election_participant ORDER BY election_id, voter_id",
      )
      .all<{ election_id: string; voter_id: string }>();
    expect(participants.results).toEqual([
      { election_id: "election-a", voter_id: "voter-a" },
      { election_id: "election-a", voter_id: "voter-b" },
      { election_id: "election-b", voter_id: "voter-a" },
    ]);

    await d1
      .prepare("DELETE FROM election_participant WHERE election_id = ? AND voter_id = ?")
      .bind("election-a", "voter-a")
      .run();
    const remaining = await d1
      .prepare(
        "SELECT election_id, voter_id, candidate_id FROM ballot_rank ORDER BY election_id, voter_id",
      )
      .all<{ election_id: string; voter_id: string; candidate_id: number }>();
    expect(remaining.results).toEqual([]);
  } finally {
    await dispose();
  }
});
