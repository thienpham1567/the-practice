import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { sentryVitePlugin } from "@sentry/vite-plugin";

// Render đặt RENDER_GIT_COMMIT lúc build; API đọc cùng biến đó lúc chạy, nên lỗi
// của web và API cùng một release trên Sentry.
const release = process.env.RENDER_GIT_COMMIT ?? "";

// Chỉ upload source map khi có token (Render). Local/CI không có token thì build
// như cũ, không sinh .map.
const uploadSourceMaps = Boolean(process.env.SENTRY_AUTH_TOKEN);

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    uploadSourceMaps &&
      sentryVitePlugin({
        org: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        authToken: process.env.SENTRY_AUTH_TOKEN,
        release: { name: release || undefined },
        // Upload xong thì xoá: không để lộ source qua /assets/*.map.
        sourcemaps: { filesToDeleteAfterUpload: ["./dist/**/*.map"] },
        telemetry: false,
      }),
  ],
  define: {
    "import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(release),
  },
  build: {
    sourcemap: uploadSourceMaps ? "hidden" : false,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/vitest-setup.ts"],
    // Parallel pnpm -r (api jest + web vitest) can starve jsdom; keep headroom.
    testTimeout: 15_000,
    pool: "forks",
  },
});
