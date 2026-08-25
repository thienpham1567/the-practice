/**
 * E2E chạy trên database riêng để không xóa mất dữ liệu dev.
 * Nạp trước mọi module để `ConfigService` đọc đúng giá trị.
 */
import "dotenv/config";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://writing_helper:writing_helper@localhost:5432/writing_helper_test?schema=public";

process.env.JWT_ACCESS_SECRET ??= "test-access-secret";
process.env.NODE_ENV = "test";

// Ghi đè bất kể .env có key thật hay không: e2e không bao giờ được gọi thật ra
// OpenRouter (tốn tiền, không tất định). Test rewrite mock `global.fetch`.
process.env.OPENROUTER_API_KEY = "test-key";
