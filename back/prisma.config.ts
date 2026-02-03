import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Берём строку подключения из переменной окружения DATABASE_URL
    url: env("DATABASE_URL"),
  },
});
