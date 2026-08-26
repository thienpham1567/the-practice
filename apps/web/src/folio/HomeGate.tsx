import { useAuthStore } from "../api/auth-store";
import { EditorPage } from "../pages/EditorPage";
import { LandingPage } from "../pages/LandingPage";
import { homeView } from "./home-view";
import { SessionSplash } from "./SessionSplash";

export function HomeGate() {
  const status = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.accessToken);
  const view = homeView(status, accessToken);

  if (view === "splash") return <SessionSplash />;
  if (view === "landing") return <LandingPage />;
  return <EditorPage />;
}
