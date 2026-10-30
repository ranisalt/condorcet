// Client-side helpers for the Supabase OAuth 2.1 consent ("authorization path") page.
// The Supabase client is injected so the flow can be unit-tested with a fake.

export const AUTHORIZATION_ID_KEY = "condorcet.oauth.authorization_id";
export const CONSENT_PATH = "/oauth/consent";

export type ConsentStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

type ApiError = { message: string };

// Structural subset of supabase.auth that this flow uses. The real client satisfies it.
export type ConsentAuth = {
  signInWithOAuth(credentials: {
    provider: "google";
    options: { redirectTo: string };
  }): Promise<{ error: ApiError | null }>;
  signOut(options: { scope: "local" }): Promise<{ error: ApiError | null }>;
  oauth: {
    getAuthorizationDetails(authorizationId: string): Promise<{
      data: { authorization_id: string } | { redirect_url: string } | null;
      error: ApiError | null;
    }>;
    approveAuthorization(authorizationId: string): Promise<{
      data: { redirect_url: string } | null;
      error: ApiError | null;
    }>;
  };
};

export type ConsentFailureReason = "missing_authorization_id" | "api_error";

export type Outcome<T extends object = object> =
  ({ ok: true } & T) | { ok: false; reason: ConsentFailureReason };

const API_ERROR: Outcome<never> = { ok: false, reason: "api_error" };

/**
 * Persists the authorization id from the URL (it is lost across the Google round trip)
 * and returns the id to use: the URL value when present, otherwise the stored one.
 */
export function resolveAuthorizationId(
  storage: ConsentStorage,
  fromUrl: string | null,
): string | null {
  if (fromUrl) {
    storage.setItem(AUTHORIZATION_ID_KEY, fromUrl);
    return fromUrl;
  }
  return storage.getItem(AUTHORIZATION_ID_KEY) || null;
}

export async function startGoogleSignIn(auth: ConsentAuth, origin: string): Promise<Outcome> {
  const { error } = await auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}${CONSENT_PATH}` },
  });
  return error ? API_ERROR : { ok: true };
}

/**
 * Approves the pending authorization (when consent is still needed), signs the Supabase
 * session out locally, and only then navigates to the client's redirect URL. The session
 * holds the user's email and name, so it must not linger on the ballot origin.
 */
export async function approvePendingAuthorization(
  auth: ConsentAuth,
  storage: ConsentStorage,
  authorizationId: string,
  navigate: (url: string) => void,
): Promise<Outcome<{ redirectUrl: string }>> {
  if (!authorizationId) return { ok: false, reason: "missing_authorization_id" };

  const details = await auth.oauth.getAuthorizationDetails(authorizationId);
  if (details.error || !details.data) return API_ERROR;

  let redirectUrl: string;
  if ("authorization_id" in details.data) {
    const approved = await auth.oauth.approveAuthorization(authorizationId);
    if (approved.error || !approved.data) return API_ERROR;
    redirectUrl = approved.data.redirect_url;
  } else {
    redirectUrl = details.data.redirect_url;
  }

  const signedOut = await auth.signOut({ scope: "local" });
  if (signedOut.error) return API_ERROR;

  storage.removeItem(AUTHORIZATION_ID_KEY);
  navigate(redirectUrl);
  return { ok: true, redirectUrl };
}
