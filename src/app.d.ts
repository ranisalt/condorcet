import type { User, Session } from "better-auth";
import type { createAuth } from "#lib/server/auth.ts";

declare global {
  namespace App {
    interface Locals {
      user?: User;
      session?: Session;
      auth: ReturnType<typeof createAuth>;
    }
  }
}

export {};
