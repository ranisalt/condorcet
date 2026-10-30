import { OIDC_CLIENT_ID, OIDC_CLIENT_SECRET, OIDC_ISSUER, SESSION_SECRET } from "$app/env/private";
import type { OidcConfig } from "./oidc.ts";

export function oidcConfigFor(url: URL): OidcConfig {
  return {
    issuer: OIDC_ISSUER,
    clientId: OIDC_CLIENT_ID,
    clientSecret: OIDC_CLIENT_SECRET,
    redirectUri: `${url.origin}/auth/callback`,
    secret: SESSION_SECRET,
    secure: url.protocol === "https:",
  };
}
