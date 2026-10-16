import { expect, test } from "@playwright/test";
import { openE2ED1, resetFixture } from "./helpers/d1.ts";
import { signInFixture } from "./helpers/session.ts";

const electionId = "8bc131c5-3228-46e4-b310-3555653d815d";

test("reveals results only at the valid-ballot threshold and relocks after withdrawal", async ({
  page,
  context,
  browser,
}) => {
  test.setTimeout(180_000);
  await resetFixture({ validCount: 9999, blankCount: 1 });

  await signInFixture(context, "test-other");
  await page.goto("/results");
  await expect(page.getByText("Votos válidos: 9.999")).toBeVisible();
  await expect(page.getByText(/Envie seu voto para consultar os resultados/)).toBeVisible();
  const lockedHtml = await page.content();
  expect(lockedHtml).not.toContain("Votos em branco:");
  expect(lockedHtml).not.toContain("Comparações entre candidaturas");
  expect(lockedHtml).not.toContain("Vencedor de Condorcet");

  const lockedData = await page.request.get("/results/__data.json");
  const lockedPayload = await lockedData.text();
  expect(lockedPayload).not.toContain('"matrix"');
  expect(lockedPayload).not.toContain('"winnerId"');
  expect(lockedPayload).not.toContain('"blankCount"');
  expect(lockedPayload).not.toContain('"methods"');
  expect(lockedPayload).not.toContain("Lula");

  await signInFixture(context, "test-voter");
  await page.goto("/acknowledgment");
  await page.getByRole("checkbox", { name: /Li e compreendi os avisos/ }).check();
  await page.getByRole("button", { name: "Concordar e abrir a cédula" }).click();
  await page.getByRole("button", { name: "Enviar meu voto" }).click();
  await expect(page).toHaveURL(new RegExp(`/thanks\\?electionId=${electionId}`));
  await page.goto("/results");
  await expect(page.getByText("Votos válidos: 9.999")).toBeVisible();
  await expect(page.getByText(/Ainda não há votos válidos suficientes/)).toBeVisible();

  await signInFixture(context, "test-other");
  await page.goto("/acknowledgment");
  await page.getByRole("checkbox", { name: /Li e compreendi os avisos/ }).check();
  await page.getByRole("button", { name: "Concordar e abrir a cédula" }).click();
  await page.getByRole("button", { name: "Adicionar Escritor Augusto Cury" }).click();
  await page.getByRole("button", { name: "Enviar meu voto" }).click();
  await expect(page).toHaveURL(new RegExp(`/thanks\\?electionId=${electionId}`));

  await signInFixture(context, "test-voter");
  await page.goto("/results");
  await expect(page.getByRole("table", { name: "Comparações entre candidaturas" })).toBeVisible();
  await expect(page.getByText(/Votos em branco: 2/)).toBeVisible();
  await expect(page.getByRole("columnheader", { name: /Lula/ })).toBeVisible();
  await expect(page.getByRole("cell", { name: /10\.000/ }).first()).toBeVisible();

  for (const method of ["Schulze / Beatpath", "Tideman", "Copeland"]) {
    await page.getByRole("link", { name: method, exact: true }).click();
    await expect(page.getByRole("link", { name: method, exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await expect(page.getByRole("region", { name: `Resultado por ${method}` })).toBeVisible();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const matrixRegion = page.getByRole("region", {
    name: "Comparações entre candidaturas",
    exact: true,
  });
  await expect(matrixRegion).toHaveAttribute("tabindex", "0");
  expect(await matrixRegion.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(
    true,
  );

  const nativeContext = await browser.newContext({ javaScriptEnabled: false });
  try {
    await signInFixture(nativeContext, "test-voter");
    const nativePage = await nativeContext.newPage();
    await nativePage.goto("http://localhost:4173/results?method=schulze");
    await expect(
      nativePage.getByRole("link", { name: "Schulze / Beatpath", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await nativePage.getByRole("link", { name: "Tideman", exact: true }).click();
    await expect(nativePage.getByRole("region", { name: "Resultado por Tideman" })).toBeVisible();
    await nativePage.goto("http://localhost:4173/results?method=invalid");
    await expect(nativePage.getByRole("link", { name: "Copeland", exact: true })).toHaveAttribute(
      "aria-current",
      "page",
    );
  } finally {
    await nativeContext.close();
  }

  await signInFixture(context, "test-other");
  await page.goto("/ballot");
  await page.getByRole("button", { name: "Remover Escritor Augusto Cury" }).click();
  await page.getByRole("button", { name: "Enviar meu voto" }).click();
  await expect(page).toHaveURL(new RegExp(`/thanks\\?electionId=${electionId}`));

  await signInFixture(context, "test-voter");
  await page.goto("/results");
  await expect(page.getByText("Votos válidos: 9.999")).toBeVisible();
  await expect(page.getByText(/Ainda não há votos válidos suficientes/)).toBeVisible();
  await expect(page.getByRole("table")).toHaveCount(0);
  const relockedPayload = await (await page.request.get("/results/__data.json")).text();
  expect(relockedPayload).not.toContain('"matrix"');
  expect(relockedPayload).not.toContain('"blankCount"');
  expect(relockedPayload).not.toContain('"methods"');

  const database = await openE2ED1();
  try {
    const valid = await database.d1
      .prepare(
        "SELECT count(*) AS count FROM election_participant p WHERE p.election_id = ? AND p.submitted_at IS NOT NULL AND EXISTS (SELECT 1 FROM ballot_rank r WHERE r.election_id = p.election_id AND r.user_id = p.user_id)",
      )
      .bind(electionId)
      .first<{ count: number }>();
    expect(valid?.count).toBe(9999);
  } finally {
    await database.dispose();
  }
});
