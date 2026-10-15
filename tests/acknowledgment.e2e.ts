import { expect, test } from "@playwright/test";
import { openE2ED1, resetFixture } from "./helpers/d1.ts";
import { signInFixture } from "./helpers/session.ts";

test.beforeEach(async () => {
  await resetFixture({ validCount: 0, blankCount: 0 });
});

test("protects the ballot HTML and data request until this account acknowledges", async ({
  page,
  context,
}) => {
  await page.goto("/ballot");
  await expect(page).toHaveURL(/\/$/);

  await signInFixture(context, "test-voter");
  await page.goto("/ballot");
  await expect(page).toHaveURL(/\/acknowledgment$/);
  const protectedResponse = await page.request.get("/ballot/__data.json", { maxRedirects: 0 });
  expect(protectedResponse.status()).toBeLessThan(500);
  const dataBody = await protectedResponse.text();
  expect(dataBody).not.toContain("Lula");
  expect(dataBody).not.toContain("Flávio Bolsonaro");
  expect(dataBody).not.toContain('"ranked"');

  await page.getByRole("checkbox", { name: /Li e compreendi os avisos/ }).check();
  await page.getByRole("button", { name: "Concordar e abrir a cédula" }).click();
  await expect(page).toHaveURL(/\/ballot$/);
  await expect(page.getByText("Lula", { exact: true })).toBeVisible();

  const otherContext = await page.context().browser()?.newContext();
  if (otherContext === undefined) throw new Error("Expected a second browser context");
  try {
    await signInFixture(otherContext, "test-other");
    const otherPage = await otherContext.newPage();
    await otherPage.goto("/ballot");
    await expect(otherPage).toHaveURL(/\/acknowledgment$/);
    await expect(otherPage.getByText("Lula", { exact: true })).toHaveCount(0);
  } finally {
    await otherContext.close();
  }
});

test("rejects unchecked consent and does not create a submission", async ({ page, context }) => {
  await signInFixture(context, "test-voter");
  await page.goto("/acknowledgment");
  const response = await page.request.post("/acknowledgment", {
    form: { electionId: "8bc131c5-3228-46e4-b310-3555653d815d" },
    headers: { Origin: "http://localhost:4173" },
    maxRedirects: 0,
  });
  expect(response.status()).toBe(400);

  const database = await openE2ED1();
  try {
    const participant = await database.d1
      .prepare(
        "SELECT acknowledged_at, submitted_at FROM election_participant WHERE election_id = ? AND user_id = ?",
      )
      .bind("8bc131c5-3228-46e4-b310-3555653d815d", "test-voter")
      .first<{ acknowledged_at: number; submitted_at: number | null }>();
    expect(participant).toBeNull();
  } finally {
    await database.dispose();
  }
});
