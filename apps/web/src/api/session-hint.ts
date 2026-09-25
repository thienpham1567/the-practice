/**
 * Refresh cookie là httpOnly nên JS không biết trước được có phiên hay không.
 * Cờ này chỉ là gợi ý: có cờ thì trang chủ chờ khôi phục phiên, không có thì
 * hiện landing ngay thay vì treo "One moment…" suốt lúc API khởi động.
 */
const KEY = "the-practice-has-session";

export function hasSessionHint(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function setSessionHint(present: boolean): void {
  try {
    if (present) localStorage.setItem(KEY, "1");
    else localStorage.removeItem(KEY);
  } catch {
    // Trình duyệt chặn storage: mất tối ưu, không mất chức năng.
  }
}
