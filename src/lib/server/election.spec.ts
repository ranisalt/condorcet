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
  sources: string[];
  candidates: unknown[];
} = {
  id: electionId,
  titleKey: "election_br_2026_title",
  closesAt: null,
  sources: ["https://example.test/source"],
  candidates: [candidate(0, "10"), candidate(87, "20")],
};
const validConfig = (election: typeof validElection = validElection) => ({
  currentElectionId: election.id,
  elections: [election],
});
const invalidElectionConfig = (election: unknown) => ({
  currentElectionId: null,
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

it("accepts candidate ID zero", () => {
  expect(validateElectionConfig(validConfig()).elections[0]?.candidates[0]?.id).toBe(0);
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

it("rejects malformed root, elections, and election field shapes", () => {
  for (const value of [
    undefined,
    [],
    "config",
    { currentElectionId: null },
    { currentElectionId: null, elections: {} },
    { currentElectionId: 5, elections: [] },
  ]) {
    expect(() => validateElectionConfig(value)).toThrow();
  }
  for (const election of [null, [], "election"]) {
    expect(() =>
      validateElectionConfig({ currentElectionId: null, elections: [election] }),
    ).toThrow();
  }
  for (const invalid of [
    { ...validElection, id: "" },
    { ...validElection, titleKey: "other_title" },
    { ...validElection, closesAt: 123 },
    { ...validElection, sources: "source" },
    { ...validElection, sources: [] },
    { ...validElection, sources: ["https://example.test", " "] },
    { ...validElection, sources: ["https://example.test", 2] },
    { ...validElection, candidates: [] },
    { ...validElection, candidates: [candidate(1, "10")] },
    { ...validElection, candidates: "candidates" },
  ]) {
    expect(() => validateElectionConfig(invalidElectionConfig(invalid))).toThrow();
  }
});

it("rejects malformed candidate, name, vice, and candidate ID values", () => {
  for (const malformedCandidate of [
    null,
    [],
    "candidate",
    { ...candidate(2, "10"), id: "2" },
    { ...candidate(2, "10"), id: -1 },
    { ...candidate(2, "10"), id: 256 },
    { ...candidate(2, "10"), id: 1.5 },
    { ...candidate(2, "10"), id: Number.NaN },
  ]) {
    expect(() =>
      validateElectionConfig(
        validConfig({ ...validElection, candidates: [malformedCandidate, candidate(8, "20")] }),
      ),
    ).toThrow();
  }
  for (const malformed of [
    { ...candidate(2, "10"), name: " " },
    { ...candidate(2, "10"), name: 2 },
    { ...candidate(2, "10"), number: "" },
    { ...candidate(2, "10"), number: null },
    { ...candidate(2, "10"), party: "  " },
    { ...candidate(2, "10"), party: false },
    { id: 2, name: "Candidate", number: "10", party: "TEST" },
    { ...candidate(2, "10"), vice: null },
    { ...candidate(2, "10"), vice: [] },
    { ...candidate(2, "10"), vice: { name: " ", party: "TEST" } },
    { ...candidate(2, "10"), vice: { name: "Vice", party: "" } },
    { ...candidate(2, "10"), vice: { name: "Vice", party: 4 } },
  ]) {
    expect(() =>
      validateElectionConfig(
        validConfig({ ...validElection, candidates: [malformed, candidate(8, "20")] }),
      ),
    ).toThrow();
  }
});

it("validates calendar fields, offsets, seconds, and leap days in closing timestamps", () => {
  const invalidTimestamps = [
    "2026-00-15T12:00:00Z",
    "2026-13-15T12:00:00Z",
    "2026-10-00T12:00:00Z",
    "2026-01-01T24:00:00Z",
    "2026-01-01T12:60:00Z",
    "2026-01-01T12:00:60Z",
    "2026-01-01T12:00:00+24:00",
    "2026-01-01T12:00:00+00:60",
    "2023-02-29T12:00:00Z",
  ];
  for (const closesAt of invalidTimestamps) {
    expect(() => validateElectionConfig(validConfig({ ...validElection, closesAt }))).toThrow();
  }
  for (const closesAt of [
    "2024-02-29T23:59:59.999Z",
    "1900-02-28T12:00:00Z",
    "2000-02-29T12:00:00Z",
    "2026-10-15T12:00:00+23:59",
  ]) {
    expect(
      validateElectionConfig(validConfig({ ...validElection, closesAt })).elections[0]?.closesAt,
    ).toBe(closesAt);
  }
});
