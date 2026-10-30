import { mdsvex } from "mdsvex";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";

export default defineConfig(({ mode }) => {
  let envDir: string | undefined;
  let platformProxy:
    | {
        configPath: string;
        persist: boolean | { path: string };
        remoteBindings: false;
        envFiles: string[];
      }
    | undefined;

  if (mode === "e2e") {
    const configuredPath = process.env.E2E_WRANGLER_CONFIG;
    if (!configuredPath) {
      throw new Error("E2E mode must be launched through scripts/e2e-server.mjs.");
    }
    const configPath = configuredPath;
    envDir = dirname(configPath);
    platformProxy = {
      configPath,
      persist: { path: resolve(".wrangler/e2e/v3") },
      remoteBindings: false,
      envFiles: [],
    };
  } else if (mode === "test") {
    const directory = resolve(".wrangler/vitest");
    const configPath = resolve(directory, "wrangler.json");
    envDir = directory;
    mkdirSync(directory, { recursive: true });
    writeFileSync(
      configPath,
      JSON.stringify(
        {
          name: "condorcet-vitest-local",
          compatibility_date: "2026-10-15",
          compatibility_flags: ["nodejs_als"],
          d1_databases: [
            {
              binding: "DB",
              database_name: "condorcet-vitest-local",
              database_id: "00000000-0000-0000-0000-000000000000",
              migrations_dir: resolve("drizzle"),
            },
          ],
          vars: {
            SESSION_SECRET: "condorcet-local-test-secret-32-characters",
            OIDC_CLIENT_SECRET: "test-secret",
          },
        },
        null,
        2,
      ),
    );
    platformProxy = {
      configPath,
      persist: false,
      remoteBindings: false,
      envFiles: [],
    };
  }

  return {
    envDir,
    plugins: [
      tailwindcss(),
      sveltekit({
        compilerOptions: {
          // Force runes mode for the project, except for libraries. Can be removed in svelte 6.
          runes: ({ filename }) => (filename.includes("node_modules") ? undefined : true),
        },
        adapter: adapter(platformProxy ? { platformProxy } : undefined),
        preprocess: [mdsvex({ extensions: [".svx", ".md"] })],
        extensions: [".svelte", ".svx", ".md"],
        csp: {
          directives: {
            "default-src": ["self"],
            "script-src": ["self"],
            // app.html wraps the body in an inline style attribute.
            "style-src": ["self", "unsafe-inline"],
            "img-src": ["self", "data:"],
            // The OAuth consent page talks to the Supabase auth API from the browser.
            "connect-src": ["self", "https://*.supabase.co"],
            // The login action redirects to the Supabase authorize endpoint.
            "form-action": ["self", "https://*.supabase.co"],
            "frame-ancestors": ["none"],
            "base-uri": ["self"],
            "object-src": ["none"],
          },
        },
      }),
      paraglideVitePlugin({
        project: "./project.inlang",
        outdir: "./src/lib/paraglide",
        emitTsDeclarations: true,
      }),
    ],
    test: {
      expect: { requireAssertions: true },
      projects: [
        {
          extends: "./vite.config.ts",
          test: {
            name: "client",
            browser: {
              enabled: true,
              provider: playwright(),
              instances: [{ browser: "chromium", headless: true }],
            },
            include: ["src/**/*.svelte.{test,spec}.{js,ts}"],
            exclude: ["src/lib/server/**"],
          },
        },
        {
          extends: "./vite.config.ts",
          test: {
            name: "server",
            environment: "node",
            include: ["src/**/*.{test,spec}.{js,ts}"],
            exclude: ["src/**/*.svelte.{test,spec}.{js,ts}"],
          },
        },
      ],
    },
  };
});
