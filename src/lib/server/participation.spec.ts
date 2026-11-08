import { isHttpError, isRedirect } from "@sveltejs/kit";
import type * as ServerElection from "./election.ts";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Election } from "#lib/election.ts";
import { acknowledgeElection, replaceBallot } from "./ballots.ts";
import type { VoterId } from "./voter-session.ts";
import { openTestD1 } from "../../test/d1.ts";

const state = vi.hoisted(() => {
  const value = { d1: null as D1Database | null, election: null as Election | null };
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

vi.mock("./election.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof ServerElection>();
  return { requireCurrentElection: () => actual.electionOrNotFound(state.election) };
});

import { enterStep, type JourneyStep } from "./participation.ts";

const election: Election = {
  id: "8bc131c5-3228-46e4-b310-3555653d815d",
  titleKey: "election_br_2026_title",
  closesAt: null,
  sources: ["https://example.invalid/source"],
  candidates: [
    { id: 0, name: "A", number: "10", party: "P", vice: { name: "VA", party: "P" } },
    { id: 1, name: "B", number: "20", party: "P", vice: { name: "VB", party: "P" } },
  ],
};
const NOW = new Date("2026-10-15T12:00:00.000Z");
const fresh = "fresh-voter" as VoterId;
const acknowledged = "acknowledged-voter" as VoterId;
const submitted = "submitted-voter" as VoterId;

let dispose: () => Promise<void>;

beforeAll(async () => {
  const opened = await openTestD1();
  state.d1 = opened.d1;
  dispose = opened.dispose;
  await acknowledgeElection(opened.d1, election.id, acknowledged, NOW);
  await acknowledgeElection(opened.d1, election.id, submitted, NOW);
  await replaceBallot(opened.d1, election.id, submitted, [1, 0], NOW);
});

afterAll(async () => {
  state.d1 = null;
  await dispose();
});

beforeEach(() => {
  state.election = election;
});

async function outcome(voter: VoterId | undefined, step: JourneyStep, ids?: string[]) {
  const locals = { voter } as App.Locals;
  try {
    const entry = await (ids === undefined
      ? enterStep(locals, step)
      : enterStep(locals, step, ids));
    return "error" in entry ? entry.error : "admitted";
  } catch (cause) {
    if (isRedirect(cause)) return cause.location;
    if (isHttpError(cause)) return cause.status;
    throw cause;
  }
}

describe("enterStep", () => {
  it.each<[string, VoterId | undefined, JourneyStep, string | number]>([
    ["signed-out voter", undefined, "ballot", "/"],
    ["fresh voter at acknowledgment", fresh, "acknowledgment", "admitted"],
    ["fresh voter at ballot", fresh, "ballot", "/acknowledgment"],
    ["fresh voter at thanks", fresh, "thanks", "/acknowledgment"],
    ["acknowledged voter at acknowledgment", acknowledged, "acknowledgment", "/ballot"],
    ["acknowledged voter at ballot", acknowledged, "ballot", "admitted"],
    ["acknowledged but unsubmitted voter at thanks", acknowledged, "thanks", "/ballot"],
    ["submitted voter at ballot", submitted, "ballot", "admitted"],
    ["submitted voter at thanks", submitted, "thanks", "admitted"],
  ])("routes a %s", async (_label, voter, step, expected) => {
    expect(await outcome(voter, step)).toBe(expected);
  });

  it("answers 404 when no election is configured", async () => {
    state.election = null;
    expect(await outcome(acknowledged, "ballot")).toBe(404);
  });

  it.each<[string[], string]>([
    [[], "invalid"],
    [[election.id, election.id], "invalid"],
    [["6f1c1d0e-0000-4000-8000-000000000000"], "stale"],
  ])("rejects election ids %j as %s before revealing the voter's stage", async (ids, expected) => {
    expect(await outcome(fresh, "thanks", ids)).toBe(expected);
  });

  it("admits a matching election id", async () => {
    expect(await outcome(submitted, "thanks", [election.id])).toBe("admitted");
  });
});
