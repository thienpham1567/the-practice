import { useAuthStore } from "../api/auth-store";
import { hasSessionHint } from "../api/session-hint";
import { EditorPage } from "../lazy-pages";
import { LandingPage } from "../pages/LandingPage";
import { homeView } from "./home-view";
import { SessionSplash } from "./SessionSplash";

export function HomeGate() {
  const status = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.accessToken);
  const view = homeView(status, accessToken, hasSessionHint());

  if (view === "splash") return <SessionSplash />;
  if (view === "landing") return <LandingPage />;
  return <EditorPage />;
}
