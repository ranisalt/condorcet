import { fail } from "@sveltejs/kit";
import { expect, it, vi } from "vitest";
import type * as Participation from "#lib/server/participation.ts";
import { m } from "#lib/paraglide/messages.js";

const entry = vi.hoisted(() => ({ value: null as unknown }));
vi.mock("#lib/server/participation.ts", async (importOriginal) => ({
  ...(await importOriginal<typeof Participation>()),
  enterStep: async () => entry.value,
}));
vi.mock("#lib/server/ballots.ts", () => ({ acknowledgeElection: async () => {} }));

import { actions } from "./+page.server.ts";

async function submit(error: "invalid" | "stale") {
  entry.value = { error };
  const body = new FormData();
  body.set("electionId", "x");
  body.set("acknowledged", "yes");
  const request = new Request("http://localhost/acknowledgment", { method: "POST", body });
  const event = { locals: {}, request } as unknown as Parameters<typeof actions.default>[0];
  return Promise.resolve(actions.default(event)).then(
    (result: unknown) => result,
    (caught: unknown) => caught,
  );
}

it("answers a malformed election id with 400 and the invalid-link message, not the acknowledgment prompt", async () => {
  const caught = await submit("invalid");
  expect(caught).toEqual(fail(400, { message: m.invalid_election_link() }));
});

it("answers a stale election id with 409 and the stale message", async () => {
  const caught = await submit("stale");
  expect(caught).toEqual(fail(409, { message: m.stale_election() }));
});
