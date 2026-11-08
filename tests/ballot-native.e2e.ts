import { expect, test } from "@playwright/test";
import { acknowledge, readOwnRows } from "./helpers/ballot.ts";
import { CANDIDATE_ORDER, ELECTION_ID, resetFixture, TEST_ORIGIN } from "./helpers/d1.ts";
import { signInFixture } from "./helpers/session.ts";

test.beforeEach(async () => {
  await resetFixture({ validCount: 0, blankCount: 0 });
});

test("supports unsaved native edits without JavaScript or database writes", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  try {
    await signInFixture(context, "test-voter");
    const page = await context.newPage();
    await acknowledge(page);

    await page.getByRole("button", { name: "Adicionar Lula" }).click();
    await expect(
      page.getByRole("list", { name: "Sua ordem de preferência" }).getByRole("listitem"),
    ).toHaveText(/Lula/);
    await page.getByRole("button", { name: "Adicionar Escritor Augusto Cury" }).click();
    await page.getByRole("button", { name: "Mover Escritor Augusto Cury para cima" }).click();
    await expect(
      page.getByRole("list", { name: "Sua ordem de preferência" }).getByRole("listitem"),
    ).toHaveText([/Escritor Augusto Cury/, /Lula/]);

    expect(await readOwnRows()).toEqual({ ranks: [], participation: { submitted_at: null } });

    const forgedForm = new FormData();
    forgedForm.set("electionId", ELECTION_ID);
    forgedForm.set("operation", "add:999");
    for (const id of CANDIDATE_ORDER) forgedForm.append("candidateOrderId", String(id));
    forgedForm.append("candidateId", "130");
    forgedForm.append("candidateId", "87");
    forgedForm.set("userId", "test-other");
    const forged = await page.request.post("/ballot?/edit", {
      form: forgedForm,
      headers: { Origin: TEST_ORIGIN },
      maxRedirects: 0,
    });
    expect(forged.status()).toBe(400);
    expect((await readOwnRows()).participation).toEqual({ submitted_at: null });
    expect((await readOwnRows("test-other")).ranks).toEqual([]);
  } finally {
    await context.close();
  }
});
