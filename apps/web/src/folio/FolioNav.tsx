import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../api/auth-store";
import { apiFetch } from "../api/client";

/**
 * Điều hướng dùng chung cho mọi trang đã đăng nhập.
 *
 * Trước đây mỗi trang tự viết danh sách link, nên chúng trôi dạt khi thêm mục
 * mới: Vocabulary và Drafts vẫn giữ nav của thời chưa có Speaking, thành ngõ
 * cụt. Một nguồn sự thật duy nhất: thêm một đích là sửa đúng một chỗ.
 */
const DESTINATIONS = [
  { to: "/practice", label: "Writing" },
  { to: "/speaking", label: "Speaking" },
  { to: "/vocab", label: "Vocabulary" },
  { to: "/progress", label: "Progress" },
  { to: "/docs", label: "Drafts" },
] as const;

const LINK_CLASS =
  "text-ink-faint decoration-vermilion/40 underline-offset-4 hover:text-vermilion hover:underline";

/** `current` là route của chính trang đang mở — bỏ khỏi nav để không tự trỏ vào mình. */
export function FolioNav({ current }: { current?: string }) {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const navigate = useNavigate();

  const signOut = async () => {
    await apiFetch<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
    clearSession();
    void navigate("/");
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm">
      {DESTINATIONS.filter((item) => item.to !== current).map((item) => (
        <Link key={item.to} to={item.to} className={LINK_CLASS}>
          {item.label}
        </Link>
      ))}
      {user && (
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-ink-faint hover:text-vermilion"
        >
          Sign out
        </button>
      )}
    </div>
  );
}
