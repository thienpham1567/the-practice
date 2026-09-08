export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "the-practice-theme";

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

export function readStoredTheme(): Theme | null {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    return stored === "light" || stored === "dark" ? stored : null;
  } catch {
    return null;
  }
}

export function resolvedTheme(): Theme {
  return readStoredTheme() ?? (prefersDark() ? "dark" : "light");
}

export function paintTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function applyTheme(theme: Theme): void {
  paintTheme(theme);
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    /* Private mode still gets the painted paper. */
  }
}

export function toggleTheme(): Theme {
  const next = resolvedTheme() === "dark" ? "light" : "dark";
  applyTheme(next);
  return next;
}
