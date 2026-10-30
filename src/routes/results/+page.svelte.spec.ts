import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { m } from "#lib/paraglide/messages.js";
import type { PageProps } from "./$types";
import ResultsPage from "./+page.svelte";

const data = {
  view: {
    state: "locked",
    validCount: 7,
    threshold: null,
    reason: "threshold",
    election: { titleKey: "election_br_2026_title" },
  },
} as unknown as PageProps["data"];

it("explains the pending minimum once when results are locked", async () => {
  await render(ResultsPage, { props: { data, form: null, params: {} } });

  const card = page.getByRole("region", { name: m.results_locked_title() });
  const paragraphs = await card.getByRole("paragraph").elements();
  expect(paragraphs.map((paragraph) => paragraph.textContent?.trim())).toStrictEqual([
    m.results_threshold_pending(),
    m.valid_participation({ count: "7" }),
  ]);
});
