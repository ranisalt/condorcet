import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { m } from "#lib/paraglide/messages.js";
import BallotPage from "./+page.svelte";

it("asks a signed-out visitor to sign in before ranking candidates", async () => {
  await render(BallotPage, { props: { data: { signedIn: false }, form: null, params: {} } });

  await expect
    .element(page.getByRole("heading", { level: 1, name: m.ballot_signed_out_heading() }))
    .toBeVisible();
  const signIn = page.getByRole("button", { name: m.sign_in() });
  await expect.element(signIn).toBeVisible();
  expect(signIn.element().closest("form")?.getAttribute("action")).toBe("/?/login");
  await expect
    .element(page.getByRole("link", { name: m.home_privacy_link() }))
    .toHaveAttribute("href", "/how-it-works#privacidade");
  await expect.element(page.getByRole("button", { name: m.cast_vote() })).not.toBeInTheDocument();
});
