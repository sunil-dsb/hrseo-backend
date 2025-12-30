import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/seedPermissions.ts",
    // seed: "tsx prisma/seed/seedPricing.ts",
  },
  datasource: {
    url: process.env["DATABASE_URL"],
  },
});
