import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { resetFixture } from "./helpers/d1.ts";
import { signInFixture } from "./helpers/session.ts";

async function openAcknowledgedBallot(page: Page, context: BrowserContext) {
  await signInFixture(context, "test-voter");
  await page.goto("/acknowledgment");
  await page.getByRole("checkbox", { name: /Li e compreendi os avisos/ }).check();
  await page.getByRole("button", { name: "Concordar e abrir a cédula" }).click();
  await expect(page).toHaveURL(/\/ballot$/);
}

test.beforeEach(async () => {
  await resetFixture({ validCount: 0, blankCount: 0 });
});

test("fills the submit bar with text without shrinking its button", async ({ page, context }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openAcknowledgedBallot(page, context);
  const button = page.getByRole("button", { name: "Enviar meu voto", exact: true });
  const text = page.getByRole("paragraph").filter({ hasText: /Somente o envio confirma/ });
  await expect(button).toHaveCSS("flex-shrink", "0");
  const textBox = await text.boundingBox();
  const buttonBox = await button.boundingBox();
  expect(textBox).not.toBeNull();
  expect(buttonBox).not.toBeNull();
  if (textBox && buttonBox) {
    expect(textBox.width).toBeGreaterThan(608);
    expect(buttonBox.x - (textBox.x + textBox.width)).toBeCloseTo(24, 0);
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(button).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath(`ballot-${width}.png`), fullPage: true });
  }
});

test("edits ticket ranks locally, preserves vice details, and leaves storage unchanged until submit", async ({
  page,
  context,
}) => {
  await openAcknowledgedBallot(page, context);
  const ranked = page.getByRole("list", { name: "Sua ordem de preferência" });

  await page.getByRole("button", { name: "Adicionar Lula" }).click();
  await page.getByRole("button", { name: "Adicionar Escritor Augusto Cury" }).click();
  await expect(ranked.getByRole("listitem")).toHaveText([/Lula/, /Escritor Augusto Cury/]);
  await expect(ranked.getByText(/Geraldo Alckmin/)).toBeVisible();
  await expect(ranked.getByText(/Júlio Delgado/)).toBeVisible();

  await page.getByRole("button", { name: "Mover Escritor Augusto Cury para cima" }).click();
  await expect(ranked.getByRole("listitem")).toHaveText([/Escritor Augusto Cury/, /Lula/]);
  await expect(
    page.getByRole("button", { name: "Mover Escritor Augusto Cury para cima" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Mover Escritor Augusto Cury para baixo" }).click();
  await expect(ranked.getByRole("listitem")).toHaveText([/Lula/, /Escritor Augusto Cury/]);

  await page.getByRole("button", { name: "Remover Lula" }).click();
  await expect(ranked.getByRole("listitem")).toHaveText([/Escritor Augusto Cury/]);
  await page.getByRole("button", { name: "Adicionar Lula" }).click();
  await expect(ranked.getByRole("listitem")).toHaveText([/Escritor Augusto Cury/, /Lula/]);
  await expect(page.getByRole("button", { name: "Adicionar Lula" })).toHaveCount(0);

  await page.reload();
  await expect(
    page.getByRole("list", { name: "Sua ordem de preferência" }).getByRole("listitem"),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Adicionar Lula" }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("list", { name: "Sua ordem de preferência" }).getByRole("listitem"),
  ).toHaveCount(1);
  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth);
});
