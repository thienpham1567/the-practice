import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuthStore } from "./api/auth-store";
import { tryRefreshSession } from "./api/client";
import { AuthPage } from "./auth/AuthPage";
import { DocumentsPage } from "./pages/DocumentsPage";
import { EditorPage } from "./pages/EditorPage";

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
    return (
      <main className="flex h-screen items-center justify-center">
        <p className="text-ink-faint">One moment…</p>
      </main>
    );
  }

  return accessToken ? <>{children}</> : <Navigate to="/login" replace />;
}

export function App() {
  useRestoreSession();

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<EditorPage />} />
          <Route path="/doc/:id" element={<EditorPage />} />
          <Route
            path="/docs"
            element={
              <RequireAuth>
                <DocumentsPage />
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
