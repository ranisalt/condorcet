import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { m } from "#lib/paraglide/messages.js";
import type { PageProps } from "./$types";
import AcknowledgmentPage from "./+page.svelte";

const data = {
  election: {
    id: "8bc131c5-3228-46e4-b310-3555653d815d",
    titleKey: "election_br_2026_title",
  },
} satisfies PageProps["data"];

it("places all simulation, account, hosting, and obfuscation disclosures before acknowledgment", async () => {
  await render(AcknowledgmentPage, { props: { data, form: null, params: {} } });

  await expect.element(page.getByRole("heading", { name: m.ack_title() })).toBeInTheDocument();
  await expect.element(page.getByText(m.simulation_warning())).toBeInTheDocument();
  await expect.element(page.getByText(m.privacy_warning())).toBeInTheDocument();
  await expect.element(page.getByText(m.privacy_obfuscation())).toBeInTheDocument();
  await expect.element(page.getByText(m.login_explanation())).toBeInTheDocument();
  await expect.element(page.getByRole("checkbox", { name: m.ack_label() })).toBeInTheDocument();
});

it("shows the stale-election message when the action rejects an outdated election", async () => {
  await render(AcknowledgmentPage, { props: { data, form: { stale: true }, params: {} } });

  await expect.element(page.getByRole("alert")).toHaveTextContent(m.stale_election());
});

it("keeps the acknowledgment-required message when consent is missing", async () => {
  await render(AcknowledgmentPage, { props: { data, form: { required: true }, params: {} } });

  await expect.element(page.getByRole("alert")).toHaveTextContent(m.ack_required());
});
