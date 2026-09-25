import { create } from "zustand";
import { setSessionHint } from "./session-hint";

export interface SessionUser {
  id: string;
  email: string;
}

interface AuthState {
  /** Chỉ giữ trong bộ nhớ: refresh cookie httpOnly mới là thứ sống qua reload. */
  accessToken: string | null;
  user: SessionUser | null;
  /** "loading" cho tới khi thử khôi phục phiên bằng refresh cookie xong. */
  status: "loading" | "ready";
  setSession: (accessToken: string, user: SessionUser) => void;
  clearSession: () => void;
  markReady: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  accessToken: null,
  user: null,
  status: "loading",
  setSession: (accessToken, user) => {
    setSessionHint(true);
    set({ accessToken, user, status: "ready" });
  },
  clearSession: () => {
    setSessionHint(false);
    set({ accessToken: null, user: null, status: "ready" });
  },
  markReady: () => set({ status: "ready" }),
}));

export function isSignedIn(): boolean {
  return useAuthStore.getState().accessToken !== null;
}
