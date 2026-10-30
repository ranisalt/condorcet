import { expect, it } from "vitest";
import { editDraft, parseDraft, parseDraftEdit, parseRankedIds, shuffle } from "./election.ts";
import type { Candidate, Election } from "./election.ts";

const candidates: Candidate[] = [0, 87, 130].map((id) => ({
  id,
  name: `Candidate ${id}`,
  number: String(id),
  party: "TEST",
  vice: { name: `Vice ${id}`, party: "TEST" },
}));
const election: Election = {
  id: "8bc131c5-3228-46e4-b310-3555653d815d",
  titleKey: "election_br_2026_title",
  closesAt: null,
  sources: [],
  candidates,
};

it("accepts empty rankings and candidate zero without coercing malformed IDs", () => {
  expect(parseRankedIds([], candidates)).toEqual([]);
  expect(parseRankedIds(["0", "130"], candidates)).toEqual([0, 130]);
  for (const values of [["130", "130"], ["999"], ["0130"], [""], ["1.5"], ["+130"], ["-0"]]) {
    expect(() => parseRankedIds(values, candidates)).toThrow();
  }
  expect(() => parseRankedIds([new File(["0"], "id.txt")], candidates)).toThrow();
});

it("edits the draft without mutating its input or initial unranked order", () => {
  const original = { ranked: [130], order: [87, 0, 130] };
  const added = editDraft(original, { type: "add", candidateId: 87 });
  const moved = editDraft(added, { type: "up", candidateId: 87 });
  expect(moved).toEqual({ ranked: [87, 130], order: [87, 0, 130] });
  expect(editDraft(moved, { type: "remove", candidateId: 87 })).toEqual(original);
  expect(original.ranked).toEqual([130]);
  expect(original.order).toEqual([87, 0, 130]);
});

it("uses a copied Fisher–Yates permutation", () => {
  const input = [0, 87, 130];
  expect(shuffle(input, () => 0)).toEqual([87, 130, 0]);
  expect(input).toEqual([0, 87, 130]);
});

it("parses a full candidate order with an optional empty ranking", () => {
  const form = new FormData();
  form.set("electionId", election.id);
  form.append("candidateOrderId", "87");
  form.append("candidateOrderId", "0");
  form.append("candidateOrderId", "130");
  form.append("candidateId", "0");
  expect(parseDraft(form, election)).toEqual({ ranked: [0], order: [87, 0, 130] });

  form.delete("candidateId");
  expect(parseDraft(form, election)).toEqual({ ranked: [], order: [87, 0, 130] });
});

it("rejects a draft that ranks an unknown candidate", () => {
  const form = new FormData();
  form.set("electionId", election.id);
  form.append("candidateOrderId", "87");
  form.append("candidateOrderId", "0");
  form.append("candidateOrderId", "130");
  form.append("candidateId", "999");
  expect(() => parseDraft(form, election)).toThrow();
});

it("requires exactly one matching election ID and a complete unique order", () => {
  const formWithOrder = () => {
    const form = new FormData();
    form.append("candidateOrderId", "87");
    form.append("candidateOrderId", "0");
    form.append("candidateOrderId", "130");
    return form;
  };
  for (const electionIds of [[], ["wrong"], [election.id, election.id]]) {
    const form = formWithOrder();
    for (const id of electionIds) form.append("electionId", id);
    expect(() => parseDraft(form, election)).toThrow();
  }
  const fileElectionId = formWithOrder();
  fileElectionId.append("electionId", new File([election.id], "election.txt"));
  expect(() => parseDraft(fileElectionId, election)).toThrow();

  for (const order of [
    ["87", "0"],
    ["87", "0", "130", "130"],
    ["87", "0", "999"],
  ]) {
    const form = new FormData();
    form.set("electionId", election.id);
    for (const id of order) form.append("candidateOrderId", id);
    expect(() => parseDraft(form, election)).toThrow();
  }
  const fileOrder = new FormData();
  fileOrder.set("electionId", election.id);
  fileOrder.append("candidateOrderId", "87");
  fileOrder.append("candidateOrderId", new File(["0"], "candidate.txt"));
  fileOrder.append("candidateOrderId", "130");
  expect(() => parseDraft(fileOrder, election)).toThrow();
});

it("parses only exact supported edit operations and known IDs", () => {
  expect(parseDraftEdit("add:0", candidates)).toEqual({ type: "add", candidateId: 0 });
  for (const value of [
    null,
    "ADD:0",
    "move:0",
    "add:0130",
    "remove:999",
    "up:1.5",
    "down:130:extra",
  ]) {
    expect(() => parseDraftEdit(value, candidates)).toThrow();
  }
  expect(() => parseDraftEdit(new File(["add:0"], "operation.txt"), candidates)).toThrow();
});

it("makes add/remove idempotent and treats boundary moves as no-ops", () => {
  const draft = { ranked: [0, 87], order: [0, 87, 130] };
  expect(editDraft(draft, { type: "add", candidateId: 0 })).toEqual(draft);
  expect(editDraft(draft, { type: "remove", candidateId: 130 })).toEqual(draft);
  expect(editDraft(draft, { type: "up", candidateId: 0 })).toEqual(draft);
  expect(editDraft(draft, { type: "down", candidateId: 87 })).toEqual(draft);
  expect(editDraft(draft, { type: "up", candidateId: 130 })).toEqual(draft);
  expect(editDraft(draft, { type: "down", candidateId: 130 })).toEqual(draft);
  expect(draft.ranked).toEqual([0, 87]);
});

it("reorders down, ignores edits for IDs outside the candidate order, and keeps arrays isolated", () => {
  const original = { ranked: [0, 87], order: [0, 87, 130] };
  const moved = editDraft(original, { type: "down", candidateId: 0 });
  expect(moved).toEqual({ ranked: [87, 0], order: [0, 87, 130] });
  expect(editDraft(moved, { type: "add", candidateId: 255 })).toEqual(moved);
  expect(editDraft(moved, { type: "down", candidateId: 130 })).toEqual(moved);
  expect(moved.ranked).toEqual([87, 0]);
  expect(original.ranked).toEqual([0, 87]);
  expect(original.order).toEqual([0, 87, 130]);
});

it("rejects duplicate candidate IDs at the ballot parsing boundary", () => {
  const duplicateCandidates = [candidates[0], candidates[0]];
  expect(() => parseRankedIds([], duplicateCandidates)).toThrow(/duplicate candidate IDs/);
  expect(() => parseDraftEdit("add:0", duplicateCandidates)).toThrow(/duplicate candidate IDs/);
});

it("handles empty and singleton shuffles without sampling and validates random bounds", () => {
  const random = () => {
    throw new Error("random should not be sampled for fewer than two values");
  };
  expect(shuffle([], random)).toEqual([]);
  expect(shuffle([87], random)).toEqual([87]);
  expect(shuffle([0, 87, 130], () => 0.999999)).toEqual([0, 87, 130]);

  for (const sample of [-0.01, 1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
    expect(() => shuffle([0, 87], () => sample)).toThrow(RangeError);
  }
});
