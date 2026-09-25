export type HomeView = "splash" | "landing" | "editor";

/**
 * `hasSessionHint`: lần trước trình duyệt này có đăng nhập. Không có gợi ý thì
 * gần như chắc là khách mới, nên hiện landing ngay trong lúc refresh chạy ngầm.
 */
export function homeView(
  status: "loading" | "ready",
  accessToken: string | null,
  hasSessionHint: boolean,
): HomeView {
  if (accessToken) return "editor";
  if (status === "loading" && hasSessionHint) return "splash";
  return "landing";
}
