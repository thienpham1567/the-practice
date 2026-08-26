import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./api/auth-store";
import { tryRefreshSession } from "./api/client";
import { AuthPage } from "./auth/AuthPage";
import { HomeGate } from "./folio/HomeGate";
import { SessionSplash } from "./folio/SessionSplash";
import { DocumentsPage } from "./pages/DocumentsPage";
import { EditorPage } from "./pages/EditorPage";
import { PracticeAttemptPage } from "./pages/PracticeAttemptPage";
import { PracticePage } from "./pages/PracticePage";

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

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
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
            path="/practice"
            element={
              <RequireAuth>
                <PracticePage />
              </RequireAuth>
            }
          />
          <Route
            path="/practice/:id"
            element={
              <RequireAuth>
                <PracticeAttemptPage />
              </RequireAuth>
            }
          />
          <Route path="/login" element={<AuthPage mode="login" />} />
          <Route path="/register" element={<AuthPage mode="register" />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
