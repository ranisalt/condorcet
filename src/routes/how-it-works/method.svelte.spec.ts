import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { m } from "#lib/paraglide/messages.js";
import MethodPage from "./+page.svelte";

it("explains the Condorcet winner, cycle, plurality, runoff, and study limits", async () => {
  await render(MethodPage);

  await expect
    .element(page.getByRole("heading", { name: m.method_winner_title() }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: m.method_paradox_title() }))
    .toBeInTheDocument();
  await expect.element(page.getByText(m.method_paradox_body())).toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: m.education_copeland_title() }))
    .toBeInTheDocument();
  await expect.element(page.getByText(m.education_copeland_body())).toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: m.education_schulze_title() }))
    .toBeInTheDocument();
  await expect.element(page.getByText(m.education_schulze_body())).toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: "Tideman: pares ranqueados" }))
    .toBeInTheDocument();
  await expect.element(page.getByText(m.education_ranked_pairs_body())).toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: m.education_method_ties_title() }))
    .toBeInTheDocument();
  await expect.element(page.getByText(m.education_method_ties_body())).toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: m.method_plurality_title() }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: m.method_runoff_title() }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: m.method_example_title() }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: m.method_limits_title() }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: m.method_sources() }))
    .not.toBeInTheDocument();
  await expect.element(page.getByRole("list")).not.toBeInTheDocument();
});
