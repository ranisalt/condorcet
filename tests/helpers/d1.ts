import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { getPlatformProxy } from "wrangler";

export const TEST_ORIGIN = "http://localhost:4173";
export const TEST_SECRET = "condorcet-local-test-secret-32-characters";

const ROOT = process.cwd();

const PERSIST_PATH = resolve(ROOT, ".wrangler/e2e/v3");
const MARKER_PATH = resolve(ROOT, ".wrangler/e2e/.condorcet-test-database");
const ELECTION_ID = "8bc131c5-3228-46e4-b310-3555653d815d";
const SEED_CANDIDATE_ID = 87;
const SEED_LIMIT = 10_000;
const INSERT_CHUNK_SIZE = 20;
const MIGRATION_TABLE = "__condorcet_e2e_migration";
const FIXTURE_MARKER = "condorcet-local-e2e-v3\n";

export type FixtureOptions = { validCount?: number; blankCount?: number };
export type IsolatedConfig = { path: string; dispose(): Promise<void> };

export async function createE2EWranglerConfig(
  options: { worker?: boolean } = {},
): Promise<IsolatedConfig> {
  const directory = resolve(ROOT, `.wrangler/e2e/config-${process.pid}-${randomUUID()}`);
  await mkdir(directory, { recursive: true });
  const config = {
    name: "condorcet-e2e-local",
    compatibility_date: "2026-10-15",
    compatibility_flags: ["nodejs_als"],
    d1_databases: [
      {
        binding: "DB",
        database_name: "condorcet-e2e-local",
        database_id: "00000000-0000-0000-0000-000000000000",
        migrations_dir: resolve(ROOT, "drizzle"),
      },
    ],
    vars: {
      SESSION_SECRET: TEST_SECRET,
      OIDC_CLIENT_SECRET: "test-secret",
    },
    ...(options.worker
      ? {
          main: resolve(ROOT, ".svelte-kit/cloudflare/_worker.js"),
          assets: {
            binding: "ASSETS",
            directory: resolve(ROOT, ".svelte-kit/cloudflare"),
          },
        }
      : {}),
  };
  const path = join(directory, "wrangler.json");
  await writeFile(path, JSON.stringify(config, null, 2), { flag: "wx" });
  return {
    path,
    dispose: () => rm(directory, { recursive: true, force: true }),
  };
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function assertMarker(): Promise<void> {
  let marker: string;
  try {
    marker = await readFile(MARKER_PATH, "utf8");
  } catch {
    throw new Error("Refusing to reset the E2E database: its local test marker is missing.");
  }
  if (marker !== FIXTURE_MARKER) {
    throw new Error("Refusing to reset the E2E database: its marker is invalid.");
  }
}

async function applyMigrations(d1: D1Database): Promise<void> {
  await d1
    .prepare(`CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (name TEXT PRIMARY KEY NOT NULL)`)
    .run();

  const files = (await readdir(join(ROOT, "drizzle")))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const alreadyApplied = await d1
      .prepare(`SELECT name FROM ${MIGRATION_TABLE} WHERE name = ?`)
      .bind(file)
      .first<{ name: string }>();
    if (alreadyApplied) continue;

    const sql = await readFile(join(ROOT, "drizzle", file), "utf8");
    const statements = sql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);
    await d1.batch([
      ...statements.map((statement) => d1.prepare(statement)),
      d1.prepare(`INSERT INTO ${MIGRATION_TABLE} (name) VALUES (?)`).bind(file),
    ]);
  }
}

async function openProxy(): Promise<{
  d1: D1Database;
  dispose(): Promise<void>;
}> {
  const config = await createE2EWranglerConfig();
  let proxy: Awaited<ReturnType<typeof getPlatformProxy<Env>>> | undefined;
  try {
    proxy = await getPlatformProxy<Env>({
      configPath: config.path,
      persist: { path: PERSIST_PATH },
      remoteBindings: false,
      envFiles: [],
    });
    await applyMigrations(proxy.env.DB);
    return {
      d1: proxy.env.DB,
      dispose: async () => {
        await proxy?.dispose();
        await config.dispose();
      },
    };
  } catch (error) {
    await proxy?.dispose();
    await config.dispose();
    throw error;
  }
}

export async function initializeE2ED1(): Promise<void> {
  await mkdir(resolve(ROOT, ".wrangler/e2e"), { recursive: true });
  if (!(await pathExists(MARKER_PATH))) {
    if (await pathExists(PERSIST_PATH)) {
      const existingFiles = await readdir(PERSIST_PATH);
      if (existingFiles.length > 0) {
        throw new Error("Refusing to mark a non-empty E2E persistence directory as disposable.");
      }
    }
    await writeFile(MARKER_PATH, FIXTURE_MARKER, { flag: "wx" });
  } else {
    await assertMarker();
  }

  const proxy = await openProxy();
  await proxy.dispose();
}

export async function openE2ED1(): Promise<{
  d1: D1Database;
  dispose(): Promise<void>;
}> {
  await assertMarker();
  return openProxy();
}

function validateFixtureCount(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || value > SEED_LIMIT) {
    throw new RangeError(`${name} must be an integer between 0 and ${SEED_LIMIT}.`);
  }
}

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function insertParticipation(
  d1: D1Database,
  rows: { voterId: string; submittedAt: number }[],
): Promise<void> {
  for (const group of chunks(rows, INSERT_CHUNK_SIZE)) {
    const values = group.map(() => "(?, ?, ?, ?)").join(", ");
    const bindings = group.flatMap(({ voterId, submittedAt }) => [
      ELECTION_ID,
      voterId,
      submittedAt,
      submittedAt,
    ]);
    await d1
      .prepare(
        `INSERT INTO election_participant (election_id, voter_id, acknowledged_at, submitted_at) VALUES ${values}`,
      )
      .bind(...bindings)
      .run();
  }
}

async function insertRankRows(d1: D1Database, voterIds: string[]): Promise<void> {
  for (const group of chunks(voterIds, INSERT_CHUNK_SIZE)) {
    const values = group.map(() => "(?, ?, ?, 0)").join(", ");
    const bindings = group.flatMap((voterId) => [ELECTION_ID, voterId, SEED_CANDIDATE_ID]);
    await d1
      .prepare(
        `INSERT INTO ballot_rank (election_id, voter_id, candidate_id, position) VALUES ${values}`,
      )
      .bind(...bindings)
      .run();
  }
}

export async function resetFixture(options: FixtureOptions = {}): Promise<void> {
  const validCount = options.validCount ?? 0;
  const blankCount = options.blankCount ?? 0;
  validateFixtureCount(validCount, "validCount");
  validateFixtureCount(blankCount, "blankCount");
  await assertMarker();

  const proxy = await openProxy();
  try {
    // Child tables first; openProxy applies every migration or throws.
    for (const table of ["ballot_rank", "election_participant"]) {
      await proxy.d1.prepare(`DELETE FROM ${table}`).run();
    }

    if (validCount + blankCount > 0) {
      const now = Date.now();
      const submitted = [
        ...Array.from({ length: validCount }, (_, index) => ({
          voterId: `test-valid-${String(index).padStart(5, "0")}`,
          submittedAt: now,
        })),
        ...Array.from({ length: blankCount }, (_, index) => ({
          voterId: `test-blank-${String(index).padStart(5, "0")}`,
          submittedAt: now,
        })),
      ];
      await insertParticipation(proxy.d1, submitted);
      await insertRankRows(
        proxy.d1,
        submitted.slice(0, validCount).map(({ voterId }) => voterId),
      );
    }
  } finally {
    await proxy.dispose();
  }
}
