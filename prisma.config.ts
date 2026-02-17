import path from "node:path";
import { defineConfig } from "prisma/config";

// Load from .env.local (Next.js convention) with .env fallback
import dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env"), override: false });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Use DIRECT_URL for Prisma CLI operations (migrate/push/generate)
    // DATABASE_URL (pgbouncer) is used at runtime by the app
    url: process.env["DIRECT_URL"] || process.env["DATABASE_URL"],
  },
});
