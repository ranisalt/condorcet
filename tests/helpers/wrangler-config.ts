import { resolve } from "node:path";
import { experimental_readRawConfig } from "wrangler";

export const TEST_SECRET = "condorcet-local-test-secret-32-characters";

const ROOT = process.cwd();

/**
 * A wrangler config for a local-only test runtime (unit D1 or E2E), with the deployed Worker's
 * compatibility date and flags, a disposable D1 database, and test secrets.
 */
export function localWranglerConfig(name: string): Record<string, unknown> {
  const { rawConfig } = experimental_readRawConfig({ config: resolve(ROOT, "wrangler.jsonc") });
  return {
    name,
    compatibility_date: rawConfig.compatibility_date,
    compatibility_flags: rawConfig.compatibility_flags,
    d1_databases: [
      {
        binding: "DB",
        database_name: name,
        database_id: "00000000-0000-0000-0000-000000000000",
        migrations_dir: resolve(ROOT, "drizzle"),
      },
    ],
    vars: {
      SESSION_SECRET: TEST_SECRET,
      OIDC_CLIENT_SECRET: "test-secret",
    },
  };
}
