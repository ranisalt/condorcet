import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { sveltekitCookies } from "better-auth/svelte-kit";
import { getRequestEvent } from "$app/server";
import { getDb } from "#lib/server/db/index.ts";
import { buildAuthOptions, type AuthConfig } from "./auth-options.ts";

export const createAuth = (d1: D1Database, config: AuthConfig) =>
  betterAuth({
    ...buildAuthOptions(config),
    database: drizzleAdapter(getDb(d1), { provider: "sqlite" }),
    plugins: [sveltekitCookies(getRequestEvent)],
  });
