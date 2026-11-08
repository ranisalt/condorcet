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

it("places the simulation notice and a one-line privacy summary before acknowledgment", async () => {
  await render(AcknowledgmentPage, { props: { data, form: null, params: {} } });

  await expect.element(page.getByRole("heading", { name: m.ack_title() })).toBeInTheDocument();
  await expect.element(page.getByText(m.simulation_warning())).toBeInTheDocument();
  await expect.element(page.getByText(m.privacy_summary())).toBeVisible();
  await expect.element(page.getByRole("checkbox", { name: m.ack_label() })).toBeRequired();
});

it("keeps the detailed privacy disclosures closed until the visitor opens them", async () => {
  await render(AcknowledgmentPage, { props: { data, form: null, params: {} } });

  await expect.element(page.getByText(m.privacy_warning())).not.toBeVisible();
  await expect.element(page.getByText(m.privacy_obfuscation())).not.toBeVisible();
  await expect.element(page.getByText(m.login_explanation())).not.toBeVisible();

  await page.getByText(m.privacy_details_summary()).click();

  await expect.element(page.getByText(m.privacy_warning())).toBeVisible();
  await expect.element(page.getByText(m.privacy_obfuscation())).toBeVisible();
  await expect.element(page.getByText(m.login_explanation())).toBeVisible();
});

it("shows the action's election-link message when the action rejects the election", async () => {
  await render(AcknowledgmentPage, {
    props: { data, form: { message: m.stale_election() }, params: {} },
  });

  await expect.element(page.getByRole("alert")).toHaveTextContent(m.stale_election());
});

it("keeps the acknowledgment-required message when consent is missing", async () => {
  await render(AcknowledgmentPage, { props: { data, form: { required: true }, params: {} } });

  await expect.element(page.getByRole("alert")).toHaveTextContent(m.ack_required());
});
