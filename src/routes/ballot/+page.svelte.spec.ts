import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { m } from "#lib/paraglide/messages.js";
import type { Election } from "../../lib/election.ts";
import type { PageProps } from "./$types";
import BallotPage from "./+page.svelte";

const election: Election = {
  id: "8bc131c5-3228-46e4-b310-3555653d815d",
  titleKey: "election_br_2026_title",
  closesAt: null,
  sources: [],
  candidates: [
    {
      id: 87,
      name: "Primeira",
      number: "10",
      party: "TESTE",
      vice: { name: "Vice 1", party: "V1" },
    },
    {
      id: 0,
      name: "Segunda",
      number: "20",
      party: "TESTE",
      vice: { name: "Vice 2", party: "V2" },
    },
  ],
};

const signedOut = {
  election,
  open: true,
  draft: null,
} satisfies PageProps["data"];

it("shows the roster to a signed-out visitor with a sign-in notice and no submit control", async () => {
  await render(BallotPage, { props: { data: signedOut, form: null, params: {} } });

  await expect.element(page.getByText(m.ballot_signed_out_heading())).toBeVisible();
  await expect.element(page.getByText("Primeira", { exact: true })).toBeVisible();
  await expect.element(page.getByText("Segunda", { exact: true })).toBeVisible();
  await expect.element(page.getByRole("button", { name: m.sign_in() })).toBeVisible();
  await expect.element(page.getByRole("button", { name: m.cast_vote() })).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: /^Adicionar/ })).not.toBeInTheDocument();
  expect(await page.getByRole("button").all()).toHaveLength(1);
});

it("does not suggest voting is open to a signed-out visitor of a closed election", async () => {
  await render(BallotPage, {
    props: { data: { ...signedOut, open: false }, form: null, params: {} },
  });

  await expect.element(page.getByText(m.ballot_signed_out_closed())).toBeVisible();
  await expect.element(page.getByText(m.ballot_signed_out_heading())).not.toBeInTheDocument();
  await expect.element(page.getByRole("button", { name: m.sign_in() })).not.toBeInTheDocument();
  await expect.element(page.getByText("Primeira", { exact: true })).toBeVisible();
});
