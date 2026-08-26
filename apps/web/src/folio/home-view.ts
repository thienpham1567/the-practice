export type HomeView = "splash" | "landing" | "editor";

export function homeView(
  status: "loading" | "ready",
  accessToken: string | null,
): HomeView {
  if (status === "loading") return "splash";
  return accessToken ? "editor" : "landing";
}
