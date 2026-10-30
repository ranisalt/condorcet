import { expect, test } from "@playwright/test";
import { openE2ED1, resetFixture, TEST_ORIGIN } from "./helpers/d1.ts";
import { signInFixture } from "./helpers/session.ts";

const electionId = "8bc131c5-3228-46e4-b310-3555653d815d";
const candidateIds = [87, 94, 125, 97, 240, 130, 173, 141, 108, 224, 137, 202];

test.beforeEach(async () => {
  await resetFixture({ validCount: 0, blankCount: 0 });
});

test("supports unsaved native edits without JavaScript or database writes", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    await signInFixture(context, "test-voter");
    const page = await context.newPage();
    await page.goto("/acknowledgment");
    await page.locator('input[name="acknowledged"]').check();
    await page.getByRole("button", { name: "Concordar e abrir a cédula" }).click();
    await expect(page).toHaveURL(/\/ballot$/);

    await page.getByRole("button", { name: "Adicionar Lula" }).click();
    await expect(
      page.getByRole("list", { name: "Sua ordem de preferência" }).getByRole("listitem"),
    ).toHaveText(/Lula/);
    await page.getByRole("button", { name: "Adicionar Escritor Augusto Cury" }).click();
    await page.getByRole("button", { name: "Mover Escritor Augusto Cury para cima" }).click();
    await expect(
      page.getByRole("list", { name: "Sua ordem de preferência" }).getByRole("listitem"),
    ).toHaveText([/Escritor Augusto Cury/, /Lula/]);

    const database = await openE2ED1();
    try {
      const participant = await database.d1
        .prepare(
          "SELECT submitted_at FROM election_participant WHERE election_id = ? AND voter_id = ?",
        )
        .bind(electionId, "test-voter")
        .first<{ submitted_at: number | null }>();
      const ranks = await database.d1
        .prepare("SELECT candidate_id FROM ballot_rank WHERE election_id = ? AND voter_id = ?")
        .bind(electionId, "test-voter")
        .all<{ candidate_id: number }>();
      expect(participant).not.toBeNull();
      expect(participant?.submitted_at).toBeNull();
      expect(ranks.results).toEqual([]);
    } finally {
      await database.dispose();
    }

    const forgedForm = new FormData();
    forgedForm.set("electionId", electionId);
    forgedForm.set("operation", "add:999");
    for (const id of candidateIds) forgedForm.append("candidateOrderId", String(id));
    forgedForm.append("candidateId", "130");
    forgedForm.append("candidateId", "87");
    forgedForm.set("userId", "test-other");
    const forged = await page.request.post("/ballot?/edit", {
      form: forgedForm,
      headers: { Origin: TEST_ORIGIN },
      maxRedirects: 0,
    });
    expect(forged.status()).toBe(400);
    const after = await openE2ED1();
    try {
      const submitted = await after.d1
        .prepare(
          "SELECT submitted_at FROM election_participant WHERE election_id = ? AND voter_id = ?",
        )
        .bind(electionId, "test-voter")
        .first<{ submitted_at: number | null }>();
      expect(submitted?.submitted_at).toBeNull();
      expect(
        await after.d1
          .prepare(
            "SELECT count(*) AS count FROM ballot_rank WHERE election_id = ? AND voter_id = ?",
          )
          .bind(electionId, "test-other")
          .first<{ count: number }>(),
      ).toEqual({ count: 0 });
    } finally {
      await after.dispose();
    }
  } finally {
    await context.close();
  }
});
