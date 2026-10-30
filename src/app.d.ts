import type { VoterId } from "#lib/server/voter-session.ts";

declare global {
  namespace App {
    interface Locals {
      // Only the OIDC `sub` is kept; no provider profile data (email, name) is stored or exposed.
      voter?: VoterId;
    }
  }
}

export {};
