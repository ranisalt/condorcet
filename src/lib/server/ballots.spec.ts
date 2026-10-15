import { expect, it } from "vitest";
import { getDb } from "./db/index.ts";
import { user } from "./db/auth.schema.ts";
import {
  acknowledgeElection,
  readElectionCounts,
  readOwnRanking,
  readParticipation,
  replaceBallot,
} from "./ballots.ts";
import { openTestD1 } from "../../test/d1.ts";

const firstTime = new Date("2026-10-15T12:00:00.000Z");
const secondTime = new Date("2026-10-16T12:00:00.000Z");

async function seedUser(d1: D1Database, id: string) {
  await getDb(d1)
    .insert(user)
    .values({
      id,
      name: `User ${id}`,
      email: `${id}@example.invalid`,
      emailVerified: false,
      createdAt: firstTime,
      updatedAt: firstTime,
    });
}

it("keeps acknowledgment separate and isolates participation and ordered rankings", async () => {
  const { d1, dispose } = await openTestD1();
  try {
    await seedUser(d1, "voter-a");
    await seedUser(d1, "voter-b");
    await acknowledgeElection(d1, "election-a", "voter-a", firstTime);
    await acknowledgeElection(d1, "election-a", "voter-a", secondTime);
    await acknowledgeElection(d1, "election-b", "voter-a", secondTime);
    await acknowledgeElection(d1, "election-a", "voter-b", secondTime);

    expect(await readParticipation(d1, "election-a", "voter-a")).toEqual({
      acknowledgedAt: firstTime,
      submittedAt: null,
    });
    expect(await readParticipation(d1, "election-a", "voter-b")).toEqual({
      acknowledgedAt: secondTime,
      submittedAt: null,
    });
    expect(await readParticipation(d1, "election-a", "unknown")).toBeNull();
    expect(await readOwnRanking(d1, "election-a", "voter-a")).toEqual([]);
    expect(await readOwnRanking(d1, "election-b", "voter-a")).toEqual([]);
  } finally {
    await dispose();
  }
});

