import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import MethodPage from "./+page.svx";

it("renders the markdown sections, including those inside the method cards, as headings", async () => {
  await render(MethodPage);

  await expect
    .element(
      page.getByRole("heading", {
        level: 1,
        name: "Métodos de contagem por preferências ordenadas",
      }),
    )
    .toBeInTheDocument();
  for (const name of [
    "Vencedora estrita de Condorcet",
    "Ciclo de preferências",
    "Copeland: saldo de vitórias e derrotas",
    "Schulze: caminhos de vitórias",
    "Tideman: pares ranqueados",
    "Empates e limites do cálculo",
  ]) {
    await expect.element(page.getByRole("heading", { level: 2, name })).toBeInTheDocument();
  }
});
