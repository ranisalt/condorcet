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
  await expect
    .element(
      page.getByText(
        "Considere três votos: A > B > C, B > C > A e C > A > B. A vence B por 2 a 1; B vence C por 2 a 1; C vence A por 2 a 1. Cada pessoa tem uma ordem coerente, mas o grupo forma um ciclo. Nesta simulação, mostramos que não há vencedor de Condorcet, sem escolher um desempate artificial.",
      ),
    )
    .toBeInTheDocument();
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
});
