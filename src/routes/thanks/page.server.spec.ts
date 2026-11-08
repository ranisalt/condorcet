import { isHttpError } from "@sveltejs/kit";
import { expect, it, vi } from "vitest";
import { m } from "#lib/paraglide/messages.js";

const entry = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("#lib/server/participation.ts", () => ({ enterStep: async () => entry.value }));

import { load } from "./+page.server.ts";

async function loadError(error: "invalid" | "stale") {
  entry.value = { error };
  const event = { locals: {}, url: new URL("http://localhost/thanks") } as unknown as Parameters<
    typeof load
  >[0];
  return Promise.resolve(load(event)).then(
    () => null,
    (caught: unknown) => caught,
  );
}

it("answers a stale election id with 409 and the stale message", async () => {
  const caught = await loadError("stale");
  expect(isHttpError(caught, 409) && caught.body.message).toBe(m.stale_election());
});

it("answers a malformed election id with 400 and a message that does not claim it is stale", async () => {
  const caught = await loadError("invalid");
  expect(isHttpError(caught, 400) && caught.body.message).toBe(m.invalid_election_link());
});
