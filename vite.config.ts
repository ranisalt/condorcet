import { mdsvex } from "mdsvex";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import adapter from "@sveltejs/adapter-cloudflare";
import { sveltekit } from "@sveltejs/kit/vite";
import { sentrySvelteKit } from "@sentry/sveltekit/vite";
import { localWranglerConfig } from "./tests/helpers/wrangler-config.ts";

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
      JSON.stringify(localWranglerConfig("condorcet-vitest-local"), null, 2),
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
            // Sentry receives errors and traces from the browser.
            "connect-src": ["self", "https://*.supabase.co", "https://*.sentry.io"],
            // The login action redirects to the Supabase authorize endpoint.
            "form-action": ["self", "https://*.supabase.co"],
            "frame-ancestors": ["none"],
            "base-uri": ["self"],
            "object-src": ["none"],
            // Sentry's security endpoint; violations go unreported without it.
            ...(process.env.SENTRY_CSP_REPORT_URI && {
              "report-uri": [process.env.SENTRY_CSP_REPORT_URI],
            }),
          },
        },
      }),
      paraglideVitePlugin({
        project: "./project.inlang",
        outdir: "./src/lib/paraglide",
        emitTsDeclarations: true,
        // The default (one module per message) delays dev hydration enough to flake e2e.
        outputStructure: "locale-modules",
      }),
      // Always on: it also swaps the SDK's tracing for the $app/state variant, without which the
      // client imports $app/stores and throws on SvelteKit 3. Source map upload (needs
      // SENTRY_ORG and SENTRY_PROJECT too) runs only with a token, since without one the maps
      // would be left in the public assets.
      process.env.VITEST
        ? null
        : sentrySvelteKit({
            telemetry: false,
            autoUploadSourceMaps: Boolean(process.env.SENTRY_AUTH_TOKEN),
            sourcemaps: { filesToDeleteAfterUpload: [".svelte-kit/cloudflare/**/*.map"] },
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
