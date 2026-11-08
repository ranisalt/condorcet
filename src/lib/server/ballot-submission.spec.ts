import type * as ServerElection from "./election.ts";
import { isRedirect } from "@sveltejs/kit";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { Election } from "#lib/election.ts";
import { acknowledgeElection, readOwnRanking, replaceBallot } from "./ballots.ts";
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

import { submitBallotForm, type BallotSubmissionKind } from "./ballot-submission.ts";

const election: Election = {
  id: "8bc131c5-3228-46e4-b310-3555653d815d",
  titleKey: "election_br_2026_title",
  closesAt: "2026-10-15T12:00:00.000Z",
  sources: ["https://example.invalid/source"],
  candidates: [
    { id: 87, name: "A", number: "87", party: "P", vice: { name: "VA", party: "P" } },
    { id: 130, name: "B", number: "130", party: "P", vice: { name: "VB", party: "P" } },
  ],
};
const beforeClose = new Date("2026-10-15T11:59:59.999Z");
const atClose = new Date("2026-10-15T12:00:00.000Z");
const voter = "voter" as VoterId;
const fresh = "fresh-voter" as VoterId;

type FormFields = {
  electionIds?: FormDataEntryValue[];
  ranked?: readonly number[];
  operations?: string[];
};

function makeForm({ electionIds = [election.id], ranked = [], operations = [] }: FormFields) {
  const form = new FormData();
  for (const id of electionIds) form.append("electionId", id);
  for (const candidate of election.candidates)
    form.append("candidateOrderId", String(candidate.id));
  for (const id of ranked) form.append("candidateId", String(id));
  for (const operation of operations) form.append("operation", operation);
  return form;
}

async function submit(
  kind: BallotSubmissionKind,
  fields: FormFields,
  now = beforeClose,
  locals: App.Locals = { voter },
) {
  try {
    return await submitBallotForm(locals, makeForm(fields), kind, now);
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

  it.each<[string, FormFields, string, number]>([
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
    state.d1 = new Proxy(d1, {
      get: (target, key) =>
        key === "batch"
          ? () => Promise.reject(new Error("D1 unavailable"))
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
