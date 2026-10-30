import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import MethodPage from "./+page.svx";

it("explains the Condorcet winner, cycle, plurality, runoff, and study limits", async () => {
  await render(MethodPage);

  await expect
    .element(page.getByRole("heading", { name: "Vencedora estrita de Condorcet" }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: "Ciclo de preferências" }))
    .toBeInTheDocument();
  await expect
    .element(
      page.getByText(
        "Três votos podem formar este ciclo: A > B > C, B > C > A e C > A > B. A vence B por 2 a 1, B vence C por 2 a 1 e C vence A por 2 a 1. Cada cédula tem uma ordem coerente, mas o conjunto não forma uma ordem coletiva transitiva. Nesse caso, não existe vencedora estrita de Condorcet.",
      ),
    )
    .toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: "Copeland: saldo de vitórias e derrotas" }))
    .toBeInTheDocument();
  await expect
    .element(
      page.getByText(
        "Em cada confronto, uma vitória vale 1 ponto, uma derrota vale −1 e um empate vale 0. A pontuação é o total de vitórias menos derrotas. Todas as candidaturas com a maior pontuação permanecem empatadas.",
      ),
    )
    .toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: "Schulze: caminhos de vitórias" }))
    .toBeInTheDocument();
  await expect
    .element(
      page.getByText(
        "O método compara a força dos caminhos entre candidaturas. A força de um caminho é a menor quantidade de votos vencedores entre suas etapas. Vence a comparação quem tem o caminho mais forte contra cada adversária. O cálculo usa a variante de votos vencedores.",
      ),
    )
    .toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: "Tideman: pares ranqueados" }))
    .toBeInTheDocument();
  await expect
    .element(
      page.getByText(
        "O método ordena as vitórias diretas pela margem e depois pela quantidade de votos vencedores. Em seguida, trava cada resultado nessa ordem, desde que não crie um ciclo. Quando duas vitórias têm exatamente a mesma força, o método considera todas as ordens possíveis entre elas.",
      ),
    )
    .toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: "Empates e limites do cálculo" }))
    .toBeInTheDocument();
  await expect
    .element(
      page.getByText(
        "Os métodos preservam todas as candidaturas empatadas. Nem a ordem da lista nem o identificador desempatam. No método de Tideman, todas as ordens empatadas entram no cálculo. Se a exploração das ordens atingir o limite de cálculo, o resultado fica marcado como não resolvido, e o método não escolhe uma vencedora arbitrária.",
      ),
    )
    .toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: "Pluralidade em turno único" }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: "Sistema majoritário de dois turnos" }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: "Exemplo de eliminação da vencedora de Condorcet" }))
    .toBeInTheDocument();
  await expect
    .element(page.getByRole("heading", { name: "Limites da simulação" }))
    .toBeInTheDocument();
  await expect.element(page.getByRole("heading", { name: "Referências" })).not.toBeInTheDocument();
  await expect.element(page.getByRole("list")).not.toBeInTheDocument();
});
