import type { Cookies } from "@sveltejs/kit";

export type VoterId = string & { readonly __brand: "VoterId" };

export const VOTER_SESSION_TTL_MS = 604_800_000;

const VOTER_COOKIE = "voter";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

export function voterCookieName(secure: boolean): string {
  return secure ? `__Host-${VOTER_COOKIE}` : VOTER_COOKIE;
}

export function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Strict decoder: rejects characters outside the alphabet and non-canonical trailing bits. */
export function base64UrlDecode(text: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) {
    throw new Error("invalid base64url");
  }
  const padded =
    text.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (text.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  if (base64UrlEncode(bytes) !== text) throw new Error("non-canonical base64url");
  return bytes;
}

export function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

/** Produces `base64url(JSON payload).base64url(HMAC-SHA256)`. */
export async function sealPayload(
  payload: Record<string, unknown>,
  secret: string,
): Promise<string> {
  const body = base64UrlEncode(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, "sign"),
    encoder.encode(body),
  );
  return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
}

/** Returns the payload only when the signature verifies; malformed input yields null. */
export async function openPayload(
  value: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  try {
    const parts = value.split(".");
    if (parts.length !== 2) return null;
    const [body, signature] = parts as [string, string];
    const ok = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret, "verify"),
      base64UrlDecode(signature),
      encoder.encode(body),
    );
    if (!ok) return null;
    const parsed: unknown = JSON.parse(decoder.decode(base64UrlDecode(body)));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function writeVoter(
  cookies: Cookies,
  secret: string,
  id: VoterId,
  now: Date,
  secure: boolean,
): Promise<void> {
  const value = await sealPayload({ sub: id, exp: now.getTime() + VOTER_SESSION_TTL_MS }, secret);
  cookies.set(voterCookieName(secure), value, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure,
    maxAge: VOTER_SESSION_TTL_MS / 1000,
  });
}

/** The prefix depends on the transport, which this call does not receive, so both names are tried. */
export async function readVoter(
  cookies: Cookies,
  secret: string,
  now: Date,
): Promise<{ id: VoterId } | null> {
  for (const name of [voterCookieName(true), voterCookieName(false)]) {
    const value = cookies.get(name);
    if (!value) continue;
    const payload = await openPayload(value, secret);
    if (
      payload &&
      typeof payload.sub === "string" &&
      payload.sub.length > 0 &&
      typeof payload.exp === "number" &&
      payload.exp > now.getTime()
    ) {
      return { id: payload.sub as VoterId };
    }
  }
  return null;
}

export function clearVoter(cookies: Cookies, secure: boolean): void {
  cookies.delete(voterCookieName(secure), { path: "/", httpOnly: true, sameSite: "lax", secure });
}
