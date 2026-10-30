import type { BrowserContext } from "@playwright/test";
import {
  sealPayload,
  VOTER_SESSION_TTL_MS,
  voterCookieName,
} from "../../src/lib/server/voter-session.ts";
import { TEST_ORIGIN, TEST_SECRET } from "./d1.ts";

export async function signInFixture(
  context: BrowserContext,
  voterId: "test-voter" | "test-other",
): Promise<void> {
  const exp = Date.now() + VOTER_SESSION_TTL_MS;
  const value = await sealPayload({ sub: voterId, exp }, TEST_SECRET);
  await context.addCookies([
    {
      name: voterCookieName(false),
      value,
      url: TEST_ORIGIN,
      expires: Math.floor(exp / 1000),
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}
