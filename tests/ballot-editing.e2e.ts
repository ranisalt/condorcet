import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow, openAcknowledgedBallot } from "./helpers/ballot.ts";
import { resetFixture } from "./helpers/d1.ts";

test.beforeEach(async () => {
  await resetFixture({ validCount: 0, blankCount: 0 });
});

test("shows the submit text beside a fully legible button at every width", async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await openAcknowledgedBallot(page, context);
  const button = page.getByRole("button", { name: "Enviar meu voto", exact: true });
  const text = page.getByRole("paragraph").filter({ hasText: /Somente o envio confirma/ });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(button).toBeVisible();
    await expect(text).toBeVisible();
    // A squeezed button wraps or clips its label; the text must not run under it either.
    expect(await button.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    const textBox = await text.boundingBox();
    const buttonBox = await button.boundingBox();
    if (!textBox || !buttonBox) throw new Error("Expected the submit bar to be laid out");
    const overlaps =
      textBox.x < buttonBox.x + buttonBox.width &&
      buttonBox.x < textBox.x + textBox.width &&
      textBox.y < buttonBox.y + buttonBox.height &&
      buttonBox.y < textBox.y + textBox.height;
    expect(overlaps).toBe(false);
    await expectNoHorizontalOverflow(page);
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
  await expectNoHorizontalOverflow(page);
});
