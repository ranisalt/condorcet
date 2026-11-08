import { OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, SESSION_SECRET } from "$app/env/private";
import { PUBLIC_SUPABASE_URL } from "$app/env/public";
import { supabaseIssuer, type OidcConfig } from "./oidc.ts";

/** Whether the request came over https, which decides the `__Host-` cookie names. */
export function isSecure(url: URL): boolean {
  return url.protocol === "https:";
}

export function oidcConfigFor(url: URL): OidcConfig {
  return {
    issuer: supabaseIssuer(PUBLIC_SUPABASE_URL),
    clientId: OIDC_CLIENT_ID,
    clientSecret: OIDC_CLIENT_SECRET,
    redirectUri: `${url.origin}/auth/callback`,
    secret: SESSION_SECRET,
    secure: isSecure(url),
  };
}
