import { expect, test } from "@playwright/test";
import {
  acknowledge,
  countSubmitted,
  openAcknowledgedBallot,
  readOwnRows,
} from "./helpers/ballot.ts";
import { CANDIDATE_ORDER, ELECTION_ID, resetFixture, TEST_ORIGIN } from "./helpers/d1.ts";
import { signInFixture } from "./helpers/session.ts";

test.beforeEach(async () => {
  await resetFixture({ validCount: 0, blankCount: 0 });
});

test("saves ordered replacements, confirms blank submissions, and preserves eligibility", async ({
  page,
  context,
}) => {
  await openAcknowledgedBallot(page, context);
  await page.getByRole("button", { name: "Adicionar Lula" }).click();
  await page.getByRole("button", { name: "Adicionar Escritor Augusto Cury" }).click();
  await page.getByRole("button", { name: "Enviar meu voto" }).click();
  await expect(page).toHaveURL(`/thanks?electionId=${ELECTION_ID}`);
  await expect(page.getByRole("heading", { name: "Cédula registrada" })).toBeVisible();
  await expect(page.getByText(/Seu voto foi salvo/)).toBeVisible();
  expect((await readOwnRows()).ranks.map((row) => row.candidate_id)).toEqual([130, 87]);

  await page.goto("/ballot");
  const ranked = page.getByRole("list", { name: "Sua ordem de preferência" });
  await expect(ranked.getByRole("listitem")).toHaveText([/Lula/, /Escritor Augusto Cury/]);
  await page.getByRole("button", { name: "Remover Lula" }).click();
  await page.getByRole("button", { name: "Enviar meu voto" }).click();
  await expect(page).toHaveURL(`/thanks?electionId=${ELECTION_ID}`);
  expect((await readOwnRows()).ranks.map((row) => row.candidate_id)).toEqual([87]);

  await page.goto("/ballot");
  await page.getByRole("button", { name: "Remover Escritor Augusto Cury" }).click();
  await page.getByRole("button", { name: "Enviar meu voto" }).click();
  await expect(page.getByText(/Seu voto em branco foi registrado/)).toBeVisible();
  expect(await readOwnRows()).toMatchObject({
    ranks: [],
    participation: { submitted_at: expect.any(Number) },
  });

  expect(await countSubmitted("all")).toBe(1);
  expect(await countSubmitted("blank")).toBe(1);

  await page.goto("/ballot");
  await page.getByRole("button", { name: "Enviar meu voto" }).click();
  await expect(page.getByText(/Seu voto em branco foi registrado/)).toBeVisible();
  expect((await readOwnRows()).ranks).toEqual([]);
});

test("rejects invalid, stale, and forged submissions without changing another account", async ({
  page,
  context,
}) => {
  await openAcknowledgedBallot(page, context);
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
    formData.set("electionId", overrides.electionId ?? ELECTION_ID);
    const order = overrides.candidateOrderId ?? CANDIDATE_ORDER.map(String);
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
    async ({ electionId, candidateOrder }) => {
      const form = new FormData();
      form.append("electionId", electionId);
      for (const id of candidateOrder) form.append("candidateOrderId", String(id));
      form.append("candidateId", new File(["130"], "candidate.txt", { type: "text/plain" }));
      return (await fetch("/ballot?/save", { method: "POST", body: form })).status;
    },
    { electionId: ELECTION_ID, candidateOrder: CANDIDATE_ORDER },
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
    await acknowledge(nativePage);
    await nativePage.getByRole("button", { name: "Adicionar Lula" }).click();
    await nativePage.getByRole("button", { name: "Enviar meu voto" }).click();
    await expect(nativePage).toHaveURL(`/thanks?electionId=${ELECTION_ID}`);
    expect((await readOwnRows()).ranks.map((row) => row.candidate_id)).toEqual([130]);
  } finally {
    await nativeContext.close();
  }
});
