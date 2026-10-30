import { expect, it } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-svelte";
import { m } from "#lib/paraglide/messages.js";
import FlowSteps from "./FlowSteps.svelte";

it("marks the current step and announces the finished ones", async () => {
  await render(FlowSteps, { props: { current: 2 } });

  const steps = page.getByRole("list", { name: "Etapas da participação" }).getByRole("listitem");
  await expect
    .element(steps.nth(0))
    .toHaveTextContent(`${m.flow_step_sign_in()} (${m.flow_step_done()})`);
  await expect.element(steps.nth(1)).toHaveAttribute("aria-current", "step");
  await expect.element(steps.nth(1).getByText(m.flow_step_notices())).toBeVisible();
  await expect.element(steps.nth(2)).not.toHaveAttribute("aria-current");
  expect(steps.nth(2).element().textContent).not.toContain(m.flow_step_done());
});
