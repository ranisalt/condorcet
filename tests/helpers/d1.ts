import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { drizzle } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import { account, session, user } from "../../src/lib/server/db/auth.schema.ts";

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
      BETTER_AUTH_SECRET: TEST_SECRET,
      GOOGLE_CLIENT_ID: "test-client",
      GOOGLE_CLIENT_SECRET: "test-secret",
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

async function insertAuthUsers(
  d1: D1Database,
  fixtureUsers: { id: string; name: string; email: string }[],
): Promise<void> {
  const db = drizzle(d1, { schema: { user, account, session } });
  const now = new Date();
  for (const group of chunks(fixtureUsers, 10)) {
    await db.insert(user).values(
      group.map((fixture) => ({
        id: fixture.id,
        name: fixture.name,
        email: fixture.email,
        emailVerified: true,
        image: null,
        createdAt: now,
        updatedAt: now,
      })),
    );
    await db.insert(account).values(
      group.map((fixture) => ({
        id: `google-account-${fixture.id}`,
        accountId: `google-${fixture.id}`,
        providerId: "google",
        userId: fixture.id,
        createdAt: now,
        updatedAt: now,
      })),
    );
  }
}

async function insertParticipation(
  d1: D1Database,
  rows: { userId: string; submittedAt: number }[],
): Promise<void> {
  for (const group of chunks(rows, INSERT_CHUNK_SIZE)) {
    const values = group.map(() => "(?, ?, ?, ?)").join(", ");
    const bindings = group.flatMap(({ userId, submittedAt }) => [
      ELECTION_ID,
      userId,
      submittedAt,
      submittedAt,
    ]);
    await d1
      .prepare(
        `INSERT INTO election_participant (election_id, user_id, acknowledged_at, submitted_at) VALUES ${values}`,
      )
      .bind(...bindings)
      .run();
  }
}

async function insertRankRows(d1: D1Database, userIds: string[]): Promise<void> {
  for (const group of chunks(userIds, INSERT_CHUNK_SIZE)) {
    const values = group.map(() => "(?, ?, ?, 0)").join(", ");
    const bindings = group.flatMap((userId) => [ELECTION_ID, userId, SEED_CANDIDATE_ID]);
    await d1
      .prepare(
        `INSERT INTO ballot_rank (election_id, user_id, candidate_id, position) VALUES ${values}`,
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
    for (const table of [
      "ballot_rank",
      "election_participant",
      "rate_limit",
      "verification",
      "session",
      "account",
      "user",
    ]) {
      await proxy.d1.prepare(`DELETE FROM ${table}`).run();
    }

    const fixtureUsers = [
      {
        id: "test-voter",
        name: "Synthetic Test Voter",
        email: "test-voter@example.invalid",
      },
      {
        id: "test-other",
        name: "Synthetic Other Voter",
        email: "test-other@example.invalid",
      },
      ...Array.from({ length: validCount }, (_, index) => ({
        id: `test-valid-${String(index).padStart(5, "0")}`,
        name: "Synthetic Valid Ballot",
        email: `test-valid-${index}@example.invalid`,
      })),
      ...Array.from({ length: blankCount }, (_, index) => ({
        id: `test-blank-${String(index).padStart(5, "0")}`,
        name: "Synthetic Blank Ballot",
        email: `test-blank-${index}@example.invalid`,
      })),
    ];
    await insertAuthUsers(proxy.d1, fixtureUsers);

    if (validCount + blankCount > 0) {
      const now = Date.now();
      const submitted = [
        ...Array.from({ length: validCount }, (_, index) => ({
          userId: `test-valid-${String(index).padStart(5, "0")}`,
          submittedAt: now,
        })),
        ...Array.from({ length: blankCount }, (_, index) => ({
          userId: `test-blank-${String(index).padStart(5, "0")}`,
          submittedAt: now,
        })),
      ];
      await insertParticipation(proxy.d1, submitted);
      await insertRankRows(
        proxy.d1,
        submitted.slice(0, validCount).map(({ userId }) => userId),
      );
    }
  } finally {
    await proxy.dispose();
  }
}

export async function createFixtureSession(userId: "test-voter" | "test-other"): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const proxy = await openE2ED1();
  try {
    const token = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    const db = drizzle(proxy.d1, { schema: { user, account, session } });
    await db.insert(session).values({
      id: randomUUID(),
      token,
      expiresAt,
      userId,
      createdAt: now,
      updatedAt: now,
      ipAddress: null,
      userAgent: null,
    });
    return { token, expiresAt };
  } finally {
    await proxy.dispose();
  }
}
