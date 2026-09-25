/** Fallback của Sentry.ErrorBoundary: lỗi đã được gửi đi, học viên chỉ cần tải lại. */
export function CrashNotice() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 px-6 text-center">
      <p className="font-display text-2xl italic">Something tore the page.</p>
      <p className="max-w-[40ch] text-ink-soft">
        The error has been reported. Your saved drafts are safe — reload to pick up where you left
        off.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="min-h-11 bg-ink px-5 py-2 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-vermilion"
      >
        Reload
      </button>
    </main>
  );
}
