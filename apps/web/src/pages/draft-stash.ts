import type { SerializedEditorState } from "lexical";

/**
 * Giữ bản nháp chưa lưu khi người dùng bị đưa sang trang đăng nhập.
 *
 * Không có nó thì bấm Save lúc chưa đăng nhập sẽ xoá sạch những gì vừa viết —
 * đúng lúc người dùng vừa tỏ ý muốn giữ lại.
 */

const KEY = "writing-helper:draft";

export interface StashedDraft {
  title: string;
  content: SerializedEditorState;
}

export function stashDraft(draft: StashedDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft));
  } catch {
    // Trình duyệt chặn sessionStorage (chế độ riêng tư) — không đáng để hỏng luồng.
  }
}

/** Có bản nháp đang chờ không — kiểm tra mà không tiêu thụ nó. */
export function hasStashedDraft(): boolean {
  try {
    return sessionStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

/** Đọc và xoá bản nháp đã giữ; chỉ khôi phục đúng một lần. */
export function takeStashedDraft(): StashedDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;

    sessionStorage.removeItem(KEY);
    return JSON.parse(raw) as StashedDraft;
  } catch {
    return null;
  }
}
