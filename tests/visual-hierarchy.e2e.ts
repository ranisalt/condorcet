import { expect, test } from "@playwright/test";
import { expectNoHorizontalOverflow } from "./helpers/ballot.ts";

test("keeps the home hierarchy compact and the disclaimer only in the footer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const main = page.getByRole("main");
  const disclaimer = /Esta é uma simulação para fins de estudo/;
  await expect(main.getByText(disclaimer)).toHaveCount(0);
  await expect(page.getByRole("contentinfo").getByText(disclaimer)).toBeVisible();
  await expect(
    page.getByRole("contentinfo").getByText("Natureza da simulação", { exact: true }),
  ).toHaveCount(0);

  const heading = main.getByRole("heading", { name: "Simulador Condorcet", exact: true });
  expect(
    await heading.evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize)),
  ).toBeLessThanOrEqual(44.8);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`home-${width}.png`), fullPage: true });
  }
});

test("stacks method explanations at desktop and mobile widths", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/how-it-works");
  const main = page.getByRole("main");
  const blocks = [
    ...(await main.getByRole("paragraph").all()),
    ...(await main.getByRole("listitem").all()),
  ];
  expect(blocks.length).toBeGreaterThan(10);
  for (const block of blocks) {
    const { width, limit } = await block.evaluate((element) => {
      const probe = document.createElement("span");
      probe.style.cssText = "position:absolute;visibility:hidden;width:70ch";
      element.appendChild(probe);
      const limit = probe.getBoundingClientRect().width;
      probe.remove();
      return { width: element.getBoundingClientRect().width, limit };
    });
    expect(width, (await block.textContent()) ?? undefined).toBeLessThanOrEqual(limit + 0.5);
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await expectNoHorizontalOverflow(page);
    await page.screenshot({ path: test.info().outputPath(`methods-${width}.png`), fullPage: true });
    const boxes = [];
    for (const name of [
      "Copeland: saldo de vitórias e derrotas",
      "Schulze: caminhos de vitórias",
      "Tideman: pares ranqueados",
    ]) {
      const box = await page.getByRole("heading", { name, exact: true }).boundingBox();
      expect(box).not.toBeNull();
      if (box) boxes.push(box);
    }
    expect(boxes).toHaveLength(3);
    expect(boxes[1].x).toBe(boxes[0].x);
    expect(boxes[2].x).toBe(boxes[0].x);
    expect(boxes[1].y).toBeGreaterThan(boxes[0].y + boxes[0].height);
    expect(boxes[2].y).toBeGreaterThan(boxes[1].y + boxes[1].height);
    await expectNoHorizontalOverflow(page);
  }
});

test("draws the first-choice bars in proportion to the votes", async ({ page }) => {
  await page.goto("/how-it-works");
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    const bars = await page
      .locator("[data-votes]")
      .evaluateAll((spans) =>
        spans.map((span) => [
          Number(span.getAttribute("data-votes")),
          span.getBoundingClientRect().width,
        ]),
      );
    expect(bars).toHaveLength(3);
    const [[topVotes, topWidth]] = bars;
    for (const [votes, barWidth] of bars) {
      expect(barWidth).toBeCloseTo((topWidth * votes) / topVotes, 0);
    }
  }
});
