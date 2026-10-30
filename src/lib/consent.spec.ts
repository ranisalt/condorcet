import { describe, expect, it, vi } from "vitest";
import {
  AUTHORIZATION_ID_KEY,
  approvePendingAuthorization,
  resolveAuthorizationId,
  startGoogleSignIn,
  type ConsentAuth,
  type ConsentStorage,
} from "./consent.ts";

function memoryStorage(initial: Record<string, string> = {}): ConsentStorage & {
  data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

type Details = Awaited<ReturnType<ConsentAuth["oauth"]["getAuthorizationDetails"]>>;
type Approved = Awaited<ReturnType<ConsentAuth["oauth"]["approveAuthorization"]>>;

type FakeOptions = {
  details?: Details;
  approved?: Approved;
  signOutError?: { message: string } | null;
  signInError?: { message: string } | null;
  calls?: string[];
};

function fakeAuth(options: FakeOptions = {}) {
  const calls = options.calls ?? [];
  const signInWithOAuth = vi.fn<ConsentAuth["signInWithOAuth"]>(async () => {
    calls.push("signInWithOAuth");
    return { error: options.signInError ?? null };
  });
  const signOut = vi.fn<ConsentAuth["signOut"]>(async () => {
    calls.push("signOut");
    return { error: options.signOutError ?? null };
  });
  const getAuthorizationDetails = vi.fn<ConsentAuth["oauth"]["getAuthorizationDetails"]>(
    async () => {
      calls.push("getAuthorizationDetails");
      return (
        options.details ?? {
          data: { redirect_url: "https://client.example/cb?code=1" },
          error: null,
        }
      );
    },
  );
  const approveAuthorization = vi.fn<ConsentAuth["oauth"]["approveAuthorization"]>(async () => {
    calls.push("approveAuthorization");
    return (
      options.approved ?? {
        data: { redirect_url: "https://client.example/cb?code=2" },
        error: null,
      }
    );
  });
  const auth: ConsentAuth = {
    signInWithOAuth,
    signOut,
    oauth: { getAuthorizationDetails, approveAuthorization },
  };
  return { auth, calls, signInWithOAuth, signOut, getAuthorizationDetails, approveAuthorization };
}

const consentDetails = {
  authorization_id: "auth-123",
  redirect_uri: "https://client.example/cb",
  client: { name: "Client" },
  scope: "openid",
};

describe("resolveAuthorizationId", () => {
  it("stores the id from the URL and returns it", () => {
    const storage = memoryStorage();
    expect(resolveAuthorizationId(storage, "auth-123")).toBe("auth-123");
    expect(storage.data.get(AUTHORIZATION_ID_KEY)).toBe("auth-123");
  });

  it("reads the stored id back when the URL has none (after the Google round trip)", () => {
    const storage = memoryStorage({ [AUTHORIZATION_ID_KEY]: "auth-123" });
    expect(resolveAuthorizationId(storage, null)).toBe("auth-123");
  });

  it("returns null when neither the URL nor storage has an id", () => {
    expect(resolveAuthorizationId(memoryStorage(), null)).toBeNull();
  });

  it("treats an empty URL id as absent and falls back to storage", () => {
    const storage = memoryStorage({ [AUTHORIZATION_ID_KEY]: "auth-123" });
    expect(resolveAuthorizationId(storage, "")).toBe("auth-123");
  });
});

describe("startGoogleSignIn", () => {
  it("starts Google sign-in redirecting back to the consent page on this origin", async () => {
    const fake = fakeAuth();
    const outcome = await startGoogleSignIn(fake.auth, "https://ballot.example");
    expect(outcome).toEqual({ ok: true });
    expect(fake.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: { redirectTo: "https://ballot.example/oauth/consent" },
    });
  });

  it("reports an api_error when Supabase refuses the sign-in", async () => {
    const fake = fakeAuth({ signInError: { message: "boom" } });
    expect(await startGoogleSignIn(fake.auth, "https://ballot.example")).toEqual({
      ok: false,
      reason: "api_error",
    });
  });
});

