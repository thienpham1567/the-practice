import * as Sentry from "@sentry/nestjs";

/**
 * Phải là import đầu tiên của main.ts: Sentry vá http/express/pg qua
 * OpenTelemetry ngay lúc các module đó được nạp. Không có SENTRY_DSN (dev,
 * test) thì SDK tắt hẳn.
 *
 * Từ v11, bỏ trống `dataCollection` nghĩa là thu thập hết: body request (bài
 * viết, audio base64, mật khẩu), cookie (refresh_token), dữ liệu query DB. Nên
 * mọi mục ở đây đều khai báo tường minh — thêm mục mới thì mặc định là tắt.
 */
const isProduction = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.SENTRY_ENVIRONMENT ?? (isProduction ? "production" : "development"),
  // Render tự đặt biến này cho mỗi deploy — khớp với release của bản web.
  release: process.env.RENDER_GIT_COMMIT,
  dataCollection: {
    // user.id do JwtAuthGuard gắn; không để SDK tự lấy email/IP.
    userInfo: false,
    cookies: false,
    httpHeaders: {
      request: { allow: ["user-agent", "content-type", "content-length", "x-request-id"] },
      response: false,
    },
    httpBodies: [],
    urlQueryParams: true,
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    stackFrameVariables: false,
  },
  tracesSampler: ({ name, normalizedRequest, attributes, inheritOrSampleWith }) => {
    // Render gọi /health/ready liên tục; trace nó chỉ tốn quota. Lúc lấy mẫu,
    // span HTTP mới tên "GET" — đường dẫn nằm ở request/attributes.
    const target = String(
      normalizedRequest?.url ?? attributes?.["url.path"] ?? attributes?.["http.target"] ?? name,
    );
    if (target.includes("/health")) return 0;
    return inheritOrSampleWith(isProduction ? 0.1 : 1);
  },
});
