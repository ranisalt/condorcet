import { defineEnvVars } from "@sveltejs/kit/env";

export const variables = defineEnvVars({
  PUBLIC_SUPABASE_URL: {
    public: true,
    static: true,
    schema: (value) => {
      if (typeof value !== "string" || value === "")
        throw new Error("PUBLIC_SUPABASE_URL is required");
      return value;
    },
  },
  PUBLIC_SUPABASE_PUBLISHABLE_KEY: {
    public: true,
    static: true,
    schema: (value) => {
      if (typeof value !== "string" || value === "") {
        throw new Error("PUBLIC_SUPABASE_PUBLISHABLE_KEY is required");
      }
      return value;
    },
  },
  SESSION_SECRET: {
    description:
      "HMAC secret that signs the voter session cookie. Use at least 32 characters with high entropy.",
  },
  OIDC_ISSUER: {
    description:
      "Supabase OAuth 2.1 issuer, e.g. https://<project-ref>.supabase.co/auth/v1. Must match the token issuer.",
  },
  OIDC_CLIENT_ID: {
    description: "OAuth client ID registered with the Supabase OAuth server for this app.",
  },
  OIDC_CLIENT_SECRET: {
    description: "OAuth client secret registered with the Supabase OAuth server for this app.",
  },
});
