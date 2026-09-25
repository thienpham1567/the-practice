import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./api/auth-store";
import { tryRefreshSession } from "./api/client";
import { CursorLamp } from "./folio/CursorLamp";
import { paintTheme, resolvedTheme } from "./folio/theme";
import { HomeGate } from "./folio/HomeGate";
import { SessionSplash } from "./folio/SessionSplash";
import {
  AuthPage,
  DocumentsPage,
  EditorPage,
  PracticeAttemptPage,
  PracticePage,
  ProgressPage,
  SpeakingAttemptPage,
  SpeakingPage,
  VocabPage,
} from "./lazy-pages";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
});

/**
 * Access token chỉ sống trong bộ nhớ, nên sau khi tải lại trang phải đổi refresh
 * cookie lấy token mới. Cho tới lúc đó, các route cần đăng nhập vẫn chờ.
 */
function useRestoreSession() {
  const markReady = useAuthStore((state) => state.markReady);

  useEffect(() => {
    void tryRefreshSession().finally(markReady);
  }, [markReady]);
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { accessToken, status } = useAuthStore();

  if (status === "loading") {
    return <SessionSplash />;
  }

  return accessToken ? <>{children}</> : <Navigate to="/login" replace />;
}

export function App() {
  useRestoreSession();

  useEffect(() => {
    paintTheme(resolvedTheme());
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <CursorLamp />
      <BrowserRouter>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <div id="main">
          <Suspense fallback={<SessionSplash />}>
            <Routes>
              <Route path="/" element={<HomeGate />} />
              <Route path="/write" element={<EditorPage />} />
              <Route path="/doc/:id" element={<EditorPage />} />
              <Route
                path="/docs"
                element={
                  <RequireAuth>
                    <DocumentsPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/writing"
                element={
                  <RequireAuth>
                    <PracticePage />
                  </RequireAuth>
                }
              />
              <Route
                path="/writing/:id"
                element={
                  <RequireAuth>
                    <PracticeAttemptPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/speaking"
                element={
                  <RequireAuth>
                    <SpeakingPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/speaking/:id"
                element={
                  <RequireAuth>
                    <SpeakingAttemptPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/vocab"
                element={
                  <RequireAuth>
                    <VocabPage />
                  </RequireAuth>
                }
              />
              <Route
                path="/progress"
                element={
                  <RequireAuth>
                    <ProgressPage />
                  </RequireAuth>
                }
              />
              <Route path="/login" element={<AuthPage mode="login" />} />
              <Route path="/register" element={<AuthPage mode="register" />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
