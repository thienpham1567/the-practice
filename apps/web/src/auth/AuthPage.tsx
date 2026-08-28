import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiJson, ApiError } from "../api/client";
import { useAuthStore, type SessionUser } from "../api/auth-store";
import { BrandLockup } from "../BrandLockup";
import { afterAuthPath } from "../folio/after-auth-path";
import { AuthAmbient } from "./AuthAmbient";
import { useGoogleSignIn } from "./useGoogleSignIn";

interface AuthPageProps {
  mode: "login" | "register";
}

const COPY = {
  login: {
    heading: "Welcome back",
    lede: "Your papers and talks are waiting.",
    action: "Sign in",
    path: "/auth/login",
    switchText: "No account yet?",
    switchLabel: "Create one",
    switchTo: "/register",
  },
  register: {
    heading: "Begin practice",
    lede: "An account keeps your papers and talks.",
    action: "Create account",
    path: "/auth/register",
    switchText: "Already have an account?",
    switchLabel: "Sign in",
    switchTo: "/login",
  },
} as const;

export function AuthPage({ mode }: AuthPageProps) {
  const copy = COPY[mode];
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const google = useGoogleSignIn({ formPending: pending });
  const alertMessage = error ?? google.error;
  const formBusy = pending || google.status === "submitting";

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (formBusy) return;
    setError(null);
    setPending(true);

    try {
      const result = await apiJson<{ accessToken: string; user: SessionUser }>(
        copy.path,
        "POST",
        { email, password },
      );

      setSession(result.accessToken, result.user);
      void navigate(afterAuthPath());
    } catch (caught) {
      setPending(false);
      setError(caught instanceof ApiError ? caught.message : "Something went wrong");
    }
  };

  return (
    <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-14">
      <AuthAmbient />
      <div className="relative z-10 animate-fade-up" style={{ animationDelay: "40ms" }}>
        <BrandLockup to="/" size="xl" />
        <h1 className="mt-10 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
          {copy.heading}
        </h1>
        <p className="mt-3 text-lg text-ink-soft">{copy.lede}</p>
      </div>

      <form
        onSubmit={(event) => void submit(event)}
        className="relative z-10 animate-fade-up mt-10 space-y-5"
        style={{ animationDelay: "90ms" }}
      >
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          hint={mode === "register" ? "At least 8 characters." : undefined}
        />

        {alertMessage && (
          <p role="alert" className="flex items-baseline gap-1.5 text-sm text-vermilion">
            <span aria-hidden="true">—</span>
            {alertMessage}
          </p>
        )}

        <button
          type="submit"
          disabled={formBusy}
          className="w-full bg-ink px-4 py-2.5 font-mono text-sm uppercase tracking-[0.15em] text-paper transition-colors hover:bg-vermilion active:scale-[0.99] disabled:opacity-50"
        >
          {pending ? "Working…" : copy.action}
        </button>
      </form>

      {google.status !== "hidden" && (
        <div className="relative z-10 mt-8" data-testid="google-sign-in">
          <div className="flex items-center gap-3" aria-hidden="true">
            <span className="h-px flex-1 bg-rule" />
            <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
              or
            </span>
            <span className="h-px flex-1 bg-rule" />
          </div>
          <div
            data-testid="google-sign-in-slot"
            className={`relative mt-5 flex h-10 justify-center overflow-hidden${formBusy ? " pointer-events-none" : ""}`}
          >
            <div ref={google.containerRef} className="h-10 w-full max-w-[320px]" />
            {google.status === "loading" && (
              <div
                data-testid="google-sign-in-skeleton"
                className="pointer-events-none absolute inset-0 mx-auto h-10 max-w-[320px] border border-rule bg-paper"
                aria-hidden="true"
              />
            )}
          </div>
          {google.status === "loading" && (
            <p className="sr-only" aria-live="polite">
              Loading Google Sign-In…
            </p>
          )}
          {google.status === "submitting" && (
            <p className="sr-only" aria-live="polite">
              Signing in with Google…
            </p>
          )}
        </div>
      )}

      <p
        className="relative z-10 animate-fade-up mt-6 text-sm text-ink-soft"
        style={{ animationDelay: "130ms" }}
      >
        {copy.switchText}{" "}
        <Link to={copy.switchTo} className="text-vermilion underline underline-offset-2">
          {copy.switchLabel}
        </Link>
      </p>

      <Link
        to="/write"
        className="relative z-10 animate-fade-up mt-10 text-sm text-ink-faint underline underline-offset-2 hover:text-ink"
        style={{ animationDelay: "160ms" }}
      >
        Back to the editor
      </Link>
    </main>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  hint,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  hint?: string;
}) {
  return (
    <label className="group block">
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        {label}
      </span>
      <div className="relative mt-1">
        <input
          type={type}
          value={value}
          required
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
          className="w-full bg-transparent px-1 py-2 outline-none"
        />
        {/* Gạch chân trồi từ giữa ra khi focus, thay vì border đổi màu tức thì. */}
        <span className="absolute inset-x-0 bottom-0 h-px bg-rule" />
        <span className="absolute inset-x-0 bottom-0 h-px origin-center scale-x-0 bg-vermilion transition-transform duration-300 group-focus-within:scale-x-100" />
      </div>
      {hint && <span className="mt-1 block text-xs text-ink-faint">{hint}</span>}
    </label>
  );
}
