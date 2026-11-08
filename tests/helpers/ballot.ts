import { expect, type BrowserContext, type Page } from "@playwright/test";
import { ELECTION_ID, openE2ED1 } from "./d1.ts";
import { signInFixture } from "./session.ts";

/** Agrees to the notices on /acknowledgment; works with and without JavaScript. */
export async function acknowledge(page: Page): Promise<void> {
  await page.goto("/acknowledgment");
  await page.getByRole("checkbox", { name: /Li e compreendi os avisos/ }).check();
  await page.getByRole("button", { name: "Concordar e abrir a cédula" }).click();
  await expect(page).toHaveURL(/\/ballot$/);
}

export async function openAcknowledgedBallot(
  page: Page,
  context: BrowserContext,
  voterId: "test-voter" | "test-other" = "test-voter",
): Promise<void> {
  await signInFixture(context, voterId);
  await acknowledge(page);
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

/** One voter's stored ranking and participation row (null when never acknowledged). */
export async function readOwnRows(voterId = "test-voter") {
  const database = await openE2ED1();
  try {
    const ranks = await database.d1
      .prepare(
        "SELECT candidate_id, position FROM ballot_rank WHERE election_id = ? AND voter_id = ? ORDER BY position",
      )
      .bind(ELECTION_ID, voterId)
      .all<{ candidate_id: number; position: number }>();
    const participation = await database.d1
      .prepare(
        "SELECT submitted_at FROM election_participant WHERE election_id = ? AND voter_id = ?",
      )
      .bind(ELECTION_ID, voterId)
      .first<{ submitted_at: number | null }>();
    return { ranks: ranks.results, participation };
  } finally {
    await database.dispose();
  }
}

const SUBMITTED_FILTERS = {
  all: "",
  valid:
    "AND EXISTS (SELECT 1 FROM ballot_rank r WHERE r.election_id = p.election_id AND r.voter_id = p.voter_id)",
  blank:
    "AND NOT EXISTS (SELECT 1 FROM ballot_rank r WHERE r.election_id = p.election_id AND r.voter_id = p.voter_id)",
};

/** Counts submitted participants: all of them, those with a ranking, or blank ones. */
export async function countSubmitted(kind: keyof typeof SUBMITTED_FILTERS): Promise<number> {
  const database = await openE2ED1();
  try {
    const row = await database.d1
      .prepare(
        `SELECT count(*) AS count FROM election_participant p WHERE p.election_id = ? AND p.submitted_at IS NOT NULL ${SUBMITTED_FILTERS[kind]}`,
      )
      .bind(ELECTION_ID)
      .first<{ count: number }>();
    return row?.count ?? 0;
  } finally {
    await database.dispose();
  }
}
