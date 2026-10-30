import type { BrowserContext } from "@playwright/test";
import { voterCookie } from "../../src/lib/server/voter-session.ts";
import { TEST_ORIGIN, TEST_SECRET } from "./d1.ts";

export async function signInFixture(
  context: BrowserContext,
  voterId: "test-voter" | "test-other",
): Promise<void> {
  const now = new Date();
  const value = await voterCookie.seal({ sub: voterId }, TEST_SECRET, now);
  await context.addCookies([
    {
      name: voterCookie.name(false),
      value,
      url: TEST_ORIGIN,
      expires: Math.floor(now.getTime() / 1000) + 86_400,
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}
