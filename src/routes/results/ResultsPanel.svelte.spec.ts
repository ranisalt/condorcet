import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import type { Election } from "#lib/election.ts";
import type { ResultsView } from "#lib/server/results.ts";
import ResultsPanel from "./ResultsPanel.svelte";

const election: Pick<Election, "titleKey" | "candidates"> = {
  titleKey: "election_br_2026_title",
  candidates: [0, 87, 130].map((id) => ({
    id,
    name: `Candidatura ${id}`,
    number: String(id),
    party: "TESTE",
    vice: { name: `Vice ${id}`, party: "TESTE" },
  })),
};
const view: Extract<ResultsView, { state: "available" }> & { election: typeof election } = {
  state: "available",
  validCount: 10,
  blankCount: 2,
  threshold: 10,
  election,
  winnerId: null,
  matrix: {
    0: { 0: 0, 87: 7, 130: 2 },
    87: { 0: 3, 87: 0, 130: 6 },
    130: { 0: 8, 87: 4, 130: 0 },
  },
  methods: {
    copeland: { winnerIds: [0, 87, 130], unresolved: false },
    schulze: { winnerIds: [130], unresolved: false },
    rankedPairs: { winnerIds: [130], unresolved: false },
  },
};

it("separates strict Condorcet status from tied method outcomes and renders signed margins", async () => {
  await render(ResultsPanel, { props: { view, method: "copeland" } });
  await expect
    .element(page.getByRole("heading", { name: "Não há vencedor de Condorcet" }))
    .toBeVisible();
  const outcome = page.getByRole("region", { name: "Resultado por Copeland" });
  await expect.element(outcome.getByText("Empate entre candidaturas")).toBeVisible();
  for (const id of [0, 87, 130]) {
    await expect.element(outcome.getByText(`Candidatura ${id}`, { exact: true })).toBeVisible();
    await expect
      .element(outcome.getByText(`Vice: Vice ${id} (TESTE)`, { exact: true }))
      .toBeVisible();
  }
  await expect
    .element(page.getByRole("link", { name: "Copeland", exact: true }))
    .toHaveAttribute("aria-current", "page");
  await expect
    .element(page.getByRole("link", { name: "Schulze / Beatpath", exact: true }))
    .toHaveAttribute("href", "/results?method=schulze");
  const table = page.getByRole("table", { name: "Comparações entre candidaturas" });
  await expect.element(table.getByRole("cell", { name: "+4", exact: true })).toBeVisible();
  await expect.element(table.getByRole("cell", { name: "−4", exact: true })).toBeVisible();
});

it("shows the selected method winner without claiming a strict Condorcet winner", async () => {
  await render(ResultsPanel, { props: { view, method: "schulze" } });
  const outcome = page.getByRole("region", { name: "Resultado por Schulze / Beatpath" });
  await expect.element(outcome.getByText("Candidatura 130", { exact: true })).toBeVisible();
  await expect.element(outcome.getByText("Vice: Vice 130 (TESTE)", { exact: true })).toBeVisible();
  await expect.element(outcome.getByText("Candidatura 0", { exact: true })).not.toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: "Não há vencedor de Condorcet" }))
    .toBeVisible();
});

it("reports an unresolved tied-order exploration instead of a fabricated winner", async () => {
  const unresolved = {
    ...view,
    methods: { ...view.methods, rankedPairs: { winnerIds: [], unresolved: true } },
  };
  await render(ResultsPanel, { props: { view: unresolved, method: "rankedPairs" } });
  const outcome = page.getByRole("region", { name: "Resultado por Ranked Pairs / Tideman" });
  await expect.element(outcome.getByText("Resultado não determinado")).toBeVisible();
  await expect
    .element(outcome.getByText("Candidatura 130", { exact: true }))
    .not.toBeInTheDocument();
});

it("recognizes candidate ID zero as a strict winner and displays pairwise ties", async () => {
  await render(ResultsPanel, {
    props: {
      view: {
        ...view,
        winnerId: 0,
        matrix: { ...view.matrix, 87: { ...view.matrix[87], 130: 4 } },
        methods: { ...view.methods, copeland: { winnerIds: [0], unresolved: false } },
      },
      method: "copeland",
    },
  });
  await expect
    .element(page.getByRole("heading", { name: "Candidatura 0", exact: true, level: 2 }))
    .toBeVisible();
  await expect
    .element(
      page
        .getByRole("region", { name: "Candidatura 0", exact: true })
        .getByText("Vice: Vice 0 (TESTE)", { exact: true }),
    )
    .toBeVisible();
  const table = page.getByRole("table", { name: "Comparações entre candidaturas" });
  await expect
    .element(
      table.getByRole("columnheader", {
        name: "Candidatura 0 0 · TESTE Vice: Vice 0 (TESTE)",
        exact: true,
      }),
    )
    .toBeVisible();
  await expect
    .element(
      table.getByRole("rowheader", { name: "Candidatura 0 Vice: Vice 0 (TESTE)", exact: true }),
    )
    .toBeVisible();
  await expect
    .element(page.getByRole("table").getByRole("cell", { name: "0", exact: true }).first())
    .toBeVisible();
});
