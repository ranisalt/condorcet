import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { m } from "#lib/paraglide/messages.js";
import ErrorPage from "./+error.svelte";

it("shows only the translated generic error and a route home link", async () => {
  await render(ErrorPage);

  await expect
    .element(page.getByRole("heading", { name: m.unexpected_error() }))
    .toBeInTheDocument();
  await expect.element(page.getByRole("link", { name: m.nav_home() })).toHaveAttribute("href", "/");
});
