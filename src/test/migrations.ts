import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

export type Migration = { name: string; statements: string[] };

/** Drizzle migrations in apply order, split at statement breakpoints. */
export async function readMigrations(directory = "drizzle"): Promise<Migration[]> {
  const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
  return Promise.all(
    names.map(async (name) => ({
      name,
      statements: (await readFile(join(directory, name), "utf8"))
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean),
    })),
  );
}
