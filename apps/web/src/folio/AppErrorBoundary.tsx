import { Component, type ErrorInfo, type ReactNode } from "react";
import { captureException } from "../sentry";
import { CrashNotice } from "./CrashNotice";

/**
 * Tự viết thay cho Sentry.ErrorBoundary để không kéo SDK vào bundle chính
 * (xem sentry.ts).
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    captureException(error, info.componentStack ?? undefined);
  }

  override render() {
    return this.state.failed ? <CrashNotice /> : this.props.children;
  }
}
