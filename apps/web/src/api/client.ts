import { useAuthStore, type SessionUser } from "./auth-store";
import { setSessionHint } from "./session-hint";

/**
 * Một cửa duy nhất ra API.
 *
 * Access token sống 15 phút, nên gần như chắc chắn sẽ hết hạn giữa phiên làm
 * việc. Việc xin token mới và gọi lại được giấu ở đây: caller chỉ thấy request
 * thành công, hoặc `ApiError` nếu phiên thật sự đã hết.
 */

const BASE_URL = "/api";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function readError(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json();
    const message = (body as { message?: string | string[] }).message;

    if (Array.isArray(message)) return message.join(", ");
    if (typeof message === "string") return message;
  } catch {
    // Body không phải JSON — dùng thông báo mặc định bên dưới.
  }

  return response.statusText || "Request failed";
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const { accessToken } = useAuthStore.getState();

  return fetch(BASE_URL + path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...init.headers,
    },
  });
}

/**
 * Xin access token mới bằng refresh cookie. Trả về false nếu phiên đã hết
 * hoặc API không trả lời (proxy treo khi backend tắt).
 */
const REFRESH_TIMEOUT_MS = 4_000;

export async function tryRefreshSession(): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      signal: controller.signal,
    });

    // 204 = không có cookie, 401 = phiên đã hết thật. Lỗi mạng/timeout thì giữ
    // cờ để lần sau vẫn chờ khôi phục.
    if (response.status === 204 || response.status === 401) {
      setSessionHint(false);
      return false;
    }
    if (!response.ok) return false;

    const body = (await response.json()) as { accessToken: string; user: SessionUser };
    useAuthStore.getState().setSession(body.accessToken, body.user);

    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await send(path, init);

  if (response.status === 401 && useAuthStore.getState().accessToken !== null) {
    // Thử làm mới đúng một lần; hỏng nữa nghĩa là phải đăng nhập lại.
    if (await tryRefreshSession()) {
      response = await send(path, init);
    } else {
      useAuthStore.getState().clearSession();
    }
  }

  if (!response.ok) throw new ApiError(response.status, await readError(response));
  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

export function apiJson<T>(
  path: string,
  method: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return apiFetch<T>(path, { method, body: JSON.stringify(body), signal });
}