describe("approvePendingAuthorization", () => {
  it("fails without an authorization id and never calls the API or navigates", async () => {
    const fake = fakeAuth();
    const navigate = vi.fn();
    const outcome = await approvePendingAuthorization(fake.auth, memoryStorage(), "", navigate);
    expect(outcome).toEqual({ ok: false, reason: "missing_authorization_id" });
    expect(fake.getAuthorizationDetails).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("approves a pending consent, signs out locally, then navigates to the redirect URL", async () => {
    const calls: string[] = [];
    const fake = fakeAuth({ calls, details: { data: consentDetails, error: null } });
    const storage = memoryStorage({ [AUTHORIZATION_ID_KEY]: "auth-123" });
    const navigate = vi.fn((url: string) => void calls.push(`navigate:${url}`));

    const outcome = await approvePendingAuthorization(fake.auth, storage, "auth-123", navigate);

    expect(outcome).toEqual({ ok: true, redirectUrl: "https://client.example/cb?code=2" });
    expect(fake.approveAuthorization).toHaveBeenCalledWith("auth-123");
    expect(fake.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(calls).toEqual([
      "getAuthorizationDetails",
      "approveAuthorization",
      "signOut",
      "navigate:https://client.example/cb?code=2",
    ]);
    expect(storage.data.has(AUTHORIZATION_ID_KEY)).toBe(false);
  });

  it("skips approval when consent was already given and still signs out before navigating", async () => {
    const calls: string[] = [];
    const fake = fakeAuth({
      calls,
      details: { data: { redirect_url: "https://client.example/cb?code=9" }, error: null },
    });
    const navigate = vi.fn((url: string) => void calls.push(`navigate:${url}`));

    const outcome = await approvePendingAuthorization(
      fake.auth,
      memoryStorage(),
      "auth-123",
      navigate,
    );

    expect(outcome).toEqual({ ok: true, redirectUrl: "https://client.example/cb?code=9" });
    expect(fake.approveAuthorization).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "getAuthorizationDetails",
      "signOut",
      "navigate:https://client.example/cb?code=9",
    ]);
  });

  it("reports an api_error and does not navigate when details lookup fails", async () => {
    const fake = fakeAuth({ details: { data: null, error: { message: "expired" } } });
    const navigate = vi.fn();
    const storage = memoryStorage({ [AUTHORIZATION_ID_KEY]: "auth-123" });

    const outcome = await approvePendingAuthorization(fake.auth, storage, "auth-123", navigate);

    expect(outcome).toEqual({ ok: false, reason: "api_error" });
    expect(navigate).not.toHaveBeenCalled();
    expect(fake.signOut).not.toHaveBeenCalled();
    expect(storage.data.get(AUTHORIZATION_ID_KEY)).toBe("auth-123");
  });

  it("reports an api_error and does not navigate when approval fails", async () => {
    const fake = fakeAuth({
      details: { data: consentDetails, error: null },
      approved: { data: null, error: { message: "denied" } },
    });
    const navigate = vi.fn();

    const outcome = await approvePendingAuthorization(
      fake.auth,
      memoryStorage(),
      "auth-123",
      navigate,
    );

    expect(outcome).toEqual({ ok: false, reason: "api_error" });
    expect(fake.signOut).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not navigate when local sign-out fails, so the session never reaches the client", async () => {
    const fake = fakeAuth({
      details: { data: consentDetails, error: null },
      signOutError: { message: "storage unavailable" },
    });
    const navigate = vi.fn();

    const outcome = await approvePendingAuthorization(
      fake.auth,
      memoryStorage(),
      "auth-123",
      navigate,
    );

    expect(outcome).toEqual({ ok: false, reason: "api_error" });
    expect(navigate).not.toHaveBeenCalled();
  });
});
