import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Migrations use the direct (non-pooled) Neon connection
    url: env("DIRECT_URL"),
  },
  migrations: {
    path: "prisma/migrations",
  },
});
