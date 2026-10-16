import { expect, it } from "vitest";
import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openTestD1 } from "../../test/d1.ts";
import { buildAuthOptions } from "./auth-options.ts";
import { getDb } from "./db/index.ts";
import { account, user } from "./db/auth.schema.ts";

async function openAuthFixture() {
  const fixture = await openTestD1();
  try {
    const db = getDb(fixture.d1);
    const auth = betterAuth({
      ...buildAuthOptions({
        origin: "http://localhost:4173",
        secret: "condorcet-local-test-secret-32-characters",
        googleClientId: "test-client",
        googleClientSecret: "test-secret",
      }),
      database: drizzleAdapter(db, { provider: "sqlite" }),
    });
    const { internalAdapter } = await auth.$context;
    return { ...fixture, db, auth, internalAdapter };
  } catch (error) {
    await fixture.dispose();
    throw error;
  }
}

const profile = {
  name: "Synthetic Private Name",
  email: "privacy-fixture@example.invalid",
  emailVerified: true,
  image: "https://example.invalid/private-avatar",
};
const providerAccount = {
  providerId: "google",
  accountId: "synthetic-google-subject",
  accessToken: "synthetic-access-token",
  refreshToken: "synthetic-refresh-token",
  idToken: "synthetic-profile-bearing-id-token",
};

it("rate-limits Cloudflare clients independently and ignores spoofed forwarded addresses", async () => {
  const fixture = await openAuthFixture();
  try {
    const statuses: number[] = [];
    for (let index = 0; index < 5; index += 1) {
      const response = await fixture.auth.handler(
        new Request("http://localhost:4173/api/auth/sign-up/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost:4173",
            "CF-Connecting-IP": index < 4 ? "203.0.113.1" : "203.0.113.2",
            "X-Forwarded-For": `198.51.100.${index + 1}`,
          },
          body: JSON.stringify({
            name: "Synthetic Test Voter",
            email: "rate-limit@example.invalid",
            password: "synthetic-disabled-password",
          }),
        }),
      );
      statuses.push(response.status);
    }
    expect(statuses).toEqual([400, 400, 400, 429, 400]);
    expect(await fixture.db.select().from(user)).toEqual([]);
  } finally {
    await fixture.dispose();
  }
});

it("does not persist Google names, avatars, or unnecessary provider tokens on first login", async () => {
  const fixture = await openAuthFixture();
  try {
    await fixture.internalAdapter.createOAuthUser(profile, providerAccount);
    const [savedUser] = await fixture.db.select().from(user);
    const [savedAccount] = await fixture.db.select().from(account);
    expect(savedUser).toMatchObject({ name: "", image: null, email: profile.email });
    expect(savedAccount).toMatchObject({
      providerId: "google",
      accountId: providerAccount.accountId,
      accessToken: null,
      refreshToken: null,
      idToken: null,
    });
  } finally {
    await fixture.dispose();
  }
});

it("does not reintroduce names or profile-bearing tokens when Google account data is updated", async () => {
  const fixture = await openAuthFixture();
  try {
    const created = await fixture.internalAdapter.createOAuthUser(profile, providerAccount);
    await fixture.internalAdapter.updateUser(created.user.id, {
      name: "Synthetic Updated Name",
      image: "https://example.invalid/updated-avatar",
    });
    await fixture.internalAdapter.updateAccount(created.account.id, {
      accessToken: "synthetic-new-access-token",
      refreshToken: "synthetic-new-refresh-token",
      idToken: "synthetic-new-profile-bearing-token",
    });
    const [savedUser] = await fixture.db.select().from(user);
    const [savedAccount] = await fixture.db.select().from(account);
    expect(savedUser).toMatchObject({ name: "", image: null, email: profile.email });
    expect(savedAccount).toMatchObject({ accessToken: null, refreshToken: null, idToken: null });
  } finally {
    await fixture.dispose();
  }
});
