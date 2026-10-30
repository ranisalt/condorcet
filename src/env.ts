import { building, dev } from "$app/env";
import { defineEnvVars } from "@sveltejs/kit/env";
import { parseResultsThreshold } from "./lib/results-threshold.ts";

/**
 * Validates a secret that only exists in the Worker runtime. The build environment does not have
 * it, so validation is skipped while building. The app fails to start if the secret is missing.
 */
function runtimeSecret(name: string) {
  return (value: string | undefined): string => {
    if (building) return value ?? "";
    if (typeof value !== "string" || value === "") throw new Error(`${name} is required`);
    return value;
  };
}

/** Sentry settings are public and static: inlined at build time, shared by browser and Worker. */
function sentry<T>(schema: (value: string | undefined) => T) {
  return { public: true, static: true, schema } as const;
}

function sampleRate(name: string, fallback: number) {
  return (value: string | undefined): number => {
    if (value === undefined || value === "") return fallback;
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate < 0 || rate > 1) throw new Error(`${name} must be 0 to 1`);
    return rate;
  };
}

export const variables = defineEnvVars({
  // Without a DSN the SDK sends nothing, as in local development and tests.
  SENTRY_DSN: sentry((value) => {
    if (value === undefined || value === "") return "";
    if (!URL.canParse(value)) throw new Error("SENTRY_DSN must be a URL");
    return value;
  }),
  SENTRY_ENVIRONMENT: sentry((value) => value || (dev ? "development" : "production")),
  SENTRY_TRACES_SAMPLE_RATE: sentry(sampleRate("SENTRY_TRACES_SAMPLE_RATE", dev ? 1 : 0.25)),
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
  RESULTS_THRESHOLD: {
    static: true,
    description:
      "Valid ballots needed before results unlock. Leave unset until the number is decided; results stay locked.",
    schema: (value) => parseResultsThreshold(typeof value === "string" ? value : undefined),
  },
  OIDC_CLIENT_SECRET: {
    description: "OAuth client secret registered with the Supabase OAuth server for this app.",
    schema: runtimeSecret("OIDC_CLIENT_SECRET"),
  },
});
