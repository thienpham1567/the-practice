import { useState } from "react";
import { applyTheme, resolvedTheme, toggleTheme, type Theme } from "./theme";

/**
 * Night desk / day paper. The icon names the paper you will get, not the one you have.
 * Hairline marks — not the brand rising-sun, so the lockup stays unique.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof document === "undefined") return "light";
    const painted = document.documentElement.dataset.theme;
    if (painted === "light" || painted === "dark") return painted;
    const next = resolvedTheme();
    applyTheme(next);
    return next;
  });

  const dark = theme === "dark";
  const label = dark ? "Day" : "Night";

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={dark}
      title={label}
      onClick={() => setTheme(toggleTheme())}
      className="inline-flex h-8 w-8 items-center justify-center text-ink-faint transition-colors hover:text-vermilion"
    >
      {dark ? <SunMark /> : <MoonMark />}
    </button>
  );
}

function MoonMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-[1.05rem] w-[1.05rem]"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15.15 3.85a8.25 8.25 0 1 0 5 13.85 6.85 6.85 0 0 1-5-13.85Z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SunMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-[1.05rem] w-[1.05rem]"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.35" stroke="currentColor" strokeWidth="1.35" />
      <path
        d="M12 3.4v1.7M12 18.9v1.7M4.7 12H3M21 12h-1.7M6.15 6.15l1.2 1.2M16.65 16.65l1.2 1.2M17.85 6.15l-1.2 1.2M7.35 16.65l-1.2 1.2"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="round"
      />
    </svg>
  );
}
