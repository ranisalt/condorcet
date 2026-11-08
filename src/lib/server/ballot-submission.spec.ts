import type * as ServerElection from "./election.ts";
import { isRedirect } from "@sveltejs/kit";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { acknowledgeElection, readOwnRanking, replaceBallot } from "./ballots.ts";
import type { VoterId } from "./voter-session.ts";
import { openTestD1 } from "../../test/d1.ts";
import { testElection } from "../../test/election.ts";
import { ballotForm, type BallotFormFields } from "../../test/platform.ts";

const state = await vi.hoisted(async () => {
  const { installTestPlatform } = await import("../../test/platform.ts");
  return installTestPlatform();
});

vi.mock("./election.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof ServerElection>();
  return { requireCurrentElection: () => actual.electionOrNotFound(state.election) };
});

import { submitBallotForm, type BallotSubmissionKind } from "./ballot-submission.ts";

const election = testElection([87, 130], { closesAt: "2026-10-15T12:00:00.000Z" });
const beforeClose = new Date("2026-10-15T11:59:59.999Z");
const atClose = new Date("2026-10-15T12:00:00.000Z");
const voter = "voter" as VoterId;
const fresh = "fresh-voter" as VoterId;

async function submit(
  kind: BallotSubmissionKind,
  fields: BallotFormFields,
  now = beforeClose,
  locals: App.Locals = { voter },
) {
  try {
    return await submitBallotForm(locals, ballotForm(election, fields), kind, now);
  } catch (cause) {
    if (isRedirect(cause)) return { redirect: cause.location };
    throw cause;
  }
}

let d1: D1Database;
let dispose: () => Promise<void>;

beforeAll(async () => {
  ({ d1, dispose } = await openTestD1());
  await acknowledgeElection(d1, election.id, voter, beforeClose);
});

afterAll(async () => {
  state.d1 = null;
  await dispose();
});

beforeEach(async () => {
  state.d1 = d1;
  state.election = election;
  await replaceBallot(d1, election.id, voter, [130, 87], beforeClose);
});

describe("submitBallotForm", () => {
  it("applies an edit to the posted draft without saving it", async () => {
    expect(await submit("edit", { ranked: [130, 87], operations: ["up:87"] })).toEqual({
      draft: { ranked: [87, 130], order: [87, 130] },
      electionId: election.id,
    });
    expect(await readOwnRanking(d1, election.id, voter)).toEqual([130, 87]);
  });

  it("saves the posted ranking", async () => {
    expect(await submit("save", { ranked: [87] })).toMatchObject({ electionId: election.id });
    expect(await readOwnRanking(d1, election.id, voter)).toEqual([87]);
  });

  it("rejects edits and saves at and after closing without touching the stored ballot", async () => {
    for (const now of [atClose, new Date(atClose.getTime() + 1)]) {
      for (const kind of ["edit", "save"] as const) {
        expect(await submit(kind, { ranked: [87], operations: ["add:130"] }, now)).toEqual({
          error: "closed",
          status: 403,
        });
      }
    }
    expect(await readOwnRanking(d1, election.id, voter)).toEqual([130, 87]);
  });

  it.each<[string, BallotFormFields, string, number]>([
    [
      "a stale election id",
      { electionIds: ["6f1c1d0e-0000-4000-8000-000000000000"] },
      "stale",
      409,
    ],
    ["no election id", { electionIds: [] }, "invalid", 400],
    ["a duplicated election id", { electionIds: [election.id, election.id] }, "invalid", 400],
    ["a file election id", { electionIds: [new File([election.id], "id.txt")] }, "invalid", 400],
    ["an unknown candidate", { ranked: [999] }, "invalid", 400],
  ])("rejects %s on save", async (_label, fields, error, status) => {
    expect(await submit("save", fields)).toEqual({ error, status });
    expect(await readOwnRanking(d1, election.id, voter)).toEqual([130, 87]);
  });

  it.each([[[]], [["add:87", "add:87"]], [["add:999"]], [["swap:87"]]])(
    "rejects edit operations %j as invalid",
    async (operations) => {
      expect(await submit("edit", { operations })).toEqual({ error: "invalid", status: 400 });
    },
  );

  it("returns the draft with a save error when storage fails", async () => {
    // Reads still work, so the voter is admitted; every write fails.
    state.d1 = new Proxy(d1, {
      get: (target, key) =>
        key === "prepare"
          ? (query: string) => {
              if (!/^\s*select/i.test(query)) throw new Error("D1 unavailable");
              return target.prepare(query);
            }
          : Reflect.get(target, key, target),
    });
    expect(await submit("save", { ranked: [87] })).toEqual({
      error: "save",
      status: 503,
      draft: { ranked: [87], order: [87, 130] },
    });
  });

  it("redirects signed-out voters home and unacknowledged voters to acknowledgment", async () => {
    for (const kind of ["edit", "save"] as const) {
      expect(await submit(kind, { operations: ["add:87"] }, beforeClose, {})).toEqual({
        redirect: "/",
      });
      expect(await submit(kind, { operations: ["add:87"] }, beforeClose, { voter: fresh })).toEqual(
        {
          redirect: "/acknowledgment",
        },
      );
    }
  });
});
