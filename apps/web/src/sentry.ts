/**
 * Cửa duy nhất tới Sentry cho phần còn lại của app.
 *
 * SDK nặng ~60 KB gzip (bắt lỗi + tracing) — gần bằng cả bundle landing — nên
 * không import tĩnh. Module này chỉ vài trăm byte: nó bắt lỗi từ lúc trang mở
 * vào hàng đợi, rồi khi trình duyệt rảnh mới nạp `instrument.ts` và gửi bù.
 * Không có VITE_SENTRY_DSN (dev, test) thì không nạp gì cả.
 */
type Captured = { error: unknown; componentStack?: string };
type SentryApi = (typeof import("./instrument"))["Sentry"];

const queue: Captured[] = [];
let sentry: SentryApi | null = null;
let userId: string | null = null;

function onError(event: ErrorEvent) {
  queue.push({ error: event.error ?? event.message });
}
function onRejection(event: PromiseRejectionEvent) {
  queue.push({ error: event.reason });
}

export function captureException(error: unknown, componentStack?: string): void {
  if (sentry) {
    sentry.captureException(
      error,
      componentStack ? { contexts: { react: { componentStack } } } : undefined,
    );
  } else {
    queue.push({ error, componentStack });
  }
}

/** Chỉ id, không email: đủ để gom lỗi theo người dùng. */
export function setSentryUser(id: string | null): void {
  userId = id;
  sentry?.setUser(id ? { id } : null);
}

/** Gom /writing/<id> thành /writing/:id, không thì mỗi bài là một transaction. */
export function routeName(pathname: string): string {
  return pathname.replace(/^\/(writing|speaking|doc)\/[^/]+\/?$/, "/$1/:id");
}

export function startSentry(): void {
  if (!import.meta.env.VITE_SENTRY_DSN) return;

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  const load = () =>
    void import("./instrument").then(({ Sentry }) => {
      // Từ đây SDK tự lắng nghe lỗi toàn cục.
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      sentry = Sentry;
      if (userId) Sentry.setUser({ id: userId });
      for (const { error, componentStack } of queue.splice(0))
        captureException(error, componentStack);
    });

  const whenIdle = () =>
    "requestIdleCallback" in window
      ? requestIdleCallback(load, { timeout: 4000 })
      : setTimeout(load, 1500);
  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}
