import type { Cookies } from "@sveltejs/kit";
import { createHash, createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { fakeCookies } from "../../test/cookies.ts";
import { LoginError, beginLogin, completeLogin, supabaseIssuer, type OidcConfig } from "./oidc.ts";

const NOW = new Date("2026-10-15T12:00:00.000Z");
const TX_TTL_MS = 10 * 60 * 1000;
const SESSION_SECRET = "test-session-secret-with-enough-length";
const CLIENT_SECRET = "ballot-client-secret-with-enough-length";
const ISSUER = "https://hmfxwknrxbmtfvhlvnya.supabase.co/auth/v1";
const KID = "a4843f3e-test-kid";
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;
const TOKEN_URL = `${ISSUER}/oauth/token`;
const CONFIG: OidcConfig = {
  issuer: ISSUER,
  clientId: "ballot-client",
  clientSecret: CLIENT_SECRET,
  redirectUri: "https://ballot.example/auth/callback",
  secret: SESSION_SECRET,
  secure: false,
};

let signingKey: CryptoKey;
let jwks: { keys: Record<string, unknown>[] };
let otherKey: CryptoKey;

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  signingKey = pair.privateKey;
  const publicJwk = (await crypto.subtle.exportKey("jwk", pair.publicKey)) as Record<
    string,
    unknown
  >;
  jwks = { keys: [{ ...publicJwk, kid: KID, alg: "ES256", use: "sig" }] };
  otherKey = (
    await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
      "sign",
      "verify",
    ])
  ).privateKey;
});

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

async function signJwt(
  claims: Record<string, unknown>,
  options: { alg?: string; kid?: string; key?: CryptoKey } = {},
): Promise<string> {
  const alg = options.alg ?? "ES256";
  const header = b64url(JSON.stringify({ alg, kid: options.kid ?? KID, typ: "JWT" }));
  const payload = b64url(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  if (alg === "none") return `${signingInput}.`;
  if (alg === "HS256") {
    const signature = createHmac("sha256", CLIENT_SECRET).update(signingInput).digest("base64url");
    return `${signingInput}.${signature}`;
  }
  const raw = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    options.key ?? signingKey,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${Buffer.from(raw).toString("base64url")}`;
}

function validClaims(nonce: string, overrides: Record<string, unknown> = {}) {
  return {
    iss: CONFIG.issuer,
    aud: CONFIG.clientId,
    sub: "voter-opaque-1",
    nonce,
    iat: Math.floor(NOW.getTime() / 1000),
    exp: Math.floor(NOW.getTime() / 1000) + 300,
    client_id: CONFIG.clientId,
    email_verified: true,
    ...overrides,
  };
}

type ProviderOptions = {
  idToken?: string | null;
  tokenBody?: Record<string, unknown>;
  tokenStatus?: number;
  jwks?: unknown;
  jwksStatus?: number;
  jwksThrows?: boolean;
};

function providerFetch(options: ProviderOptions) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url === JWKS_URL) {
      if (options.jwksThrows) throw new TypeError("network down");
      return new Response(JSON.stringify(options.jwks ?? jwks), {
        status: options.jwksStatus ?? 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url === TOKEN_URL) {
      const body =
        options.tokenBody ??
        (options.idToken === null || options.idToken === undefined
          ? { error: "invalid_grant" }
          : { id_token: options.idToken, token_type: "Bearer" });
      return new Response(JSON.stringify(body), {
        status: options.tokenStatus ?? 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { fetchFn, calls };
}

async function startLogin(cookies: Cookies) {
  const authorize = await beginLogin(CONFIG, cookies, NOW);
  return {
    authorize,
    state: authorize.searchParams.get("state") ?? "",
    nonce: authorize.searchParams.get("nonce") ?? "",
    challenge: authorize.searchParams.get("code_challenge") ?? "",
  };
}

function callbackUrl(state: string, extra: Record<string, string> = {}): URL {
  const url = new URL(CONFIG.redirectUri);
  url.searchParams.set("code", "auth-code-1");
  url.searchParams.set("state", state);
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  return url;
}

async function expectLoginError(promise: Promise<unknown>, reason: string) {
  const error = await promise.then(
    () => null,
    (caught: unknown) => caught,
  );
  expect(error).toBeInstanceOf(LoginError);
  expect((error as LoginError).reason).toBe(reason);
}

describe("beginLogin", () => {
  it("builds an authorize URL on the Supabase OAuth server with code flow, openid scope and PKCE S256", async () => {
    const { cookies } = fakeCookies();
    const { authorize, state, nonce } = await startLogin(cookies);

    expect(authorize.origin).toBe("https://hmfxwknrxbmtfvhlvnya.supabase.co");
    expect(authorize.pathname).toBe("/auth/v1/oauth/authorize");
    expect(authorize.searchParams.get("response_type")).toBe("code");
    expect(authorize.searchParams.get("scope")).toBe("openid");
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorize.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(authorize.searchParams.get("client_id")).toBe(CONFIG.clientId);
    expect(state.length).toBeGreaterThanOrEqual(43);
    expect(nonce.length).toBeGreaterThanOrEqual(43);
    expect(authorize.searchParams.get("code_challenge")?.length).toBe(43);
  });

  it("normalizes trailing slashes on the issuer", async () => {
    const { cookies } = fakeCookies();
    const url = await beginLogin({ ...CONFIG, issuer: `${ISSUER}//` }, cookies, NOW);
    expect(url.origin + url.pathname).toBe(`${ISSUER}/oauth/authorize`);
  });
});

