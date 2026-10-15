import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import CandidateTicket from "./CandidateTicket.svelte";

const candidate = {
  id: 0,
  name: "Candidata Exemplo",
  number: "10",
  party: "TESTE",
  vice: { name: "Vice Exemplo", party: "VICE" },
};

it("shows the ticket identity and its vice ticket as text", async () => {
  await render(CandidateTicket, { props: { candidate } });

  await expect.element(page.getByText("Candidata Exemplo")).toBeInTheDocument();
  await expect.element(page.getByText("10 · TESTE")).toBeInTheDocument();
  await expect.element(page.getByText("Vice: Vice Exemplo (VICE)")).toBeInTheDocument();
});
