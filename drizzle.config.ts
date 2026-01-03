import type { Config } from "drizzle-kit";

export default {
  schema: "./shared/schema.ts",
  out: "./server/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  ssl: "require",
} satisfies Config;