it("atomically replaces rankings, accepts empty submissions, rolls back errors, and handles races", async () => {
  const { d1, dispose } = await openTestD1();
  try {
    await seedUser(d1, "voter-a");
    await seedUser(d1, "voter-b");
    await seedUser(d1, "voter-c");
    await acknowledgeElection(d1, "election-a", "voter-a", firstTime);
    await acknowledgeElection(d1, "election-a", "voter-b", firstTime);
    await acknowledgeElection(d1, "election-a", "voter-c", firstTime);
    await acknowledgeElection(d1, "election-b", "voter-a", firstTime);
    await replaceBallot(d1, "election-a", "voter-b", [94], firstTime);
    await replaceBallot(d1, "election-a", "voter-c", [], firstTime);
    await replaceBallot(d1, "election-b", "voter-a", [130, 94], firstTime);

    await replaceBallot(d1, "election-a", "voter-a", [130, 87], firstTime);
    expect(await readOwnRanking(d1, "election-a", "voter-a")).toEqual([130, 87]);
    await replaceBallot(d1, "election-a", "voter-a", [87, 130, 94], secondTime);
    expect(await readOwnRanking(d1, "election-a", "voter-a")).toEqual([87, 130, 94]);
    expect((await readParticipation(d1, "election-a", "voter-a"))?.submittedAt).toEqual(firstTime);
    expect(await readOwnRanking(d1, "election-b", "voter-a")).toEqual([130, 94]);
    expect(await readOwnRanking(d1, "election-a", "voter-b")).toEqual([94]);

    await expect(
      replaceBallot(d1, "election-a", "never-acknowledged", [0], firstTime),
    ).rejects.toThrow();
    expect(await readOwnRanking(d1, "election-a", "voter-b")).toEqual([94]);
    expect(await readOwnRanking(d1, "election-a", "voter-c")).toEqual([]);
    expect((await readParticipation(d1, "election-a", "voter-c"))?.submittedAt).toEqual(firstTime);

    await replaceBallot(d1, "election-a", "voter-a", [130, 87], secondTime);
    await expect(
      replaceBallot(d1, "election-a", "voter-a", [87, 87], secondTime),
    ).rejects.toThrow();
    expect(await readOwnRanking(d1, "election-a", "voter-a")).toEqual([130, 87]);
    expect((await readParticipation(d1, "election-a", "voter-a"))?.submittedAt).toEqual(firstTime);

    const alternatives = [
      [130, 87],
      [87, 130, 94],
    ] as const;
    await Promise.all(
      alternatives.map((ranking) =>
        replaceBallot(d1, "election-a", "voter-a", ranking, secondTime),
      ),
    );
    expect(alternatives).toContainEqual(await readOwnRanking(d1, "election-a", "voter-a"));

    await Promise.all([
      replaceBallot(d1, "election-a", "voter-a", [87, 130, 94], secondTime),
      replaceBallot(d1, "election-a", "voter-a", [], secondTime),
    ]);
    const finalRanking = await readOwnRanking(d1, "election-a", "voter-a");
    expect([[], [87, 130, 94]]).toContainEqual(finalRanking);
    const participantCount = await d1
      .prepare(
        "SELECT count(*) AS count FROM election_participant WHERE election_id = ? AND user_id = ?",
      )
      .bind("election-a", "voter-a")
      .all<{ count: number }>();
    expect(participantCount.results).toEqual([{ count: 1 }]);
    expect(await readOwnRanking(d1, "election-b", "voter-a")).toEqual([130, 94]);
    expect(await readOwnRanking(d1, "election-a", "voter-b")).toEqual([94]);
    expect(await readElectionCounts(d1, "election-a")).toEqual(
      finalRanking.length === 0
        ? { validCount: 1, blankCount: 2 }
        : { validCount: 2, blankCount: 1 },
    );
  } finally {
    await dispose();
  }
});

it("counts submitted nonempty accounts once and separates blanks by election", async () => {
  const { d1, dispose } = await openTestD1();
  try {
    for (const id of ["never", "ack-only", "empty", "valid", "changing", "other-election"]) {
      await seedUser(d1, id);
    }
    await acknowledgeElection(d1, "election-a", "ack-only", firstTime);
    await acknowledgeElection(d1, "election-a", "empty", firstTime);
    await acknowledgeElection(d1, "election-a", "valid", firstTime);
    await acknowledgeElection(d1, "election-a", "changing", firstTime);
    await acknowledgeElection(d1, "election-b", "other-election", firstTime);

    expect(await readElectionCounts(d1, "election-a")).toEqual({ validCount: 0, blankCount: 0 });
    await replaceBallot(d1, "election-a", "empty", [], firstTime);
    expect(await readElectionCounts(d1, "election-a")).toEqual({ validCount: 0, blankCount: 1 });
    await replaceBallot(d1, "election-a", "valid", [0, 87, 130], firstTime);
    expect(await readElectionCounts(d1, "election-a")).toEqual({ validCount: 1, blankCount: 1 });
    await replaceBallot(d1, "election-a", "changing", [130], firstTime);
    expect(await readElectionCounts(d1, "election-a")).toEqual({ validCount: 2, blankCount: 1 });
    await replaceBallot(d1, "election-a", "changing", [], secondTime);
    expect(await readElectionCounts(d1, "election-a")).toEqual({ validCount: 1, blankCount: 2 });
    await replaceBallot(d1, "election-a", "changing", [87, 0], secondTime);
    expect(await readElectionCounts(d1, "election-a")).toEqual({ validCount: 2, blankCount: 1 });
    expect(await readElectionCounts(d1, "election-b")).toEqual({ validCount: 0, blankCount: 0 });
  } finally {
    await dispose();
  }
});
