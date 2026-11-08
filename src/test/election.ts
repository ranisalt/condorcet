import type { Candidate, Election } from "#lib/election.ts";

export const TEST_ELECTION_ID = "8bc131c5-3228-46e4-b310-3555653d815d";

export function testCandidate(id: number, number = String(id)): Candidate {
  return {
    id,
    name: `Candidate ${id}`,
    number,
    party: "TEST",
    vice: { name: `Vice ${id}`, party: "TEST" },
  };
}

/** An open election over the given candidate IDs; override any field. */
export function testElection(ids: readonly number[], overrides: Partial<Election> = {}): Election {
  return {
    id: TEST_ELECTION_ID,
    titleKey: "election_br_2026_title",
    closesAt: null,
    sources: ["https://example.invalid/source"],
    candidates: ids.map((id) => testCandidate(id)),
    ...overrides,
  };
}
