import { expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { m } from "#lib/paraglide/messages.js";
import type { Election } from "../election.ts";
import Ballot from "./Ballot.svelte";

const election: Election = {
  id: "8bc131c5-3228-46e4-b310-3555653d815d",
  titleKey: "election_br_2026_title",
  closesAt: null,
  resultsThreshold: 10,
  sources: [],
  candidates: [
    {
      id: 0,
      name: "Primeira",
      number: "10",
      party: "TESTE",
      vice: { name: "Vice 1", party: "V1" },
    },
    {
      id: 87,
      name: "Segunda",
      number: "20",
      party: "TESTE",
      vice: { name: "Vice 2", party: "V2" },
    },
  ],
};

it("edits a ranked draft locally while retaining each candidate in one list", async () => {
  await render(Ballot, {
    props: { election, initialDraft: { ranked: [], order: [87, 0] }, open: true },
  });

  const unranked = page.getByRole("list", { name: m.unranked_title() });
  const available = await unranked.getByRole("listitem").all();
  await expect.element(available[0].getByText("Segunda")).toBeInTheDocument();
  await expect.element(available[1].getByText("Primeira")).toBeInTheDocument();

  await page.getByRole("button", { name: m.add_candidate({ name: "Segunda" }) }).click();
  await expect.element(page.getByRole("status")).toHaveTextContent(m.ballot_unsaved_status());
  await page.getByRole("button", { name: m.add_candidate({ name: "Primeira" }) }).click();
  const ranked = page.getByRole("list", { name: m.ranked_title() });
  let items = await ranked.getByRole("listitem").all();
  expect(items).toHaveLength(2);
  await expect.element(items[0].getByText("Segunda")).toBeInTheDocument();
  await expect.element(items[1].getByText("Primeira")).toBeInTheDocument();
  await page.getByRole("button", { name: m.move_up_candidate({ name: "Primeira" }) }).click();
  items = await ranked.getByRole("listitem").all();
  await expect.element(items[0].getByText("Primeira")).toBeInTheDocument();
  await expect.element(items[1].getByText("Segunda")).toBeInTheDocument();
  await expect
    .element(page.getByRole("button", { name: m.move_down_candidate({ name: "Primeira" }) }))
    .toHaveFocus();
  await page.getByRole("button", { name: m.move_down_candidate({ name: "Primeira" }) }).click();
  items = await ranked.getByRole("listitem").all();
  await expect.element(items[0].getByText("Segunda")).toBeInTheDocument();
  await expect.element(items[1].getByText("Primeira")).toBeInTheDocument();
  await expect
    .element(page.getByRole("button", { name: m.move_up_candidate({ name: "Primeira" }) }))
    .toHaveFocus();
  await page.getByRole("button", { name: m.remove_candidate({ name: "Segunda" }) }).click();
  items = await ranked.getByRole("listitem").all();
  expect(items).toHaveLength(1);
  await expect.element(unranked.getByRole("listitem").getByText("Segunda")).toBeInTheDocument();
  await page.getByRole("button", { name: m.add_candidate({ name: "Segunda" }) }).click();
  items = await ranked.getByRole("listitem").all();
  expect(items).toHaveLength(2);
  await expect.element(items[0].getByText("Primeira")).toBeInTheDocument();
  await expect.element(items[1].getByText("Segunda")).toBeInTheDocument();
  await expect
    .element(page.getByRole("button", { name: m.remove_candidate({ name: "Segunda" }) }))
    .toHaveFocus();
  await expect.element(page.getByText("Vice: Vice 1 (V1)")).toBeInTheDocument();
  await expect.element(page.getByText("Vice: Vice 2 (V2)")).toBeInTheDocument();
  await expect
    .element(page.getByRole("button", { name: m.move_up_candidate({ name: "Primeira" }) }))
    .toBeDisabled();
  await expect
    .element(page.getByRole("button", { name: m.move_down_candidate({ name: "Segunda" }) }))
    .toBeDisabled();
});

it("supports keyboard activation of candidate controls", async () => {
  await render(Ballot, {
    props: { election, initialDraft: { ranked: [], order: [0, 87] }, open: true },
  });

  await userEvent.tab();
  const firstAdd = page.getByRole("button", { name: m.add_candidate({ name: "Primeira" }) });
  await expect.element(firstAdd).toHaveFocus();
  await userEvent.keyboard("{Enter}");
  await expect
    .element(page.getByRole("list", { name: m.ranked_title() }).getByText("Primeira"))
    .toBeInTheDocument();
});

it("allows submitting an empty ballot", async () => {
  await render(Ballot, {
    props: { election, initialDraft: { ranked: [], order: [0, 87] }, open: true },
  });

  await expect.element(page.getByRole("button", { name: m.cast_vote() })).toBeEnabled();
  await expect.element(page.getByText(m.empty_rule())).toBeInTheDocument();
});

it("announces a draft returned by a native form action as unsaved", async () => {
  await render(Ballot, {
    props: {
      election,
      initialDraft: { ranked: [0], order: [0, 87] },
      open: true,
      unsaved: true,
    },
  });

  await expect.element(page.getByRole("status")).toHaveTextContent(m.ballot_unsaved_status());
});

it("disables ballot editing and saving after closure", async () => {
  await render(Ballot, {
    props: { election, initialDraft: { ranked: [0], order: [0, 87] }, open: false },
  });

  await expect.element(page.getByText(m.election_closed())).toBeInTheDocument();
  await expect.element(page.getByText(m.ballot_readonly_body())).toBeInTheDocument();
  await expect
    .element(page.getByRole("button", { name: m.remove_candidate({ name: "Primeira" }) }))
    .toBeDisabled();
  await expect.element(page.getByRole("button", { name: m.cast_vote() })).toBeDisabled();
});
