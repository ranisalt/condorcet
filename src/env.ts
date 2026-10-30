import { building } from "$app/env";
import { defineEnvVars } from "@sveltejs/kit/env";

/** Runtime secrets are absent while building; skip validation then, require them at startup. */
function runtimeSecret(name: string) {
  return (value: string | undefined): string => {
    if (building) return value ?? "";
    if (typeof value !== "string" || value === "") throw new Error(`${name} is required`);
    return value;
  };
}

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
    schema: runtimeSecret("SESSION_SECRET"),
  },
  OIDC_CLIENT_ID: {
    static: true,
    description: "OAuth client ID registered with the Supabase OAuth server for this app.",
    schema: (value) => {
      if (typeof value !== "string" || value === "") throw new Error("OIDC_CLIENT_ID is required");
      return value;
    },
  },
  OIDC_CLIENT_SECRET: {
    description: "OAuth client secret registered with the Supabase OAuth server for this app.",
    schema: runtimeSecret("OIDC_CLIENT_SECRET"),
  },
});
