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
  BETTER_AUTH_SECRET: {
    description:
      "Secret used to sign tokens. For production use 32 characters generated with high entropy. See [Better Auth installation](https://www.better-auth.com/docs/installation).",
  },
  GOOGLE_CLIENT_ID: {
    description: "OAuth client ID for the Google sign-in provider.",
  },
  GOOGLE_CLIENT_SECRET: {
    description: "OAuth client secret for the Google sign-in provider.",
  },
});
