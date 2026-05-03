import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "npx tsx prisma/seed.ts",
  },
  datasource: {
    // DIRECT_URL used for migrations (bypasses PgBouncer pooler)
    url: env("DIRECT_URL") ?? env("DATABASE_URL"),
  },
});
