import { expect, it, vi } from "vitest";
import { isRedirect } from "@sveltejs/kit";
import { eq } from "drizzle-orm";
import type { RequestEvent } from "./$types";
import { createAuth } from "#lib/server/auth.ts";
import { getDb } from "#lib/server/db/index.ts";
import { user } from "#lib/server/db/auth.schema.ts";
import { acknowledgeElection, readOwnRanking, replaceBallot } from "#lib/server/ballots.ts";
import type { Election } from "#lib/election.ts";
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

vi.mock("#lib/server/election.ts", () => ({
  get currentElection() {
    return state.election;
  },
}));

import { actions } from "./+page.server.ts";

const election: Election = {
  id: "8bc131c5-3228-46e4-b310-3555653d815d",
  titleKey: "election_br_2026_title",
  closesAt: "2026-10-15T12:00:00.000Z",
  resultsThreshold: 2,
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

const nowBeforeClose = new Date("2026-10-15T11:59:59.999Z");

function makeForm(ranked: readonly number[], operation?: string): FormData {
  const form = new FormData();
  form.append("electionId", election.id);
  for (const candidate of election.candidates)
    form.append("candidateOrderId", String(candidate.id));
  for (const candidateId of ranked) form.append("candidateId", String(candidateId));
  if (operation !== undefined) form.append("operation", operation);
  return form;
}

async function makeEvent(
  d1: D1Database,
  ranked: readonly number[],
  operation?: string,
): Promise<RequestEvent> {
  const voters = await getDb(d1).select().from(user).where(eq(user.id, "test-voter"));
  const voter = voters[0];
  if (voter === undefined) throw new Error("Test voter is missing");

  const request = new Request("http://localhost:4173/ballot?/save", {
    method: "POST",
    body: makeForm(ranked, operation),
  });
  const auth = createAuth(d1, {
    origin: "http://localhost:4173",
    secret: "condorcet-local-test-secret-32-characters",
    googleClientId: "test-client",
    googleClientSecret: "test-secret",
  });
  return {
    request,
    locals: { user: voter, auth },
  } as RequestEvent;
}

async function expectClosedFailure(result: unknown) {
  if (typeof result !== "object" || result === null || !("status" in result)) {
    throw new Error("Expected a closed-election action failure");
  }
  expect(result.status).toBe(403);
  const data = "data" in result ? result.data : undefined;
  if (typeof data !== "object" || data === null || !("error" in data)) {
    throw new Error("Expected a closed-election failure payload");
  }
  expect(data.error).toBe("closed");
}

it("allows edit/save immediately before closing and rejects both at and after the boundary", async () => {
  const { d1, dispose } = await openTestD1();
  state.d1 = d1;
  state.election = election;
  vi.useFakeTimers({ toFake: ["Date"] });

  try {
    const fixedNow = new Date("2026-10-15T12:00:00.000Z");
    await getDb(d1).insert(user).values({
      id: "test-voter",
      name: "Test Voter",
      email: "test-voter@example.invalid",
      emailVerified: true,
      createdAt: nowBeforeClose,
      updatedAt: nowBeforeClose,
    });
    await acknowledgeElection(d1, election.id, "test-voter", nowBeforeClose);
    await replaceBallot(d1, election.id, "test-voter", [130, 87], nowBeforeClose);

    vi.setSystemTime(nowBeforeClose);
    const editBefore = await actions.edit(await makeEvent(d1, [130, 87], "up:87"));
    expect(editBefore).toEqual({ draft: { ranked: [87, 130], order: [87, 130] } });
    expect(await readOwnRanking(d1, election.id, "test-voter")).toEqual([130, 87]);

    let redirected = false;
    try {
      await actions.save(await makeEvent(d1, [87]));
    } catch (cause) {
      redirected = isRedirect(cause) && cause.status === 303;
      if (!redirected) throw cause;
    }
    expect(redirected).toBe(true);
    expect(await readOwnRanking(d1, election.id, "test-voter")).toEqual([87]);

    for (const closeTime of [fixedNow, new Date(fixedNow.getTime() + 1)]) {
      vi.setSystemTime(closeTime);
      const editAtClose = await actions.edit(await makeEvent(d1, [130], "add:87"));
      await expectClosedFailure(editAtClose);
      const saveAtClose = await actions.save(await makeEvent(d1, [130]));
      await expectClosedFailure(saveAtClose);
      expect(await readOwnRanking(d1, election.id, "test-voter")).toEqual([87]);
    }
  } finally {
    vi.useRealTimers();
    state.d1 = null;
    state.election = null;
    await dispose();
  }
});
