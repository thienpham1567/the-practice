import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiJson, ApiError } from "../api/client";
import { useAuthStore, type SessionUser } from "../api/auth-store";
import { AppMark } from "../AppMark";
import { BrandLockup } from "../BrandLockup";
import { hasStashedDraft } from "../pages/draft-stash";

interface AuthPageProps {
  mode: "login" | "register";
}

const COPY = {
  login: {
    heading: "Welcome back",
    lede: "Sit the next paper, or pick up a draft.",
    action: "Sign in",
    path: "/auth/login",
    switchText: "No account yet?",
    switchLabel: "Create one",
    switchTo: "/register",
  },
  register: {
    heading: "Begin practice",
    lede: "An account keeps your papers and drafts.",
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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    try {
      const result = await apiJson<{ accessToken: string; user: SessionUser }>(
        copy.path,
        "POST",
        { email, password },
      );

      setSession(result.accessToken, result.user);
      // Nếu người dùng bị đưa tới đây giữa chừng lúc đang viết, trả họ về đúng
      // bản nháp đó thay vì danh sách.
      void navigate(hasStashedDraft() ? "/" : "/docs");
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="animate-fade-up relative" style={{ animationDelay: "40ms" }}>
        {/* Con dấu khổ lớn, mờ — neo theo khối tiêu đề, không theo cả trang. */}
        <AppMark className="pointer-events-none absolute -left-4 -top-16 h-28 w-28 text-rule select-none" />
        <BrandLockup size="lg" />
        <h1 className="relative mt-6 font-display text-4xl font-semibold">{copy.heading}</h1>
        <p className="relative mt-2 text-ink-soft">{copy.lede}</p>
      </div>

      <form
        onSubmit={(event) => void submit(event)}
        className="animate-fade-up relative mt-8 space-y-5"
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

        {error && (
          <p role="alert" className="flex items-baseline gap-1.5 text-sm text-vermilion">
            <span aria-hidden="true">—</span>
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-ink px-4 py-2.5 font-mono text-sm uppercase tracking-[0.15em] text-paper transition-colors hover:bg-vermilion active:scale-[0.99] disabled:opacity-50"
        >
          {pending ? "Working…" : copy.action}
        </button>
      </form>

      <p
        className="animate-fade-up relative mt-6 text-sm text-ink-soft"
        style={{ animationDelay: "130ms" }}
      >
        {copy.switchText}{" "}
        <Link to={copy.switchTo} className="text-vermilion underline underline-offset-2">
          {copy.switchLabel}
        </Link>
      </p>

      <Link
        to="/"
        className="animate-fade-up relative mt-10 text-sm text-ink-faint underline underline-offset-2 hover:text-ink"
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
