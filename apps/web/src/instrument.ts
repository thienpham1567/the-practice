import { browserTracingIntegration, captureException, init, setUser } from "@sentry/react";
import { routeName } from "./sentry";

/**
 * Chunk riêng, chỉ nạp qua sentry.ts khi trình duyệt rảnh.
 *
 * Từ v11, bỏ trống `dataCollection` nghĩa là thu thập hết, kể cả body request
 * — tức bài viết của học viên. Mọi mục đều khai báo tường minh ở đây.
 * Không bật Session Replay: ~50 KB gzip và ghi lại màn hình học viên.
 */
init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.MODE,
  release: import.meta.env.VITE_SENTRY_RELEASE || undefined,
  dataCollection: {
    // user.id do sentry.ts gắn; không để SDK tự lấy email/IP.
    userInfo: false,
    cookies: false,
    httpHeaders: false,
    httpBodies: [],
    urlQueryParams: true,
    genAI: { inputs: false, outputs: false },
    databaseQueryData: false,
    stackFrameVariables: false,
  },
  integrations: [
    browserTracingIntegration({
      // Gom /writing/<id> thành /writing/:id, không thì mỗi bài là một transaction.
      beforeStartSpan: (options) => ({ ...options, name: routeName(window.location.pathname) }),
    }),
  ],
  tracesSampleRate: import.meta.env.PROD ? 0.1 : 1,
  // /api cùng origin (Render rewrite), nên trace nối thẳng sang span của API.
  tracePropagationTargets: [/^\/api\//],
});

// Chỉ xuất đúng những gì sentry.ts dùng. Xuất cả namespace thì Vite không
// tree-shake được: chunk phình từ ~60 KB lên ~155 KB gzip (kéo cả Replay, Feedback).
export const Sentry = { captureException, setUser };
