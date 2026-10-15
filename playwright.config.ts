import { defineConfig } from "@playwright/test";
import { TEST_ORIGIN } from "./tests/helpers/d1.ts";

export default defineConfig({
  testDir: "./tests",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: TEST_ORIGIN,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/e2e-server.mjs",
    url: `${TEST_ORIGIN}/api/auth/ok`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
