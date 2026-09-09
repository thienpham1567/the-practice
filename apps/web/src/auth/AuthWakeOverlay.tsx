import { useEffect, useRef, useState } from "react";
import type { ApiReadyStatus } from "./api-ready";

export const WAKE_COPY_SHIFT_MS = 8_000;
export const WAKE_COPY_WAIT = "One moment…";
export const WAKE_COPY_SLOW = "The desk is waking. This can take a minute.";
export const WAKE_COPY_FAIL = "The desk isn't answering.";

export function AuthWakeOverlay({
  status,
  onRetry,
}: {
  status: Exclude<ApiReadyStatus, "ready">;
  onRetry: () => void;
}) {
  const [slow, setSlow] = useState(false);
  const retryRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (status !== "checking") return;
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), WAKE_COPY_SHIFT_MS);
    return () => clearTimeout(timer);
  }, [status]);

  useEffect(() => {
    if (status === "failed") retryRef.current?.focus();
  }, [status]);

  return (
    <div
      data-testid="auth-wake-overlay"
      className="auth-wake-overlay fixed inset-0 z-20 flex flex-col items-center justify-center px-6"
    >
      {status === "checking" && <div className="auth-wake-rule mb-4" aria-hidden="true" />}
      <p
        role="status"
        aria-live="polite"
        className="text-center font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-soft"
      >
        {status === "failed" ? WAKE_COPY_FAIL : slow ? WAKE_COPY_SLOW : WAKE_COPY_WAIT}
      </p>
      {status === "failed" && (
        <button
          ref={retryRef}
          type="button"
          onClick={onRetry}
          className="mt-5 font-mono text-sm uppercase tracking-[0.15em] text-vermilion underline underline-offset-2"
        >
          Try again
        </button>
      )}
    </div>
  );
}
