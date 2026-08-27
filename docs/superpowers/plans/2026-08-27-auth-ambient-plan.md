# Auth Ambient Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a medium-intensity, CSS/SVG editorial ambient background (ink wash + ruled paper + sparse marks) behind the login and register forms.

**Architecture:** A presentational `AuthAmbient` component renders three decorative layers behind `AuthPage` content. Motion is pure CSS keyframes in `index.css`, gated by `prefers-reduced-motion`. No new libraries; no changes to auth logic or form layout.

**Tech Stack:** React + Vite (`apps/web`), Tailwind v4 tokens already in `@theme`, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-08-27-auth-ambient-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| Create `apps/web/src/auth/AuthAmbient.tsx` | Three decorative layers; `aria-hidden`; no pointer events |
| Create `apps/web/src/auth/AuthAmbient.test.tsx` | Presence, a11y attrs, reduced-motion class hook if any |
| Modify `apps/web/src/auth/AuthPage.tsx` | Wrap page so ambient sits behind form |
| Modify `apps/web/src/index.css` | Keyframes + utility classes for wash / rules / marks |
| Modify `apps/web/src/auth/AuthPage.test.tsx` | Assert ambient is present on login/register |

---

### Task 1: AuthAmbient shell + tests

**Files:**
- Create: `apps/web/src/auth/AuthAmbient.tsx`
- Create: `apps/web/src/auth/AuthAmbient.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AuthAmbient } from "./AuthAmbient";

describe("AuthAmbient", () => {
  it("is aria-hidden and does not capture pointer events", () => {
    const { container } = render(<AuthAmbient />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.getAttribute("aria-hidden")).toBe("true");
    expect(root.className).toMatch(/pointer-events-none/);
  });

  it("renders ink, rules, and marks layers", () => {
    const { container } = render(<AuthAmbient />);
    expect(container.querySelector("[data-ambient='ink']")).toBeTruthy();
    expect(container.querySelector("[data-ambient='rules']")).toBeTruthy();
    expect(container.querySelector("[data-ambient='marks']")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web exec vitest run src/auth/AuthAmbient.test.tsx`  
Expected: FAIL (module not found)

- [ ] **Step 3: Write minimal AuthAmbient**

```tsx
/** Decorative editorial backdrop for AuthPage. Purely visual. */
export function AuthAmbient() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div data-ambient="ink" className="auth-ambient-ink absolute inset-0" />
      <div data-ambient="rules" className="auth-ambient-rules absolute inset-0" />
      <div data-ambient="marks" className="auth-ambient-marks absolute inset-0">
        <span className="auth-ambient-mark auth-ambient-mark--pilcrow">¶</span>
        <span className="auth-ambient-mark auth-ambient-mark--dash">—</span>
        <span className="auth-ambient-mark auth-ambient-mark--stamp" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `pnpm --filter @writing-helper/web exec vitest run src/auth/AuthAmbient.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/auth/AuthAmbient.tsx apps/web/src/auth/AuthAmbient.test.tsx
git commit -m "Add AuthAmbient shell for the login backdrop."
```

---

### Task 2: CSS motion layers

**Files:**
- Modify: `apps/web/src/index.css`

- [ ] **Step 1: Add keyframes and classes after existing `@keyframes stamp-in` block**

Requirements to encode in CSS (exact values may be tuned for “medium” intensity):

1. `.auth-ambient-ink` — 2–3 layered `radial-gradient` blobs using `var(--color-ink)` / `var(--color-vermilion)` at very low alpha; animate with `auth-ink-drift` ~28s ease-in-out infinite alternate (transform translate + slight scale).
2. `.auth-ambient-rules` — repeating linear-gradient horizontal lines (`var(--color-rule)`) plus a thin vermilion left margin (~12% from left on desktop, ~1.5rem on mobile); animate `auth-rules-drift` ~40s linear infinite on `background-position-y` only.
3. `.auth-ambient-mark` — positioned absolutely at three corners/edges (not over the form center); `font-display` or mono; color `var(--color-ink-faint)` / soft vermilion; opacity ~0.18–0.28; animate `auth-mark-float` ~12–18s ease-in-out infinite alternate with different delays per modifier.
4. `.auth-ambient-mark--stamp` — empty box with double border vermilion, ~3rem, rotated −2deg (echo BandStamp), no text required.
5. Inside `@media (prefers-reduced-motion: reduce)`: set `animation: none` on `.auth-ambient-ink`, `.auth-ambient-rules`, `.auth-ambient-mark`.

Also register optional Tailwind animate tokens only if needed; otherwise plain CSS classes are fine.

- [ ] **Step 2: Visual check locally** (optional mid-task) — open `/login` after Task 3 wires it; for this task alone, classes exist unused.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/index.css
git commit -m "Animate auth ambient ink, rules, and marks."
```

