import { spawn } from "node:child_process";
import { resolve } from "node:path";
import {
  createE2EWranglerConfig,
  initializeE2ED1,
  TEST_ORIGIN,
  TEST_SECRET,
} from "../tests/helpers/d1.ts";

const root = process.cwd();
const preview = process.env.E2E_PREVIEW === "1";
const origin = TEST_ORIGIN;
const secret = TEST_SECRET;
const syntheticAuthEnv = {
  ORIGIN: origin,
  BETTER_AUTH_SECRET: secret,
  GOOGLE_CLIENT_ID: "test-client",
  GOOGLE_CLIENT_SECRET: "test-secret",
};
const childEnv = {
  PATH: process.env.PATH ?? "",
  HOME: process.env.HOME ?? "",
  TMPDIR: process.env.TMPDIR ?? "",
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
  ...syntheticAuthEnv,
};

let config;
let child;
let terminating = false;

try {
  await initializeE2ED1();
  config = await createE2EWranglerConfig({ worker: preview });

  const args = preview
    ? [
        "exec",
        "wrangler",
        "dev",
        resolve(root, ".svelte-kit/cloudflare/_worker.js"),
        "--config",
        config.path,
        "--port",
        "4173",
        "--local",
        "--persist-to",
        ".wrangler/e2e",
        "--env-file",
        "/dev/null",
        ...Object.entries(syntheticAuthEnv).flatMap(([key, value]) => ["--var", `${key}:${value}`]),
      ]
    : [
        "exec",
        "vite",
        "dev",
        "--host",
        "localhost",
        "--port",
        "4173",
        "--strictPort",
        "--mode",
        "e2e",
      ];

  const env = preview
    ? childEnv
    : {
        ...childEnv,
        E2E_WRANGLER_CONFIG: config.path,
      };

  child = spawn("pnpm", args, {
    cwd: root,
    env,
    stdio: "inherit",
  });

  const forwardSignal = (signal) => {
    if (terminating) return;
    terminating = true;
    child.kill(signal);
  };
  process.on("SIGINT", forwardSignal);
  process.on("SIGTERM", forwardSignal);

  const exitCode = await new Promise((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      resolveExit(code ?? (signal ? 1 : 0));
    });
  });
  process.exitCode = exitCode;
} catch (error) {
  console.error(
    "E2E server failed to start.",
    error instanceof Error ? error.message : "Unknown error",
  );
  process.exitCode = 1;
} finally {
  child?.kill("SIGTERM");
  await config?.dispose();
}
