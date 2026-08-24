import "dotenv/config";
import { defineConfig } from "prisma/config";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Prisma 7 không đọc connection string từ schema nữa; CLI lấy adapter từ đây.
 * `DATABASE_URL` có thể trỏ sang database test khi chạy e2e.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
  adapter: () => Promise.resolve(new PrismaPg({ connectionString: process.env.DATABASE_URL })),
});
