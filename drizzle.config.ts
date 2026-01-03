import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.DATABASE_URL || "";
const sslUrl = dbUrl.includes("?") 
  ? `${dbUrl}&sslmode=require` 
  : `${dbUrl}?sslmode=require`;

export default defineConfig({
  schema: "./shared/schema.ts",
  out: "./server/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: sslUrl,
  },
});
