import { createHmac } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { createFixtureSession, TEST_ORIGIN, TEST_SECRET } from "./d1.ts";

export async function signInFixture(
  context: BrowserContext,
  userId: "test-voter" | "test-other",
): Promise<void> {
  const { token, expiresAt } = await createFixtureSession(userId);
  const signature = createHmac("sha256", TEST_SECRET).update(token).digest("base64");
  await context.addCookies([
    {
      name: "better-auth.session_token",
      value: `${token}.${signature}`,
      url: TEST_ORIGIN,
      expires: Math.floor(expiresAt.getTime() / 1000),
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}
