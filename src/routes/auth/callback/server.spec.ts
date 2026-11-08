import type * as OidcModule from "#lib/server/oidc.ts";
import { isRedirect, type Cookies } from "@sveltejs/kit";
import { SESSION_SECRET } from "$app/env/private";
import { describe, expect, it, vi } from "vitest";
import { readVoter, voterCookie, type VoterId } from "#lib/server/voter-session.ts";
import type { RequestEvent } from "./$types";

const login = vi.hoisted(() => ({ result: null as (() => Promise<string>) | null }));

vi.mock("#lib/server/oidc.ts", async (importOriginal) => {
  const actual = await importOriginal<typeof OidcModule>();
  return { ...actual, completeLogin: () => login.result!() };
});

import { LoginError } from "#lib/server/oidc.ts";
import { GET } from "./+server.ts";

function fakeCookies() {
  const jar = new Map<string, string>();
  const cookies = {
    get: (name: string) => jar.get(name),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => void jar.set(name, value),
    delete: (name: string) => void jar.delete(name),
    serialize: () => "",
    parse: () => ({}),
  } as unknown as Cookies;
  return { cookies, jar };
}

async function callback(origin: string) {
  const { cookies, jar } = fakeCookies();
  const event = {
    url: new URL(`${origin}/auth/callback?code=c&state=s`),
    cookies,
    fetch,
  } as unknown as RequestEvent;
  try {
    await GET(event);
  } catch (thrown) {
    if (isRedirect(thrown)) return { location: thrown.location, cookies, jar };
    throw thrown;
  }
  throw new Error("callback did not redirect");
}

describe("GET /auth/callback", () => {
  it("signs the voter in with only the verified sub and sends them to the ballot", async () => {
    login.result = async () => "b30810fe-0000-4000-8000-000000000000";

    const { location, cookies, jar } = await callback("https://condorcet.test");

    expect(location).toBe("/ballot");
    expect([...jar.keys()]).toEqual([voterCookie.name(true)]);
    const voter = await readVoter(cookies, SESSION_SECRET, new Date(), true);
    expect(voter?.id).toBe("b30810fe-0000-4000-8000-000000000000" as VoterId);
  });

  it("sends a failed login back home with a generic error and no session", async () => {
    login.result = async () => {
      throw new LoginError("nonce");
    };

    const { location, jar } = await callback("https://condorcet.test");

    expect(location).toBe("/?loginError=1");
    expect(jar.size).toBe(0);
  });

  it("does not hide unexpected failures as login errors", async () => {
    login.result = async () => {
      throw new TypeError("boom");
    };

    await expect(callback("https://condorcet.test")).rejects.toThrow("boom");
  });
});
