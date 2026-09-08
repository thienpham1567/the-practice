import { useState } from "react";
import { applyTheme, resolvedTheme, toggleTheme, type Theme } from "./theme";

/**
 * Night desk / day paper. Label names the paper you will get, not the one you have.
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

  return (
    <button
      type="button"
      aria-pressed={dark}
      onClick={() => setTheme(toggleTheme())}
      className="text-ink-faint hover:text-vermilion"
    >
      {dark ? "Day" : "Night"}
    </button>
  );
}
