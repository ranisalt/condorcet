import { expect, it, vi } from "vitest";
import type * as ServerElection from "#lib/server/election.ts";
import { isRedirect } from "@sveltejs/kit";
import type { RequestEvent } from "./$types";
import { acknowledgeElection } from "#lib/server/ballots.ts";
import type { VoterId } from "#lib/server/voter-session.ts";
import { openTestD1 } from "../../test/d1.ts";
import { testElection } from "../../test/election.ts";
import { ballotForm } from "../../test/platform.ts";

const state = await vi.hoisted(async () => {
  const { installTestPlatform } = await import("../../test/platform.ts");
  return installTestPlatform();
});

vi.mock("#lib/server/election.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof ServerElection>();
  return { requireCurrentElection: () => actual.electionOrNotFound(state.election) };
});

import { actions } from "./+page.server.ts";

const election = testElection([87, 130]);

function makeEvent(ranked: readonly number[], operation?: string): RequestEvent {
  const request = new Request("http://localhost:4173/ballot?/save", {
    method: "POST",
    body: ballotForm(election, { ranked, operations: operation === undefined ? [] : [operation] }),
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
