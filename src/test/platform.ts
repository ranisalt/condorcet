import type { Election } from "#lib/election.ts";

/**
 * Installs the global SvelteKit Cloudflare platform so server code reads `state.d1` as `DB`.
 * Call it inside `vi.hoisted` (via dynamic import) so it runs before mocked modules load:
 * `const state = await vi.hoisted(async () => (await import("…/test/platform.ts")).installTestPlatform());`
 */
export function installTestPlatform() {
  const state = { d1: null as D1Database | null, election: null as Election | null };
  Reflect.set(globalThis, "__sveltekit_cloudflare_platform", {
    get env() {
      return {
        get DB() {
          if (state.d1 === null) throw new Error("Test D1 has not been initialized");
          return state.d1;
        },
      };
    },
  });
  return state;
}

export type BallotFormFields = {
  electionIds?: FormDataEntryValue[];
  ranked?: readonly number[];
  operations?: readonly string[];
};

/** The form the ballot page posts: election id, shown order, ranking and edit operations. */
export function ballotForm(
  election: Election,
  { electionIds = [election.id], ranked = [], operations = [] }: BallotFormFields = {},
): FormData {
  const form = new FormData();
  for (const id of electionIds) form.append("electionId", id);
  for (const candidate of election.candidates)
    form.append("candidateOrderId", String(candidate.id));
  for (const id of ranked) form.append("candidateId", String(id));
  for (const operation of operations) form.append("operation", operation);
  return form;
}
