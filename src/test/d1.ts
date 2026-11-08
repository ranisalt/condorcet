import { getPlatformProxy } from "wrangler";
import { readMigrations } from "./migrations.ts";

export async function openTestD1() {
  const proxy = await getPlatformProxy<Env>({
    configPath: "wrangler.jsonc",
    persist: false,
    remoteBindings: false,
    envFiles: [],
  });

  try {
    for (const { statements } of await readMigrations()) {
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
