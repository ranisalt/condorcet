import type { Cookies } from "@sveltejs/kit";
import { describe, expect, it } from "vitest";
import { clearVoter, readVoter, writeVoter, type VoterId } from "./voter-session.ts";

const SECRET = "test-session-secret-with-enough-length";
const NOW = new Date("2026-10-15T12:00:00.000Z");
const VOTER = "voter-opaque-1" as VoterId;

function fakeCookies() {
  const jar = new Map<string, string>();
  const cookies = {
    get: (name: string) => jar.get(name),
    getAll: () => [...jar].map(([name, value]) => ({ name, value })),
    set: (name: string, value: string) => {
      jar.set(name, value);
    },
    delete: (name: string) => {
      jar.delete(name);
    },
    serialize: (name: string, value: string) => `${name}=${value}`,
    parse: () => ({}),
  } as unknown as Cookies;
  return { cookies, jar };
}

async function issuedValue(now: Date = NOW): Promise<{ name: string; value: string }> {
  const { cookies, jar } = fakeCookies();
  await writeVoter(cookies, SECRET, VOTER, now, false);
  const [[name, value]] = [...jar];
  return { name, value };
}

function flipChar(text: string, index: number): string {
  const replacement = text[index] === "A" ? "B" : "A";
  return text.slice(0, index) + replacement + text.slice(index + 1);
}

describe("voter session cookie", () => {
  it("round-trips the voter id", async () => {
    const { cookies } = fakeCookies();
    await writeVoter(cookies, SECRET, VOTER, NOW, false);

    expect(await readVoter(cookies, SECRET, NOW)).toEqual({ id: VOTER });
  });

  it("rejects a flipped payload byte", async () => {
    const { name, value } = await issuedValue();
    const tampered = flipChar(value, 0);
    expect(tampered).not.toBe(value);

    const { cookies } = fakeCookies();
    cookies.set(name, tampered, {});
    expect(await readVoter(cookies, SECRET, NOW)).toBeNull();
  });

  it("rejects a flipped signature byte", async () => {
    const { name, value } = await issuedValue();
    const dot = value.indexOf(".");
    const tampered = value.slice(0, dot + 1) + flipChar(value.slice(dot + 1), 0);
    expect(tampered).not.toBe(value);

    const { cookies } = fakeCookies();
    cookies.set(name, tampered, {});
    expect(await readVoter(cookies, SECRET, NOW)).toBeNull();
  });

  it("rejects a cookie signed with a different secret", async () => {
    const { name, value } = await issuedValue();
    const { cookies } = fakeCookies();
    cookies.set(name, value, {});
    expect(await readVoter(cookies, "another-secret-with-enough-length-1", NOW)).toBeNull();
  });

  it("keeps the voter signed in for exactly one day", async () => {
    const { name, value } = await issuedValue();
    const { cookies } = fakeCookies();
    cookies.set(name, value, {});
    const oneDay = 24 * 60 * 60 * 1000;
    expect(await readVoter(cookies, SECRET, new Date(NOW.getTime() + oneDay - 1))).not.toBeNull();
    expect(await readVoter(cookies, SECRET, new Date(NOW.getTime() + oneDay))).toBeNull();
  });

  it.each(["", "a", "a.b.c", "!!!.***", "%%%"])(
    "treats malformed value %j as signed out",
    async (value) => {
      const { cookies, jar } = fakeCookies();
      jar.set("voter", value);
      jar.set("__Host-voter", value);
      expect(await readVoter(cookies, SECRET, NOW)).toBeNull();
    },
  );

  it("uses the __Host- prefix on secure cookies and clears the matching name", async () => {
    const { cookies, jar } = fakeCookies();
    await writeVoter(cookies, SECRET, VOTER, NOW, true);
    expect([...jar.keys()]).toEqual(["__Host-voter"]);

    clearVoter(cookies, true);
    expect(jar.size).toBe(0);
  });
});
