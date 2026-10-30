import type { Cookies } from "@sveltejs/kit";
import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LoginError, beginLogin, completeLogin, type OidcConfig } from "./oidc.ts";

const NOW = new Date("2026-10-15T12:00:00.000Z");
const TX_TTL_MS = 10 * 60 * 1000;
const SESSION_SECRET = "test-session-secret-with-enough-length";
const CLIENT_SECRET = "ballot-client-secret-with-enough-length";
const CONFIG: OidcConfig = {
  issuer: "https://auth.example",
  clientId: "ballot-client",
  clientSecret: CLIENT_SECRET,
  redirectUri: "https://ballot.example/auth/callback",
  secret: SESSION_SECRET,
  secure: false,
};

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

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function mintIdToken(
  claims: Record<string, unknown>,
  options: { alg?: string; secret?: string } = {},
): string {
  const header = b64url(JSON.stringify({ alg: options.alg ?? "HS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  if ((options.alg ?? "HS256") === "none") return `${signingInput}.`;
  const signature = createHmac("sha256", options.secret ?? CLIENT_SECRET)
    .update(signingInput)
    .digest("base64url");
  return `${signingInput}.${signature}`;
}

function validClaims(nonce: string, overrides: Record<string, unknown> = {}) {
  return {
    iss: CONFIG.issuer,
    aud: CONFIG.clientId,
    sub: "voter-opaque-1",
    nonce,
    iat: Math.floor(NOW.getTime() / 1000),
    exp: Math.floor(NOW.getTime() / 1000) + 300,
    ...overrides,
  };
}

function tokenFetch(idToken: string | null, status = 200) {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn = (async (input: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(input), init });
    const body =
      idToken === null ? { error: "invalid_grant" } : { id_token: idToken, token_type: "Bearer" };
    return new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
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
  it("builds an authorize URL with code flow, openid scope and PKCE S256", async () => {
    const { cookies } = fakeCookies();
    const { authorize } = await startLogin(cookies);

    expect(authorize.origin + authorize.pathname).toBe(
      `${CONFIG.issuer}/api/auth/oauth2/authorize`,
    );
    expect(authorize.searchParams.get("response_type")).toBe("code");
    expect(authorize.searchParams.get("scope")).toBe("openid");
    expect(authorize.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorize.searchParams.get("redirect_uri")).toBe(CONFIG.redirectUri);
    expect(authorize.searchParams.get("client_id")).toBe(CONFIG.clientId);
  });
});

describe("completeLogin", () => {
  it("sends the code verifier matching the challenge with Basic client auth, and returns sub", async () => {
    const { cookies } = fakeCookies();
    const { state, nonce, challenge } = await startLogin(cookies);
    const { fetchFn, calls } = tokenFetch(mintIdToken(validClaims(nonce)));

    const voter = await completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW);

    expect(voter).toBe("voter-opaque-1");
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(`${CONFIG.issuer}/api/auth/oauth2/token`);
    const headers = new Headers(calls[0]?.init?.headers);
    expect(headers.get("authorization")).toBe(
      `Basic ${Buffer.from(`${CONFIG.clientId}:${CLIENT_SECRET}`).toString("base64")}`,
    );
    const form = new URLSearchParams(String(calls[0]?.init?.body));
    expect(form.get("code")).toBe("auth-code-1");
    const verifier = form.get("code_verifier") ?? "";
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(createHash("sha256").update(verifier).digest("base64url")).toBe(challenge);
  });

  it("deletes the transaction cookie after success", async () => {
    const { cookies, jar } = fakeCookies();
    const { state, nonce } = await startLogin(cookies);
    const { fetchFn } = tokenFetch(mintIdToken(validClaims(nonce)));

    await completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW);

    expect([...jar.keys()].filter((name) => name.includes("oidc"))).toEqual([]);
  });

  it("throws reason state on a state mismatch and still deletes the transaction", async () => {
    const { cookies, jar } = fakeCookies();
    const { nonce } = await startLogin(cookies);
    const { fetchFn, calls } = tokenFetch(mintIdToken(validClaims(nonce)));

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl("swapped-state"), fetchFn, NOW),
      "state",
    );
    expect(calls).toHaveLength(0);
    expect([...jar.keys()].filter((name) => name.includes("oidc"))).toEqual([]);
  });

  it("throws reason state when the transaction cookie is missing", async () => {
    const { cookies } = fakeCookies();
    const { fetchFn } = tokenFetch(null);

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl("any-state"), fetchFn, NOW),
      "state",
    );
  });

  it("throws reason state when the transaction cookie has expired", async () => {
    const { cookies } = fakeCookies();
    const { state, nonce } = await startLogin(cookies);
    const { fetchFn } = tokenFetch(mintIdToken(validClaims(nonce)));
    const late = new Date(NOW.getTime() + TX_TTL_MS + 1000);

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, late),
      "state",
    );
  });

  it("throws reason provider when the callback carries error=", async () => {
    const { cookies } = fakeCookies();
    const { state } = await startLogin(cookies);
    const { fetchFn } = tokenFetch(null);

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl(state, { error: "access_denied" }), fetchFn, NOW),
      "provider",
    );
  });

  it("throws reason token when the token endpoint answers 400", async () => {
    const { cookies } = fakeCookies();
    const { state } = await startLogin(cookies);
    const { fetchFn } = tokenFetch(null, 400);

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW),
      "token",
    );
  });

  it("throws reason token when the ID token signature does not verify", async () => {
    const { cookies } = fakeCookies();
    const { state, nonce } = await startLogin(cookies);
    const forged = mintIdToken(validClaims(nonce), { secret: "another-secret-entirely-different" });
    const { fetchFn } = tokenFetch(forged);

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW),
      "token",
    );
  });

  it("throws reason token for alg none", async () => {
    const { cookies } = fakeCookies();
    const { state, nonce } = await startLogin(cookies);
    const unsigned = mintIdToken(validClaims(nonce), { alg: "none" });
    const { fetchFn } = tokenFetch(unsigned);

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW),
      "token",
    );
  });

  it("pins HS256: rejects a header declaring alg none even when HMAC-signed with the client secret", async () => {
    const { cookies } = fakeCookies();
    const { state, nonce } = await startLogin(cookies);
    const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
    const payload = b64url(JSON.stringify(validClaims(nonce)));
    const signature = createHmac("sha256", CLIENT_SECRET)
      .update(`${header}.${payload}`)
      .digest("base64url");
    const { fetchFn } = tokenFetch(`${header}.${payload}.${signature}`);

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW),
      "token",
    );
  });

  it("throws reason claims on an aud mismatch", async () => {
    const { cookies } = fakeCookies();
    const { state, nonce } = await startLogin(cookies);
    const { fetchFn } = tokenFetch(mintIdToken(validClaims(nonce, { aud: "other-client" })));

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW),
      "claims",
    );
  });

  it("throws reason claims on an iss mismatch", async () => {
    const { cookies } = fakeCookies();
    const { state, nonce } = await startLogin(cookies);
    const { fetchFn } = tokenFetch(
      mintIdToken(validClaims(nonce, { iss: "https://evil.example" })),
    );

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW),
      "claims",
    );
  });

  it("throws reason claims on an expired ID token", async () => {
    const { cookies } = fakeCookies();
    const { state, nonce } = await startLogin(cookies);
    const expired = validClaims(nonce, { exp: Math.floor(NOW.getTime() / 1000) - 1 });
    const { fetchFn } = tokenFetch(mintIdToken(expired));

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW),
      "claims",
    );
  });

  it("throws reason nonce on a nonce mismatch", async () => {
    const { cookies } = fakeCookies();
    const { state } = await startLogin(cookies);
    const { fetchFn } = tokenFetch(mintIdToken(validClaims("replayed-nonce")));

    await expectLoginError(
      completeLogin(CONFIG, cookies, callbackUrl(state), fetchFn, NOW),
      "nonce",
    );
  });
});
