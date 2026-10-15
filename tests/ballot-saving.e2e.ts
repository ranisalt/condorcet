import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { openE2ED1, resetFixture, TEST_ORIGIN } from "./helpers/d1.ts";
import { signInFixture } from "./helpers/session.ts";

const electionId = "8bc131c5-3228-46e4-b310-3555653d815d";
const candidateOrder = [87, 94, 125, 97, 240, 130, 173, 141, 108, 224, 137, 202];

async function prepareBallot(page: Page, context: BrowserContext) {
  await signInFixture(context, "test-voter");
  await page.goto("/acknowledgment");
  await page.getByRole("checkbox", { name: /Li e compreendi os avisos/ }).check();
  await page.getByRole("button", { name: "Concordar e abrir a cédula" }).click();
  await expect(page).toHaveURL(/\/ballot$/);
}

async function readOwnRows(userId = "test-voter") {
  const database = await openE2ED1();
  try {
    const ranks = await database.d1
      .prepare(
        "SELECT candidate_id, position FROM ballot_rank WHERE election_id = ? AND user_id = ? ORDER BY position",
      )
      .bind(electionId, userId)
      .all<{ candidate_id: number; position: number }>();
    const participation = await database.d1
      .prepare(
        "SELECT submitted_at FROM election_participant WHERE election_id = ? AND user_id = ?",
      )
      .bind(electionId, userId)
      .first<{ submitted_at: number | null }>();
    return { ranks: ranks.results, participation };
  } finally {
    await database.dispose();
  }
}

test.beforeEach(async () => {
  await resetFixture({ validCount: 0, blankCount: 0 });
});

test("saves ordered replacements, confirms blank submissions, and preserves eligibility", async ({
  page,
  context,
}) => {
  await prepareBallot(page, context);
  await page.getByRole("button", { name: "Adicionar Lula" }).click();
  await page.getByRole("button", { name: "Adicionar Escritor Augusto Cury" }).click();
  await page.getByRole("button", { name: "Enviar meu voto" }).click();
  await expect(page).toHaveURL(`/thanks?electionId=${electionId}`);
  await expect(page.getByRole("heading", { name: "Obrigado por participar!" })).toBeVisible();
  await expect(page.getByText(/Seu voto foi salvo/)).toBeVisible();
  expect((await readOwnRows()).ranks.map((row) => row.candidate_id)).toEqual([130, 87]);

  await page.goto("/ballot");
  const ranked = page.getByRole("list", { name: "Sua ordem de preferência" });
  await expect(ranked.getByRole("listitem")).toHaveText([/Lula/, /Escritor Augusto Cury/]);
  await page.getByRole("button", { name: "Remover Lula" }).click();
  await page.getByRole("button", { name: "Enviar meu voto" }).click();
  await expect(page).toHaveURL(`/thanks?electionId=${electionId}`);
  expect((await readOwnRows()).ranks.map((row) => row.candidate_id)).toEqual([87]);

  await page.goto("/ballot");
  await page.getByRole("button", { name: "Remover Escritor Augusto Cury" }).click();
  await page.getByRole("button", { name: "Enviar meu voto" }).click();
  await expect(page.getByText(/Seu voto em branco foi registrado/)).toBeVisible();
  expect(await readOwnRows()).toMatchObject({
    ranks: [],
    participation: { submitted_at: expect.any(Number) },
  });

  const counts = await openE2ED1();
  try {
    expect(
      await counts.d1
        .prepare(
          "SELECT count(*) AS count FROM election_participant WHERE election_id = ? AND submitted_at IS NOT NULL",
        )
        .bind(electionId)
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });
    expect(
      await counts.d1
        .prepare(
          "SELECT count(*) AS count FROM election_participant p WHERE p.election_id = ? AND p.submitted_at IS NOT NULL AND NOT EXISTS (SELECT 1 FROM ballot_rank r WHERE r.election_id = p.election_id AND r.user_id = p.user_id)",
        )
        .bind(electionId)
        .first<{ count: number }>(),
    ).toEqual({ count: 1 });
  } finally {
    await counts.dispose();
  }

  await page.goto("/ballot");
  await page.getByRole("button", { name: "Enviar meu voto" }).click();
  await expect(page.getByText(/Seu voto em branco foi registrado/)).toBeVisible();
  expect((await readOwnRows()).ranks).toEqual([]);
});

test("rejects invalid, stale, and forged submissions without changing another account", async ({
  page,
  context,
}) => {
  await prepareBallot(page, context);
  const requests: {
    candidateId?: string[];
    electionId?: string;
    candidateOrderId?: string[];
  }[] = [
    { candidateId: ["999"] },
    { candidateId: ["87", "87"] },
    { electionId: "8bc131c5-3228-46e4-b310-3555653d815e" },
    { candidateOrderId: ["87", "94"] },
  ];
  for (const overrides of requests) {
    const formData = new FormData();
    formData.set("electionId", overrides.electionId ?? electionId);
    const order = overrides.candidateOrderId ?? candidateOrder.map(String);
    for (const id of order) formData.append("candidateOrderId", id);
    const ranking = overrides.candidateId ?? ["130", "87"];
    for (const id of ranking) formData.append("candidateId", id);
    formData.set("userId", "test-other");
    const response = await page.request.post("/ballot?/save", {
      form: formData,
      headers: { Origin: TEST_ORIGIN },
      maxRedirects: 0,
    });
    expect([400, 409]).toContain(response.status());
  }

  const forgedFile = await page.evaluate(
    async ({ electionId: selectedId, candidateOrder }) => {
      const form = new FormData();
      form.append("electionId", selectedId);
      for (const id of candidateOrder) form.append("candidateOrderId", String(id));
      form.append("candidateId", new File(["130"], "candidate.txt", { type: "text/plain" }));
      return (await fetch("/ballot?/save", { method: "POST", body: form })).status;
    },
    { electionId, candidateOrder },
  );
  expect(forgedFile).toBe(400);
  expect((await readOwnRows()).participation).toMatchObject({ submitted_at: null });
  expect((await readOwnRows("test-other")).participation).toBeNull();
});

test("submits successfully with JavaScript disabled", async ({ browser }) => {
  const nativeContext = await browser.newContext({ javaScriptEnabled: false });
  try {
    await signInFixture(nativeContext, "test-voter");
    const nativePage = await nativeContext.newPage();
    await nativePage.goto("/acknowledgment");
    await nativePage.locator('input[name="acknowledged"]').check();
    await nativePage.getByRole("button", { name: "Concordar e abrir a cédula" }).click();
    await nativePage.getByRole("button", { name: "Adicionar Lula" }).click();
    await nativePage.getByRole("button", { name: "Enviar meu voto" }).click();
    await expect(nativePage).toHaveURL(`/thanks?electionId=${electionId}`);
    expect((await readOwnRows()).ranks.map((row) => row.candidate_id)).toEqual([130]);
  } finally {
    await nativeContext.close();
  }
});
