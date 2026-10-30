import { expect, it } from "vitest";
import { openTestD1 } from "../../../test/d1.ts";

const createdAt = new Date("2026-10-15T12:00:00.000Z");

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

    const participantInsert = d1
      .prepare(
        "INSERT INTO election_participant (election_id, voter_id, acknowledged_at, submitted_at) VALUES (?, ?, ?, ?)",
      )
      .bind("election-a", "voter-a", createdAt.getTime(), null);
    await participantInsert.run();
    await d1
      .prepare(
        "INSERT INTO election_participant (election_id, voter_id, acknowledged_at, submitted_at) VALUES (?, ?, ?, ?)",
      )
      .bind("election-b", "voter-a", createdAt.getTime(), null)
      .run();
    await d1
      .prepare(
        "INSERT INTO election_participant (election_id, voter_id, acknowledged_at, submitted_at) VALUES (?, ?, ?, ?)",
      )
      .bind("election-a", "voter-b", createdAt.getTime(), null)
      .run();

    const duplicateParticipant = d1
      .prepare(
        "INSERT INTO election_participant (election_id, voter_id, acknowledged_at, submitted_at) VALUES (?, ?, ?, ?)",
      )
      .bind("election-a", "voter-a", createdAt.getTime(), null);
    await expect(duplicateParticipant.run()).rejects.toThrow();

    await d1
      .prepare(
        "INSERT INTO ballot_rank (election_id, voter_id, candidate_id, position) VALUES (?, ?, ?, ?)",
      )
      .bind("election-a", "voter-a", 0, 0)
      .run();
    await expect(
      d1
        .prepare(
          "INSERT INTO ballot_rank (election_id, voter_id, candidate_id, position) VALUES (?, ?, ?, ?)",
        )
        .bind("election-a", "voter-a", 87, 0)
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "INSERT INTO ballot_rank (election_id, voter_id, candidate_id, position) VALUES (?, ?, ?, ?)",
        )
        .bind("election-a", "voter-a", 0, 1)
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "INSERT INTO ballot_rank (election_id, voter_id, candidate_id, position) VALUES (?, ?, ?, ?)",
        )
        .bind("election-a", "voter-a", -1, 1)
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "INSERT INTO ballot_rank (election_id, voter_id, candidate_id, position) VALUES (?, ?, ?, ?)",
        )
        .bind("election-a", "voter-a", 256, 1)
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "INSERT INTO ballot_rank (election_id, voter_id, candidate_id, position) VALUES (?, ?, ?, ?)",
        )
        .bind("missing-election", "voter-a", 130, 1)
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "INSERT INTO ballot_rank (election_id, voter_id, candidate_id, position) VALUES (?, ?, ?, ?)",
        )
        .bind("election-a", "voter-c", 130, 0)
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "INSERT INTO ballot_rank (election_id, voter_id, candidate_id, position) VALUES (?, ?, ?, ?)",
        )
        .bind("election-a", "voter-a", 130, -1)
        .run(),
    ).rejects.toThrow();

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
