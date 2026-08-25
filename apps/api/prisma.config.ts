import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 không đọc connection string từ schema nữa — CLI lấy từ đây.
 * `DATABASE_URL` trỏ sang database test khi chạy e2e.
 *
 * Driver adapter chỉ dùng lúc chạy ứng dụng (xem `PrismaService`), không phải ở
 * config của CLI.
 */
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
});
