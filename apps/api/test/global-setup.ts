import { execSync } from "node:child_process";

/** Đưa schema mới nhất vào database test một lần trước cả bộ e2e. */
export default function globalSetup(): void {
  const url =
    process.env.TEST_DATABASE_URL ??
    "postgresql://writing_helper:writing_helper@localhost:5432/writing_helper_test?schema=public";

  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
