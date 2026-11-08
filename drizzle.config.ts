import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/lib/server/db/election.schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  strict: true,
});