describe("completeLogin", () => {
  it("sends the code verifier matching the challenge with Basic client auth, and returns sub", async () => {
    const { cookies } = fakeCookies();
    const { state, nonce, challenge } = await startLogin(cookies);
    const { fetchFn, calls } = providerFetch({ idToken: await signJwt(validClaims(nonce)) });

    const voter = await completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW);

    expect(voter).toBe("voter-opaque-1");
    const tokenCall = calls.find((call) => call.url === TOKEN_URL);
    expect(tokenCall).toBeDefined();
    const headers = new Headers(tokenCall?.init?.headers);
    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from(`${CONFIG.clientId}:${CLIENT_SECRET}`).toString("base64")}`,
    );
    const form = new URLSearchParams(String(tokenCall?.init?.body));
    expect(form.get("code")).toBe("auth-code-1");
    expect(form.get("grant_type")).toBe("authorization_code");
    const verifier = form.get("code_verifier") ?? "";
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(createHash("sha256").update(verifier).digest("base64url")).toBe(challenge);
  });

  it("deletes the transaction cookie after success", async () => {
    const { cookies, jar } = fakeCookies();
    const { state, nonce } = await startLogin(cookies);
    const { fetchFn } = providerFetch({ idToken: await signJwt(validClaims(nonce)) });

    await completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW);

    expect([...jar.keys()].filter((name) => name.includes("oidc"))).toEqual([]);
  });

  it("throws reason state on a state mismatch and still deletes the transaction", async () => {
    const { cookies, jar } = fakeCookies();
    const { nonce } = await startLogin(cookies);
    const { fetchFn, calls } = providerFetch({ idToken: await signJwt(validClaims(nonce)) });

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl("swapped-state"), fetchFn, NOW),
      "state",
    );
    expect(calls).toHaveLength(0);
    expect([...jar.keys()].filter((name) => name.includes("oidc"))).toEqual([]);
  });

  it("throws reason state when the transaction cookie is missing", async () => {
    const { cookies } = fakeCookies();
    const { fetchFn } = providerFetch({ idToken: null });

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl("any-state"), fetchFn, NOW),
      "state",
    );
  });

  it("throws reason state when the transaction cookie has expired", async () => {
    const { cookies } = fakeCookies();
    const { state, nonce } = await startLogin(cookies);
    const { fetchFn } = providerFetch({ idToken: await signJwt(validClaims(nonce)) });
    const late = new Date(NOW.getTime() + TX_TTL_MS + 1000);

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, late),
      "state",
    );
  });

  const nowSeconds = Math.floor(NOW.getTime() / 1000);
  it.each<[string, (nonce: string) => Promise<ProviderOptions>, Record<string, string>, string]>([
    [
      "the callback carries error=",
      async () => ({ idToken: null }),
      { error: "access_denied" },
      "provider",
    ],
    [
      "the token endpoint answers 400",
      async () => ({ idToken: null, tokenStatus: 400 }),
      {},
      "token",
    ],
    [
      "the ID token signature does not verify (signed by another key, same kid)",
      async (nonce) => ({ idToken: await signJwt(validClaims(nonce), { key: otherKey }) }),
      {},
      "token",
    ],
    [
      "the payload was tampered after signing",
      async (nonce) => {
        const [header, , signature] = (await signJwt(validClaims(nonce))).split(".");
        const forgedPayload = b64url(JSON.stringify(validClaims(nonce, { sub: "someone-else" })));
        return { idToken: `${header}.${forgedPayload}.${signature}` };
      },
      {},
      "token",
    ],
    [
      "the ID token uses alg none",
      async (nonce) => ({ idToken: await signJwt(validClaims(nonce), { alg: "none" }) }),
      {},
      "token",
    ],
    [
      "the ID token is HS256, even when HMAC-signed with the client secret",
      async (nonce) => ({ idToken: await signJwt(validClaims(nonce), { alg: "HS256" }) }),
      {},
      "token",
    ],
    [
      "the kid is not in the JWKS",
      async (nonce) => ({
        idToken: await signJwt(validClaims(nonce), { kid: "rotated-away-kid" }),
      }),
      {},
      "token",
    ],
    [
      "the JWKS endpoint answers an error status",
      async (nonce) => ({ idToken: await signJwt(validClaims(nonce)), jwksStatus: 500 }),
      {},
      "provider",
    ],
    [
      "the JWKS fetch itself fails",
      async (nonce) => ({ idToken: await signJwt(validClaims(nonce)), jwksThrows: true }),
      {},
      "provider",
    ],
    [
      "the aud does not match",
      async (nonce) => ({ idToken: await signJwt(validClaims(nonce, { aud: "other-client" })) }),
      {},
      "claims",
    ],
    [
      "the iss does not match",
      async (nonce) => ({
        idToken: await signJwt(validClaims(nonce, { iss: "https://evil.example" })),
      }),
      {},
      "claims",
    ],
    [
      "the ID token has expired",
      async (nonce) => ({ idToken: await signJwt(validClaims(nonce, { exp: nowSeconds - 1 })) }),
      {},
      "claims",
    ],
    [
      "nbf is in the future",
      async (nonce) => ({ idToken: await signJwt(validClaims(nonce, { nbf: nowSeconds + 60 })) }),
      {},
      "claims",
    ],
    [
      "iat is in the future",
      async (nonce) => ({ idToken: await signJwt(validClaims(nonce, { iat: nowSeconds + 60 })) }),
      {},
      "claims",
    ],
    [
      "the nonce does not match",
      async () => ({ idToken: await signJwt(validClaims("replayed-nonce")) }),
      {},
      "nonce",
    ],
  ])("rejects a login when %s", async (_label, provider, extra, reason) => {
    const { cookies } = fakeCookies();
    const { state, nonce } = await startLogin(cookies);
    const { fetchFn } = providerFetch(await provider(nonce));

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl(state, extra), fetchFn, NOW),
      reason,
    );
  });

  it("accepts an aud array that contains the client id", async () => {
    const { cookies } = fakeCookies();
    const { state, nonce } = await startLogin(cookies);
    const { fetchFn } = providerFetch({
      idToken: await signJwt(validClaims(nonce, { aud: ["other-client", CONFIG.clientId] })),
    });

    await expect(completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW)).resolves.toBe(
      "voter-opaque-1",
    );
  });

  it("accepts an nbf that has already passed", async () => {
    const { cookies } = fakeCookies();
    const { state, nonce } = await startLogin(cookies);
    const claims = validClaims(nonce, { nbf: Math.floor(NOW.getTime() / 1000) });
    const { fetchFn } = providerFetch({ idToken: await signJwt(claims) });

    await expect(completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW)).resolves.toBe(
      "voter-opaque-1",
    );
  });

  describe("privacy: only the id_token's sub leaves the login", () => {
    const EMAIL = "voter-private@example.com";
    const GOOGLE_ID = "google-sub-9911";

    async function tokenBodyWithProviderSecrets(idToken: string) {
      const leaky = b64url(
        JSON.stringify({ email: EMAIL, name: "Private Voter", sub: GOOGLE_ID, avatar: "x" }),
      );
      return {
        id_token: idToken,
        access_token: `header.${leaky}.sig`,
        refresh_token: `refresh-${EMAIL}`,
        token_type: "bearer",
      };
    }

    it("returns only sub and never sets a cookie containing the email, name or provider id", async () => {
      const { cookies, jar } = fakeCookies();
      const { state, nonce } = await startLogin(cookies);
      const tokenBody = await tokenBodyWithProviderSecrets(await signJwt(validClaims(nonce)));
      const { fetchFn } = providerFetch({ tokenBody });

      const voter = await completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW);

      expect(voter).toBe("voter-opaque-1");
      for (const value of jar.values()) {
        expect(value).not.toContain(EMAIL);
        expect(value).not.toContain(GOOGLE_ID);
        expect(value).not.toContain("Private Voter");
      }
    });

    it("never puts the email into a thrown error message", async () => {
      const { cookies } = fakeCookies();
      const { state, nonce } = await startLogin(cookies);
      const tokenBody = await tokenBodyWithProviderSecrets(
        await signJwt(validClaims(nonce, { iss: "https://evil.example" })),
      );
      const { fetchFn } = providerFetch({ tokenBody });

      const error = await completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW).then(
        () => null,
        (caught: unknown) => caught,
      );

      expect(error).toBeInstanceOf(LoginError);
      expect(String((error as Error).message)).not.toContain(EMAIL);
      expect(String((error as Error).stack ?? "")).not.toContain(EMAIL);
    });
  });
});

describe("supabaseIssuer", () => {
  it("appends the auth path to the project URL", () => {
    expect(supabaseIssuer("https://hmfxwknrxbmtfvhlvnya.supabase.co")).toBe(ISSUER);
  });

  it("ignores a trailing slash on the project URL", () => {
    expect(supabaseIssuer("https://hmfxwknrxbmtfvhlvnya.supabase.co/")).toBe(ISSUER);
  });
});
