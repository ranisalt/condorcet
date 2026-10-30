import type { Cookies } from "@sveltejs/kit";
import { base64UrlDecode, base64UrlEncode, isRecord } from "./encoding.ts";

/** Each cookie kind signs under its own purpose, so a value issued for one is never valid as another. */
export type CookiePurpose = "voter" | "oidc-tx";

export type SignedCookie = {
  /** `__Host-` prefixed on secure transports. */
  name(secure: boolean): string;
  /** `base64url(JSON payload + exp).base64url(HMAC-SHA256(purpose.body))`. */
  seal(payload: Record<string, unknown>, secret: string, now: Date): Promise<string>;
  /** The payload only when signature, purpose and expiry all verify; anything else yields null. */
  open(value: string, secret: string, now: Date): Promise<Record<string, unknown> | null>;
  set(
    cookies: Cookies,
    secret: string,
    payload: Record<string, unknown>,
    now: Date,
    secure: boolean,
  ): Promise<void>;
  /** The transport is not known here, so both the prefixed and plain names are tried. */
  read(cookies: Cookies, secret: string, now: Date): Promise<Record<string, unknown> | null>;
  clear(cookies: Cookies, secure: boolean): void;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function hmacKey(secret: string, usage: "sign" | "verify"): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    [usage],
  );
}

export function signedCookie(spec: {
  purpose: CookiePurpose;
  name: string;
  ttlMs: number;
}): SignedCookie {
  const signedInput = (body: string) => encoder.encode(`${spec.purpose}.${body}`);
  const name = (secure: boolean) => (secure ? `__Host-${spec.name}` : spec.name);
  const options = (secure: boolean) =>
    ({ path: "/", httpOnly: true, sameSite: "lax", secure }) as const;

  async function seal(payload: Record<string, unknown>, secret: string, now: Date) {
    const body = base64UrlEncode(
      encoder.encode(JSON.stringify({ ...payload, exp: now.getTime() + spec.ttlMs })),
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      await hmacKey(secret, "sign"),
      signedInput(body),
    );
    return `${body}.${base64UrlEncode(new Uint8Array(signature))}`;
  }

  async function open(value: string, secret: string, now: Date) {
    try {
      const parts = value.split(".");
      if (parts.length !== 2) return null;
      const [body, signature] = parts as [string, string];
      const ok = await crypto.subtle.verify(
        "HMAC",
        await hmacKey(secret, "verify"),
        base64UrlDecode(signature),
        signedInput(body),
      );
      if (!ok) return null;
      const parsed: unknown = JSON.parse(decoder.decode(base64UrlDecode(body)));
      if (!isRecord(parsed) || typeof parsed.exp !== "number" || parsed.exp <= now.getTime()) {
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  return {
    name,
    seal,
    open,
    async set(cookies, secret, payload, now, secure) {
      cookies.set(name(secure), await seal(payload, secret, now), {
        ...options(secure),
        maxAge: spec.ttlMs / 1000,
      });
    },
    async read(cookies, secret, now) {
      for (const candidate of [name(true), name(false)]) {
        const value = cookies.get(candidate);
        if (!value) continue;
        const payload = await open(value, secret, now);
        if (payload) return payload;
      }
      return null;
    },
    clear(cookies, secure) {
      cookies.delete(name(secure), options(secure));
    },
  };
}
