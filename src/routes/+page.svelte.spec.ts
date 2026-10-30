import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { m } from "#lib/paraglide/messages.js";
import type { PageProps } from "./$types";
import HomePage from "./+page.svelte";

const data = {
  election: {
    id: "8bc131c5-3228-46e4-b310-3555653d815d",
    titleKey: "election_br_2026_title",
    closesAt: null,
    resultsThreshold: 10,
  },
  open: true,
  validCount: 7,
  signedIn: false,
  loginError: false,
} satisfies PageProps["data"];

it("does not label a closed election as ongoing", async () => {
  await render(HomePage, { props: { data: { ...data, open: false }, form: null, params: {} } });
  await expect.element(page.getByText("Encerrada", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Em andamento", { exact: true })).not.toBeInTheDocument();
});

it("offers consultation rather than a new vote when a signed-in election is closed", async () => {
  await render(HomePage, {
    props: { data: { ...data, open: false, signedIn: true }, form: null, params: {} },
  });
  await expect
    .element(page.getByRole("link", { name: "Preparar meu voto" }))
    .not.toBeInTheDocument();
  await expect
    .element(page.getByRole("link", { name: "Consultar minha cédula" }))
    .toHaveAttribute("href", "/ballot");
  await expect.element(page.getByRole("button", { name: "Sair", exact: true })).toBeVisible();
});

it("shows real participation progress and the ranked-preference illustration", async () => {
  await render(HomePage, { props: { data, form: null, params: {} } });

  await expect.element(page.getByRole("heading", { name: m.app_title() })).toBeInTheDocument();
  const progress = page.getByRole("progressbar", {
    name: m.progress_label({ threshold: "10" }),
  });
  await expect.element(progress).toHaveAttribute("value", "7");
  await expect.element(progress).toHaveAttribute("max", "10");
  await expect
    .element(page.getByRole("figure", { name: m.preference_illustration_label() }))
    .toBeInTheDocument();
  await expect.element(page.getByText(m.preference_first())).toBeInTheDocument();
  await expect.element(page.getByText(m.preference_third())).toBeInTheDocument();
});

it("says the results minimum will be defined later when no threshold is configured", async () => {
  await render(HomePage, {
    props: {
      data: { ...data, election: { ...data.election, resultsThreshold: null } },
      form: null,
      params: {},
    },
  });

  await expect.element(page.getByText("7 votos válidos", { exact: true })).toBeVisible();
  await expect
    .element(
      page.getByText("O mínimo de votos válidos para mostrar os resultados será definido depois.", {
        exact: true,
      }),
    )
    .toBeVisible();
  await expect.element(page.getByRole("progressbar")).not.toBeInTheDocument();
  await expect.element(page.getByText("Mínimo atingido", { exact: true })).not.toBeInTheDocument();
});

it("keeps the privacy disclosure off home and links to it from the sign-in area", async () => {
  await render(HomePage, { props: { data, form: null, params: {} } });

  await expect.element(page.getByText(m.privacy_warning())).not.toBeInTheDocument();
  await expect.element(page.getByText(m.simulation_warning())).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: m.sign_in() })).toBeInTheDocument();
  await expect
    .element(page.getByRole("link", { name: m.home_privacy_link() }))
    .toHaveAttribute("href", "/how-it-works#privacidade");
});
