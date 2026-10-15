import { expect, it } from "vitest";
import { getDb } from "./index.ts";
import { user } from "./auth.schema.ts";
import { openTestD1 } from "../../../test/d1.ts";

const createdAt = new Date("2026-10-15T12:00:00.000Z");

async function seedUser(d1: D1Database, id: string) {
  await getDb(d1)
    .insert(user)
    .values({
      id,
      name: `User ${id}`,
      email: `${id}@example.invalid`,
      emailVerified: false,
      createdAt,
      updatedAt: createdAt,
    });
}

it("enforces participant, ballot-rank, range, and cascade constraints", async () => {
  const { d1, dispose } = await openTestD1();
  try {
    await seedUser(d1, "voter-a");
    await seedUser(d1, "voter-b");

    const participantInsert = d1
      .prepare(
        "INSERT INTO election_participant (election_id, user_id, acknowledged_at, submitted_at) VALUES (?, ?, ?, ?)",
      )
      .bind("election-a", "voter-a", createdAt.getTime(), null);
    await participantInsert.run();
    await d1
      .prepare(
        "INSERT INTO election_participant (election_id, user_id, acknowledged_at, submitted_at) VALUES (?, ?, ?, ?)",
      )
      .bind("election-b", "voter-a", createdAt.getTime(), null)
      .run();
    await d1
      .prepare(
        "INSERT INTO election_participant (election_id, user_id, acknowledged_at, submitted_at) VALUES (?, ?, ?, ?)",
      )
      .bind("election-a", "voter-b", createdAt.getTime(), null)
      .run();

    const duplicateParticipant = d1
      .prepare(
        "INSERT INTO election_participant (election_id, user_id, acknowledged_at, submitted_at) VALUES (?, ?, ?, ?)",
      )
      .bind("election-a", "voter-a", createdAt.getTime(), null);
    await expect(duplicateParticipant.run()).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "INSERT INTO election_participant (election_id, user_id, acknowledged_at, submitted_at) VALUES (?, ?, ?, ?)",
        )
        .bind("election-a", "missing-user", createdAt.getTime(), null)
        .run(),
    ).rejects.toThrow();

    await d1
      .prepare(
        "INSERT INTO ballot_rank (election_id, user_id, candidate_id, position) VALUES (?, ?, ?, ?)",
      )
      .bind("election-a", "voter-a", 0, 0)
      .run();
    await expect(
      d1
        .prepare(
          "INSERT INTO ballot_rank (election_id, user_id, candidate_id, position) VALUES (?, ?, ?, ?)",
        )
        .bind("election-a", "voter-a", 87, 0)
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "INSERT INTO ballot_rank (election_id, user_id, candidate_id, position) VALUES (?, ?, ?, ?)",
        )
        .bind("election-a", "voter-a", 0, 1)
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "INSERT INTO ballot_rank (election_id, user_id, candidate_id, position) VALUES (?, ?, ?, ?)",
        )
        .bind("election-a", "voter-a", -1, 1)
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "INSERT INTO ballot_rank (election_id, user_id, candidate_id, position) VALUES (?, ?, ?, ?)",
        )
        .bind("election-a", "voter-a", 256, 1)
        .run(),
    ).rejects.toThrow();
    await expect(
      d1
        .prepare(
          "INSERT INTO ballot_rank (election_id, user_id, candidate_id, position) VALUES (?, ?, ?, ?)",
        )
        .bind("missing-election", "voter-a", 130, 1)
        .run(),
    ).rejects.toThrow();

    await seedUser(d1, "voter-c");
    await expect(
      d1
        .prepare(
          "INSERT INTO ballot_rank (election_id, user_id, candidate_id, position) VALUES (?, ?, ?, ?)",
        )
        .bind("election-a", "voter-c", 130, 0)
        .run(),
    ).rejects.toThrow();

    const beforeDelete = await d1
      .prepare(
        "SELECT election_id, user_id FROM election_participant ORDER BY election_id, user_id",
      )
      .all<{ election_id: string; user_id: string }>();
    expect(beforeDelete.results).toEqual([
      { election_id: "election-a", user_id: "voter-a" },
      { election_id: "election-a", user_id: "voter-b" },
      { election_id: "election-b", user_id: "voter-a" },
    ]);

    await expect(
      d1
        .prepare(
          "INSERT INTO ballot_rank (election_id, user_id, candidate_id, position) VALUES (?, ?, ?, ?)",
        )
        .bind("election-a", "voter-a", 130, -1)
        .run(),
    ).rejects.toThrow();
    await d1.prepare("DELETE FROM user WHERE id = ?").bind("voter-a").run();
    const remaining = await d1
      .prepare(
        "SELECT election_id, user_id, candidate_id FROM ballot_rank ORDER BY election_id, user_id",
      )
      .all<{ election_id: string; user_id: string; candidate_id: number }>();
    expect(remaining.results).toEqual([]);

    const participants = await d1
      .prepare(
        "SELECT election_id, user_id FROM election_participant ORDER BY election_id, user_id",
      )
      .all<{ election_id: string; user_id: string }>();
    expect(participants.results).toEqual([{ election_id: "election-a", user_id: "voter-b" }]);
  } finally {
    await dispose();
  }
});
