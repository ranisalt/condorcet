import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { m } from "#lib/paraglide/messages.js";
import Layout from "./+layout.svelte";

it("provides a skip link, labeled primary navigation, and a single main landmark", async () => {
  await render(Layout);

  await expect
    .element(page.getByRole("link", { name: m.skip_to_content() }))
    .toHaveAttribute("href", "#main");
  await expect
    .element(page.getByRole("navigation", { name: m.main_navigation() }))
    .toBeInTheDocument();
  await expect.element(page.getByRole("main")).toHaveAttribute("id", "main");
  const footer = page.getByRole("contentinfo");
  await expect.element(footer.getByText(m.simulation_warning())).toBeInTheDocument();
  await expect.element(footer.getByText(m.study_notice_title())).not.toBeInTheDocument();
  await expect
    .element(page.getByRole("link", { name: m.nav_method() }))
    .toHaveAttribute("href", "/how-it-works");
});
