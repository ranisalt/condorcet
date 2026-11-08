import { m } from "#lib/paraglide/messages.js";

export const ballotErrorMessages = {
  invalid: m.invalid_ballot,
  closed: m.election_closed,
  stale: m.stale_election,
  save: m.save_failed,
} as const;

export type BallotError = keyof typeof ballotErrorMessages;

export function isBallotError(value: unknown): value is BallotError {
  return typeof value === "string" && Object.hasOwn(ballotErrorMessages, value);
}
