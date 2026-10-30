import type { Cookies } from "@sveltejs/kit";
import {
  base64UrlDecode,
  base64UrlEncode,
  hmacKey,
  isRecord,
  openPayload,
  sealPayload,
  type VoterId,
} from "./voter-session.ts";

export type LoginErrorReason = "state" | "nonce" | "token" | "claims" | "provider";

export class LoginError extends Error {
  readonly reason: LoginErrorReason;

  constructor(reason: LoginErrorReason) {
    super(`OIDC login failed: ${reason}`);
    this.name = "LoginError";
    this.reason = reason;
  }
}

export type OidcConfig = {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  secret: string;
  secure: boolean;
};

const AUTHORIZE_PATH = "/api/auth/oauth2/authorize";
const TOKEN_PATH = "/api/auth/oauth2/token";
const TRANSACTION_TTL_MS = 600_000;
const TRANSACTION_COOKIE = "oidc_tx";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function transactionCookieName(secure: boolean): string {
  return secure ? `__Host-${TRANSACTION_COOKIE}` : TRANSACTION_COOKIE;
}

function normalizedIssuer(issuer: string): string {
  return issuer.replace(/\/+$/, "");
}

function randomToken(): string {
  return base64UrlEncode(crypto.getRandomValues(new Uint8Array(32)));
}

export async function beginLogin(config: OidcConfig, cookies: Cookies, now: Date): Promise<URL> {
  const state = randomToken();
  const nonce = randomToken();
  const verifier = randomToken();
  const challenge = base64UrlEncode(
    new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(verifier))),
  );

  const value = await sealPayload(
    { state, nonce, verifier, exp: now.getTime() + TRANSACTION_TTL_MS },
    config.secret,
  );
  cookies.set(transactionCookieName(config.secure), value, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: config.secure,
    maxAge: TRANSACTION_TTL_MS / 1000,
  });

  const url = new URL(`${normalizedIssuer(config.issuer)}${AUTHORIZE_PATH}`);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("scope", "openid");
  url.searchParams.set("state", state);
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url;
}

export async function completeLogin(
  config: OidcConfig,
  cookies: Cookies,
  callbackUrl: URL,
  fetchFn: typeof fetch,
  now: Date,
): Promise<VoterId> {
  const name = transactionCookieName(config.secure);
  const raw = cookies.get(name);
  cookies.delete(name, { path: "/", httpOnly: true, sameSite: "lax", secure: config.secure });

  const transaction = raw ? await openPayload(raw, config.secret) : null;
  if (
    !transaction ||
    typeof transaction.state !== "string" ||
    typeof transaction.nonce !== "string" ||
    typeof transaction.verifier !== "string" ||
    typeof transaction.exp !== "number" ||
    transaction.exp <= now.getTime()
  ) {
    throw new LoginError("state");
  }
  if (callbackUrl.searchParams.get("state") !== transaction.state) throw new LoginError("state");
  if (callbackUrl.searchParams.has("error")) throw new LoginError("provider");

  const code = callbackUrl.searchParams.get("code");
  if (!code) throw new LoginError("provider");

  const idToken = await exchangeCode(config, code, transaction.verifier, fetchFn);
  const claims = await verifyIdToken(idToken, config, transaction.nonce, now);
  return claims.sub as VoterId;
}

async function exchangeCode(
  config: OidcConfig,
  code: string,
  verifier: string,
  fetchFn: typeof fetch,
): Promise<string> {
  const credentials = `${encodeURIComponent(config.clientId)}:${encodeURIComponent(config.clientSecret)}`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    code_verifier: verifier,
  });

  let response: Response;
  try {
    response = await fetchFn(`${normalizedIssuer(config.issuer)}${TOKEN_PATH}`, {
      method: "POST",
      headers: {
        authorization: `Basic ${btoa(credentials)}`,
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/json",
      },
      body: body.toString(),
    });
  } catch {
    throw new LoginError("provider");
  }
  if (!response.ok) throw new LoginError("token");

  let json: unknown;
  try {
    json = await response.json();
  } catch {
    throw new LoginError("token");
  }
  if (!isRecord(json) || typeof json.id_token !== "string") throw new LoginError("token");
  return json.id_token;
}

function decodeJsonSegment(segment: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(decoder.decode(base64UrlDecode(segment)));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function verifyIdToken(
  token: string,
  config: OidcConfig,
  expectedNonce: string,
  now: Date,
): Promise<Record<string, unknown> & { sub: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new LoginError("token");
  const [headerSegment, payloadSegment, signatureSegment] = parts as [string, string, string];

  // Pin HS256: rejects `none` and any other algorithm before the signature is considered.
  const header = decodeJsonSegment(headerSegment);
  if (!header || header.alg !== "HS256") throw new LoginError("token");

  let signature: Uint8Array<ArrayBuffer>;
  try {
    signature = base64UrlDecode(signatureSegment);
  } catch {
    throw new LoginError("token");
  }
  const key = await hmacKey(config.clientSecret, "verify");
  const signed = await crypto.subtle.verify(
    "HMAC",
    key,
    signature,
    encoder.encode(`${headerSegment}.${payloadSegment}`),
  );
  if (!signed) throw new LoginError("token");

  const claims = decodeJsonSegment(payloadSegment);
  if (!claims) throw new LoginError("claims");
  if (claims.iss !== normalizedIssuer(config.issuer)) throw new LoginError("claims");
  const audience = claims.aud;
  const audienceMatches = Array.isArray(audience)
    ? audience.includes(config.clientId)
    : audience === config.clientId;
  if (!audienceMatches) throw new LoginError("claims");
  if (typeof claims.exp !== "number" || claims.exp * 1000 <= now.getTime()) {
    throw new LoginError("claims");
  }
  if (typeof claims.sub !== "string" || claims.sub.length === 0) throw new LoginError("claims");
  if (claims.nonce !== expectedNonce) throw new LoginError("nonce");

  return claims as Record<string, unknown> & { sub: string };
}
