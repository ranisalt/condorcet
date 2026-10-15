import { expect, it } from "vitest";
import { buildAuthOptions } from "./auth-options.ts";

it("allows only Google and disables password auth and account linking", () => {
  const options = buildAuthOptions({
    origin: "http://localhost:4173",
    secret: "condorcet-local-test-secret-32-characters",
    googleClientId: "test-client",
    googleClientSecret: "test-secret",
  });
  expect(options.emailAndPassword?.enabled).toBe(false);
  expect(Object.keys(options.socialProviders ?? {})).toEqual(["google"]);
  expect(options.account?.accountLinking?.enabled).toBe(false);
  expect(options.trustedOrigins).toEqual(["http://localhost:4173"]);
  expect(options.rateLimit?.storage).toBe("database");
});
