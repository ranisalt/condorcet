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

it("explains each service that handles data in the privacy section, linked by its fragment", async () => {
  await render(MethodPage);

  const section = document.getElementById("privacidade");
  expect(section).not.toBeNull();
  await expect
    .element(page.getByRole("heading", { level: 2, name: "Privacidade e tratamento dos dados" }))
    .toBeInTheDocument();
  const text = section?.textContent ?? "";
  for (const service of ["Supabase", "Cloudflare", "Sentry"]) {
    expect(text).toContain(service);
  }
  expect(text).toMatch(/não é anônimo/);
  expect(text).toMatch(/identificador aleatório/);
});

it("links to the ballot page from the end of the article", async () => {
  await render(MethodPage);

  const link = page.getByRole("link", { name: "Ir para a minha cédula" });
  await expect.element(link).toHaveAttribute("href", "/ballot");
  const article = document.querySelector("article");
  expect(article?.lastElementChild?.textContent).toContain("Ir para a minha cédula");
});
