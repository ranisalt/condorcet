import type { Cookies } from "@sveltejs/kit";
import { signedCookie } from "./signed-cookie.ts";

export type VoterId = string & { readonly __brand: "VoterId" };

export const voterCookie = signedCookie({ purpose: "voter", name: "voter", ttlMs: 86_400_000 });

export function writeVoter(
  cookies: Cookies,
  secret: string,
  id: VoterId,
  now: Date,
  secure: boolean,
): Promise<void> {
  return voterCookie.set(cookies, secret, { sub: id }, now, secure);
}

export async function readVoter(
  cookies: Cookies,
  secret: string,
  now: Date,
  secure: boolean,
): Promise<{ id: VoterId } | null> {
  const payload = await voterCookie.read(cookies, secret, now, secure);
  if (payload && typeof payload.sub === "string" && payload.sub.length > 0) {
    return { id: payload.sub as VoterId };
  }
  return null;
}

export function clearVoter(cookies: Cookies, secure: boolean): void {
  voterCookie.clear(cookies, secure);
}
