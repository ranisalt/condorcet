import { expect, test } from "@playwright/test";
import { openE2ED1, resetFixture } from "./helpers/d1.ts";
import { signInFixture } from "./helpers/session.ts";

test.beforeEach(async () => {
  await resetFixture({ validCount: 0, blankCount: 0 });
});

test("auth health and rejects password registration", async ({ request }) => {
  const health = await request.get("/api/auth/ok");
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ ok: true });

  const before = await openE2ED1();
  try {
    const usersBefore = await before.d1
      .prepare("SELECT count(*) AS count FROM user")
      .first<{ count: number }>();
    const sessionsBefore = await before.d1
      .prepare("SELECT count(*) AS count FROM session")
      .first<{ count: number }>();
    expect(usersBefore?.count).toBe(2);
    expect(sessionsBefore?.count).toBe(0);

    const registration = await request.post("/api/auth/sign-up/email", {
      data: {
        name: "Rejected Password User",
        email: "password-attempt@example.invalid",
        password: "not-a-real-password",
      },
    });
    expect(registration.status()).toBeGreaterThanOrEqual(400);

    const after = await before.d1
      .prepare("SELECT count(*) AS count FROM user")
      .first<{ count: number }>();
    const sessionsAfter = await before.d1
      .prepare("SELECT count(*) AS count FROM session")
      .first<{ count: number }>();
    expect(after?.count).toBe(usersBefore?.count);
    expect(sessionsAfter?.count).toBe(sessionsBefore?.count);
  } finally {
    await before.dispose();
  }
});

test("Better Auth validates the signed fixture session", async ({ context }) => {
  await signInFixture(context, "test-voter");

  const response = await context.request.get("/api/auth/get-session");
  expect(response.status()).toBe(200);
  const session = await response.json();
  expect(session.user.id).toBe("test-voter");
  expect(session.user.email).toBe("test-voter@example.invalid");
});
