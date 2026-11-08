import { expect, it, vi } from "vitest";
import type * as ServerElection from "#lib/server/election.ts";
import { isRedirect } from "@sveltejs/kit";
import type { RequestEvent } from "./$types";
import { acknowledgeElection } from "#lib/server/ballots.ts";
import type { Election } from "#lib/election.ts";
import type { VoterId } from "#lib/server/voter-session.ts";
import { openTestD1 } from "../../test/d1.ts";

const state = vi.hoisted(() => {
  const value = {
    d1: null as D1Database | null,
    election: null as Election | null,
  };
  Reflect.set(globalThis, "__sveltekit_cloudflare_platform", {
    get env() {
      return {
        get DB() {
          if (value.d1 === null) throw new Error("Test D1 has not been initialized");
          return value.d1;
        },
      };
    },
  });
  return value;
});

vi.mock("#lib/server/election.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof ServerElection>();
  return { requireCurrentElection: () => actual.electionOrNotFound(state.election) };
});

import { actions } from "./+page.server.ts";

const election: Election = {
  id: "8bc131c5-3228-46e4-b310-3555653d815d",
  titleKey: "election_br_2026_title",
  closesAt: null,
  sources: ["https://example.invalid/source"],
  candidates: [
    {
      id: 87,
      name: "Candidate 87",
      number: "87",
      party: "TEST",
      vice: { name: "Vice 87", party: "TEST" },
    },
    {
      id: 130,
      name: "Candidate 130",
      number: "130",
      party: "TEST",
      vice: { name: "Vice 130", party: "TEST" },
    },
  ],
};

function makeForm(ranked: readonly number[], operation?: string): FormData {
  const form = new FormData();
  form.append("electionId", election.id);
  for (const candidate of election.candidates)
    form.append("candidateOrderId", String(candidate.id));
  for (const candidateId of ranked) form.append("candidateId", String(candidateId));
  if (operation !== undefined) form.append("operation", operation);
  return form;
}

function makeEvent(ranked: readonly number[], operation?: string): RequestEvent {
  const request = new Request("http://localhost:4173/ballot?/save", {
    method: "POST",
    body: makeForm(ranked, operation),
  });
  return {
    request,
    locals: { voter: "test-voter" as VoterId },
  } as RequestEvent;
}

// Ballot submission rules are specified in #lib/server/ballot-submission.spec.ts; this covers the
// adapter: success becomes the draft or the thanks redirect, a rejection becomes fail(status).
it("returns the edited draft, redirects a save to thanks, and fails with the rejection status", async () => {
  const { d1, dispose } = await openTestD1();
  state.d1 = d1;
  state.election = election;
  try {
    await acknowledgeElection(d1, election.id, "test-voter" as VoterId, new Date());
    expect(await actions.edit(makeEvent([130, 87], "up:87"))).toEqual({
      draft: { ranked: [87, 130], order: [87, 130] },
    });

    let thrown: unknown = null;
    try {
      await actions.save(makeEvent([87]));
    } catch (cause) {
      thrown = cause;
    }
    if (!isRedirect(thrown)) throw thrown;
    expect([thrown.status, thrown.location]).toEqual([303, `/thanks?electionId=${election.id}`]);

    const rejected = await actions.edit(makeEvent([87]));
    expect(rejected).toMatchObject({ status: 400, data: { error: "invalid" } });
  } finally {
    state.d1 = null;
    state.election = null;
    await dispose();
  }
});
