import { betterAuth } from "better-auth";
import { buildAuthOptions } from "./src/lib/server/auth-options.ts";

export const auth = betterAuth(
  buildAuthOptions({
    origin: "http://localhost:4173",
    secret: "condorcet-local-test-secret-32-characters",
    googleClientId: "test-client",
    googleClientSecret: "test-secret",
  }),
);
