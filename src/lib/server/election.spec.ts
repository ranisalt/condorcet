import { expect, it } from "vitest";
import { validateElectionConfig, selectElection } from "./election.ts";
import { isElectionOpen } from "../election.ts";

const electionId = "8bc131c5-3228-46e4-b310-3555653d815d";
const candidate = (id: number, number: string) => ({
  id,
  name: `Candidate ${id}`,
  number,
  party: "TEST",
  vice: { name: `Vice ${id}`, party: "TEST" },
});
const validElection: {
  id: string;
  titleKey: string;
  closesAt: string | null;
  resultsThreshold: number;
  sources: string[];
  candidates: unknown[];
} = {
  id: electionId,
  titleKey: "election_br_2026_title",
  closesAt: null,
  resultsThreshold: 10,
  sources: ["https://example.test/source"],
  candidates: [candidate(0, "10"), candidate(87, "20")],
};
const validConfig = (election: typeof validElection = validElection) => ({
  currentElectionId: election.id,
  elections: [election],
});

it("selects the configured election and permits an explicitly unselected config", () => {
  const secondElection = {
    ...validElection,
    id: "a1c2d3e4-1234-4abc-8abc-123456789abc",
  };
  const config = validateElectionConfig({
    currentElectionId: secondElection.id,
    elections: [validElection, secondElection],
  });
  expect(selectElection(config)).toEqual(config.elections[1]);

  const unselected = validateElectionConfig({
    currentElectionId: null,
    elections: [validElection],
  });
  expect(selectElection(unselected)).toBeNull();
});

it("rejects an invalid UUID and a selected UUID missing from the election list", () => {
  expect(() =>
    validateElectionConfig({ currentElectionId: "not-a-uuid", elections: [] }),
  ).toThrow();
  expect(() =>
    validateElectionConfig({
      currentElectionId: "8bc131c5-3228-46e4-b310-3555653d815d",
      elections: [],
    }),
  ).toThrow();
  expect(() => validateElectionConfig({ currentElectionId: null, elections: [] })).not.toThrow();
});

it("rejects malformed configuration, duplicate election/candidate IDs, and duplicate ballot numbers", () => {
  expect(() => validateElectionConfig(null)).toThrow();
  expect(() =>
    validateElectionConfig({ ...validConfig(), elections: [validElection, validElection] }),
  ).toThrow();
  expect(() =>
    validateElectionConfig(
      validConfig({ ...validElection, candidates: [candidate(4, "10"), candidate(4, "20")] }),
    ),
  ).toThrow();
  expect(() =>
    validateElectionConfig(
      validConfig({ ...validElection, candidates: [candidate(4, "10"), candidate(8, "10")] }),
    ),
  ).toThrow();
});

it("accepts candidate ID zero and rejects IDs outside the unsigned-byte integer range", () => {
  expect(validateElectionConfig(validConfig()).elections[0]?.candidates[0]?.id).toBe(0);
  for (const id of [-1, 256, 1.5, Number.NaN]) {
    expect(() =>
      validateElectionConfig(
        validConfig({ ...validElection, candidates: [candidate(id, "10"), candidate(8, "20")] }),
      ),
    ).toThrow();
  }
});

it("rejects missing candidate and vice fields and invalid thresholds", () => {
  const missingVice = { ...candidate(2, "10"), vice: { name: "", party: "TEST" } };
  expect(() =>
    validateElectionConfig(
      validConfig({ ...validElection, candidates: [missingVice, candidate(8, "20")] }),
    ),
  ).toThrow();
  const missingCandidateField = { id: 2, name: "Candidate", number: "10", party: "TEST" };
  expect(() =>
    validateElectionConfig(
      validConfig({ ...validElection, candidates: [missingCandidateField, candidate(8, "20")] }),
    ),
  ).toThrow();
  for (const resultsThreshold of [0, -1, 1.5, Number.NaN]) {
    expect(() =>
      validateElectionConfig(validConfig({ ...validElection, resultsThreshold })),
    ).toThrow();
  }
});

it("rejects malformed, invalid, and non-timezoned closing timestamps", () => {
  for (const closesAt of [
    "2026-10-15",
    "not-a-date",
    "2026-10-15T12:00:00",
    "2026-02-30T12:00:00Z",
  ]) {
    expect(() => validateElectionConfig(validConfig({ ...validElection, closesAt }))).toThrow();
  }
  expect(
    validateElectionConfig(validConfig({ ...validElection, closesAt: "2026-10-15T12:00:00+02:00" }))
      .elections[0]?.closesAt,
  ).toBe("2026-10-15T12:00:00+02:00");
});

it("closes at the exact timestamp and remains open before it or without a close time", () => {
  const closing = validateElectionConfig(
    validConfig({ ...validElection, closesAt: "2026-10-15T12:00:00.000Z" }),
  ).elections[0];
  const openEnded = validateElectionConfig(validConfig()).elections[0];
  expect(closing).toBeDefined();
  expect(openEnded).toBeDefined();
  if (closing === undefined || openEnded === undefined)
    throw new Error("Expected validated elections");

  expect(isElectionOpen(closing, new Date("2026-10-15T11:59:59.999Z"))).toBe(true);
  expect(isElectionOpen(closing, new Date("2026-10-15T12:00:00.000Z"))).toBe(false);
  expect(isElectionOpen(closing, new Date("2026-10-15T12:00:00.001Z"))).toBe(false);
  expect(isElectionOpen(openEnded, new Date("2026-10-15T12:00:00.000Z"))).toBe(true);
});
