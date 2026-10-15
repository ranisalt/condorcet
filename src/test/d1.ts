import { readFile, readdir } from "node:fs/promises";
import { getPlatformProxy } from "wrangler";

export async function openTestD1() {
  const proxy = await getPlatformProxy<Env>({
    configPath: "wrangler.jsonc",
    persist: false,
    remoteBindings: false,
    envFiles: [],
  });

  try {
    const files = (await readdir("drizzle")).filter((name) => name.endsWith(".sql")).sort();

    for (const file of files) {
      const sql = await readFile(`drizzle/${file}`, "utf8");
      const statements = sql
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter(Boolean);

      for (const statement of statements) {
        await proxy.env.DB.prepare(statement).run();
      }
    }

    return { d1: proxy.env.DB, dispose: () => proxy.dispose() };
  } catch (error) {
    await proxy.dispose();
    throw error;
  }
}