---

### Task 3: Wire into AuthPage

**Files:**
- Modify: `apps/web/src/auth/AuthPage.tsx`
- Modify: `apps/web/src/auth/AuthPage.test.tsx`

- [ ] **Step 1: Extend AuthPage test**

In the existing “opens as a Folio title page…” test (or a new one), assert:

```tsx
expect(document.querySelector("[data-ambient='ink']")).toBeTruthy();
```

Render both `login` and `register` modes at least once with ambient present.

- [ ] **Step 2: Run test — expect FAIL** (ambient not in page yet)

- [ ] **Step 3: Wire AuthPage**

Change the outer structure to:

```tsx
return (
  <main className="relative mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-14">
    <AuthAmbient />
    <div className="relative z-10 animate-fade-up" style={{ animationDelay: "40ms" }}>
      {/* brand + heading unchanged */}
    </div>
    {/* form and links also get relative z-10 so they sit above ambient */}
    ...
  </main>
);
```

Import `AuthAmbient` from `./AuthAmbient`. Keep all form behavior identical. Ensure every interactive block has `relative z-10` (or one wrapper) so text stays sharp above washes.

- [ ] **Step 4: Run AuthPage + AuthAmbient tests — expect PASS**

Run: `pnpm --filter @writing-helper/web exec vitest run src/auth/AuthPage.test.tsx src/auth/AuthAmbient.test.tsx`

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/auth/AuthPage.tsx apps/web/src/auth/AuthPage.test.tsx
git commit -m "Place AuthAmbient behind login and register forms."
```

---

### Task 4: Browser smoke + full web suite

**Files:** none required unless tuning CSS

- [ ] **Step 1: Run full web tests**

Run: `pnpm --filter @writing-helper/web test`  
Expected: all PASS

- [ ] **Step 2: Browser check**

With `pnpm --filter @writing-helper/web dev` (+ API if needed):

| Check | Expected |
|-------|----------|
| `/login` desktop | Medium ambient; form readable; Sign in clickable |
| `/register` | Same ambient |
| 375px width | No horizontal overflow; marks not covering inputs |
| OS reduced-motion | No drift (static ink/rules ok) |

- [ ] **Step 3: Tune CSS only if intensity is wrong** (still “medium”, editorial). Commit if changed:

```bash
git commit -m "Tune auth ambient intensity for readability."
```

- [ ] **Step 4: Done — hand off to finishing-a-development-branch**

---

## Spec coverage

| Spec item | Task |
|-----------|------|
| Mix ink + rules + marks | 1–2 |
| Medium intensity | 2 (+4 tune) |
| CSS/SVG only, no new lib | 1–2 |
| Login + register | 3 |
| aria-hidden, pointer-events none | 1 |
| prefers-reduced-motion | 2 |
| Existing tokens only | 2 |
| Out of scope: landing/editor/WebGL | — not touched |

## Self-review notes

- No placeholders; component API is `AuthAmbient` with `data-ambient` hooks for tests.
- Login copy change (`Your papers and drafts are waiting.`) may still be unstaged on master — include in a separate commit if still dirty, not in ambient commits.
