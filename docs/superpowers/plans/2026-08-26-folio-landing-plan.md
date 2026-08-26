# Folio Theme and Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Logged-out `/` becomes a Folio broadsheet for daily CEFR practice; guests still write at `/write`; logged-in chrome uses the same masthead language.

**Architecture:** Pure helpers (`homeView`, `folioDateline`, `afterAuthPath`) own routing and copy rules so they can be tested without Lexical. `HomeGate` switches splash / landing / editor. `Masthead` is the shared lockup + right slot. Landing is static (no API). Auth, drafts, and practice only swap chrome.

**Tech Stack:** React 18, React Router 7, Zustand auth store, Vitest + Testing Library (jsdom), Tailwind v4 tokens already in `apps/web/src/index.css`.

**Spec:** [../specs/2026-08-26-folio-landing-design.md](../specs/2026-08-26-folio-landing-design.md)

---

## File map

| File | Responsibility |
|---|---|
| Create: `apps/web/src/folio/folio-dateline.ts` | `Vol. 1 · {en-GB long date} · English writing` |
| Create: `apps/web/src/folio/home-view.ts` | `loading` → splash; ready+token → editor; ready+no token → landing |
| Create: `apps/web/src/folio/after-auth-path.ts` | stash → `/write`, else `/practice` |
| Create: `apps/web/src/folio/landing-copy.ts` | Static B1 email kicker, catalog instruction, prompt |
| Create: `apps/web/src/folio/SessionSplash.tsx` | Centered “One moment…” |
| Create: `apps/web/src/folio/Masthead.tsx` | Brand lockup left, `children` right, `border-b border-rule` |
| Create: `apps/web/src/folio/HomeGate.tsx` | `/` switch using `homeView` |
| Create: `apps/web/src/pages/LandingPage.tsx` | Broadsheet: masthead, headline, sample paper, CTAs |
| Modify: `apps/web/src/App.tsx` | `/` → `HomeGate`; `/write` → `EditorPage`; splash via `SessionSplash` |
| Modify: `apps/web/src/auth/AuthPage.tsx` | `afterAuthPath()`; back link `/write`; `Masthead` |
| Modify: `apps/web/src/pages/EditorPage.tsx` | Lockup `to={signedIn ? "/practice" : "/"}` |
| Modify: `apps/web/src/pages/DocumentsPage.tsx` | `Masthead` + h1 “Drafts” below |
| Modify: `apps/web/src/pages/PracticePage.tsx` | `Masthead` + h1 “Practice” below |

Do not change Lexical, highlights, practice API, band math, or `render.yaml`.

Tests live next to the unit they prove: `*.test.ts` / `*.test.tsx` under `apps/web/src/`.

Run web tests from repo root:

```bash
pnpm --filter @writing-helper/web exec vitest run src/folio/folio-dateline.test.ts
```

---

### Task 1: Folio dateline

**Files:**
- Create: `apps/web/src/folio/folio-dateline.ts`
- Test: `apps/web/src/folio/folio-dateline.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { folioDateline } from "./folio-dateline";

describe("folioDateline", () => {
  it("formats an en-GB newspaper line with Vol. 1", () => {
    expect(folioDateline(new Date(2026, 7, 26))).toBe(
      "Vol. 1 · 26 August 2026 · English writing",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web exec vitest run src/folio/folio-dateline.test.ts`

Expected: FAIL — cannot find module `./folio-dateline` (or `folioDateline` is not exported).

- [ ] **Step 3: Write minimal implementation**

```ts
export function folioDateline(date: Date): string {
  const day = date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return `Vol. 1 · ${day} · English writing`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @writing-helper/web exec vitest run src/folio/folio-dateline.test.ts`

Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/folio/folio-dateline.ts apps/web/src/folio/folio-dateline.test.ts
git commit -m "$(cat <<'EOF'
Add Folio newspaper dateline helper.

Landing masthead needs a stable en-GB line so the sheet reads like a dated paper, not a SaaS header.
EOF
)"
```

---

### Task 2: Home view (no landing flash)

**Files:**
- Create: `apps/web/src/folio/home-view.ts`
- Test: `apps/web/src/folio/home-view.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { homeView } from "./home-view";

describe("homeView", () => {
  it("stays on splash while the session is restoring", () => {
    expect(homeView("loading", null)).toBe("splash");
    expect(homeView("loading", "token")).toBe("splash");
  });

  it("shows landing only when ready and signed out", () => {
    expect(homeView("ready", null)).toBe("landing");
  });

  it("shows the editor when ready and signed in", () => {
    expect(homeView("ready", "token")).toBe("editor");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web exec vitest run src/folio/home-view.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
export type HomeView = "splash" | "landing" | "editor";

export function homeView(
  status: "loading" | "ready",
  accessToken: string | null,
): HomeView {
  if (status === "loading") return "splash";
  return accessToken ? "editor" : "landing";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @writing-helper/web exec vitest run src/folio/home-view.test.ts`

Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/folio/home-view.ts apps/web/src/folio/home-view.test.ts
git commit -m "$(cat <<'EOF'
Decide splash vs landing vs editor before paint.

Session restore must not flash the public broadsheet in front of a signed-in editor.
EOF
)"
```

---

### Task 3: Path after login or register

**Files:**
- Create: `apps/web/src/folio/after-auth-path.ts`
- Test: `apps/web/src/folio/after-auth-path.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { afterEach, describe, expect, it } from "vitest";
import { afterAuthPath } from "./after-auth-path";
import { stashDraft } from "../pages/draft-stash";

describe("afterAuthPath", () => {
  afterEach(() => {
    sessionStorage.clear();
  });

  it("sends a writer with a stashed draft back to /write", () => {
    stashDraft({
      title: "Untitled",
      content: { root: { children: [], direction: null, format: "", indent: 0, type: "root", version: 1 } },
    });
    expect(afterAuthPath()).toBe("/write");
  });

  it("sends everyone else to practice", () => {
    expect(afterAuthPath()).toBe("/practice");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web exec vitest run src/folio/after-auth-path.test.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```ts
import { hasStashedDraft } from "../pages/draft-stash";

export function afterAuthPath(): "/write" | "/practice" {
  return hasStashedDraft() ? "/write" : "/practice";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @writing-helper/web exec vitest run src/folio/after-auth-path.test.ts`

Expected: PASS (2 tests).

If `stashDraft` JSON fails the `SerializedEditorState` type, keep the object and use `as StashedDraft` in the test after importing the type from `../pages/draft-stash`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/folio/after-auth-path.ts apps/web/src/folio/after-auth-path.test.ts
git commit -m "$(cat <<'EOF'
Route post-auth to practice unless a draft is stashed.

Practice is the product home; /docs must not be the default after register.
EOF
)"
```

---

### Task 4: Masthead

**Files:**
- Create: `apps/web/src/folio/Masthead.tsx`
- Test: `apps/web/src/folio/Masthead.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { Masthead } from "./Masthead";

describe("Masthead", () => {
  it("puts the brand on the left and the slot on the right", () => {
    render(
      <MemoryRouter>
        <Masthead>
          <span>Vol. 1</span>
        </Masthead>
      </MemoryRouter>,
    );
    expect(screen.getByText("The Practice")).toBeTruthy();
    expect(screen.getByText("Vol. 1")).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web exec vitest run src/folio/Masthead.test.tsx`

Expected: FAIL — module not found.

- [ ] **Step 3: Write minimal implementation**

```tsx
import type { ReactNode } from "react";
import { BrandLockup } from "../BrandLockup";

export function Masthead({
  children,
  lockupTo,
}: {
  children?: ReactNode;
  lockupTo?: string;
}) {
  return (
    <header className="flex items-baseline justify-between gap-4 border-b border-rule pb-5">
      <BrandLockup to={lockupTo} />
      {children}
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @writing-helper/web exec vitest run src/folio/Masthead.test.tsx`

Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/folio/Masthead.tsx apps/web/src/folio/Masthead.test.tsx
git commit -m "$(cat <<'EOF'
Add a shared Folio masthead.

Landing and list pages need one lockup-plus-slot chrome instead of ad-hoc h1 marks.
EOF
)"
```

---

### Task 5: Landing copy and page

**Files:**
- Create: `apps/web/src/folio/landing-copy.ts`
- Create: `apps/web/src/pages/LandingPage.tsx`
- Test: `apps/web/src/pages/LandingPage.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { LandingPage } from "./LandingPage";

describe("LandingPage", () => {
  it("is a broadsheet with practice as the primary action", () => {
    render(
      <MemoryRouter>
        <LandingPage now={new Date(2026, 7, 26)} />
      </MemoryRouter>,
    );

    expect(screen.getByText("Sit the next paper.")).toBeTruthy();
    expect(screen.getByText("Vol. 1 · 26 August 2026 · English writing")).toBeTruthy();
    expect(screen.getByText("Paper · B1 · Email · 20 min · 80–120 words")).toBeTruthy();
    expect(
      screen.getByText("Write an email to a specific person for a given purpose."),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "Your friend is visiting your city next month. Write to them. Tell them what you can do together and suggest a place to meet.",
      ),
    ).toBeTruthy();

    expect(screen.getByRole("link", { name: "Sit a paper" }).getAttribute("href")).toBe(
      "/register",
    );
    expect(screen.getByRole("link", { name: "Open a draft" }).getAttribute("href")).toBe(
      "/write",
    );
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web exec vitest run src/pages/LandingPage.test.tsx`

Expected: FAIL — cannot find `LandingPage`.

- [ ] **Step 3: Write copy + page**

`apps/web/src/folio/landing-copy.ts`:

```ts
import { TASK_CATALOG } from "@writing-helper/practice";

const email = TASK_CATALOG.find((task) => task.type === "email");
if (!email) throw new Error("TASK_CATALOG is missing email");

export const LANDING_HEADLINE = "Sit the next paper.";
export const LANDING_LEDE =
  "Daily CEFR writing, marked like an examiner.";

export const LANDING_PAPER = {
  kicker: "Paper · B1 · Email · 20 min · 80–120 words",
  instruction: email.instruction,
  prompt:
    "Your friend is visiting your city next month. Write to them. Tell them what you can do together and suggest a place to meet.",
} as const;
```

`apps/web/src/pages/LandingPage.tsx`:

```tsx
import { Link } from "react-router-dom";
import { AppMark } from "../AppMark";
import { folioDateline } from "../folio/folio-dateline";
import { LANDING_HEADLINE, LANDING_LEDE, LANDING_PAPER } from "../folio/landing-copy";
import { Masthead } from "../folio/Masthead";

export function LandingPage({ now = new Date() }: { now?: Date }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <div className="animate-fade-up">
        <Masthead>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
            {folioDateline(now)}
          </p>
        </Masthead>
      </div>

      <h1
        className="animate-fade-up mt-10 font-display text-4xl font-semibold tracking-tight sm:text-5xl"
        style={{ animationDelay: "40ms" }}
      >
        {LANDING_HEADLINE}
      </h1>
      <p className="animate-fade-up mt-3 max-w-xl text-lg text-ink-soft" style={{ animationDelay: "70ms" }}>
        {LANDING_LEDE}
      </p>

      <article
        className="animate-fade-up relative mt-12 border border-rule px-8 py-10"
        style={{ animationDelay: "110ms" }}
      >
        <AppMark className="pointer-events-none absolute -right-3 -top-3 h-14 w-14 -rotate-6 text-vermilion" />
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          {LANDING_PAPER.kicker}
        </p>
        <p className="mt-4 text-ink-soft">{LANDING_PAPER.instruction}</p>
        <p className="mt-4 font-display text-xl leading-snug">{LANDING_PAPER.prompt}</p>
      </article>

      <div
        className="animate-fade-up mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-3"
        style={{ animationDelay: "150ms" }}
      >
        <Link
          to="/register"
          className="bg-ink px-5 py-2 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-vermilion"
        >
          Sit a paper
        </Link>
        <Link
          to="/write"
          className="text-vermilion decoration-vermilion/40 underline-offset-4 hover:underline"
        >
          Open a draft
        </Link>
      </div>
      <p className="animate-fade-up mt-6 text-sm text-ink-soft" style={{ animationDelay: "180ms" }}>
        Already have an account?{" "}
        <Link to="/login" className="text-vermilion underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </main>
  );
}
```

Do not add extra sections, screenshots, or a second sample paper.

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @writing-helper/web exec vitest run src/pages/LandingPage.test.tsx`

Expected: PASS (1 test). If `getByRole("link", { name: "Sign in" })` clashes, use `getByRole("link", { name: /^Sign in$/ })`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/folio/landing-copy.ts apps/web/src/pages/LandingPage.tsx apps/web/src/pages/LandingPage.test.tsx
git commit -m "$(cat <<'EOF'
Add the logged-out Folio broadsheet.

A static B1 email paper sells daily practice without calling the API or blocking the free editor.
EOF
)"
```

---

### Task 6: Wire `/` and `/write`

**Files:**
- Create: `apps/web/src/folio/SessionSplash.tsx`
- Create: `apps/web/src/folio/HomeGate.tsx`
- Modify: `apps/web/src/App.tsx`
- Test: `apps/web/src/folio/HomeGate.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../api/auth-store";
import { HomeGate } from "./HomeGate";

describe("HomeGate", () => {
  afterEach(() => {
    useAuthStore.setState({ accessToken: null, user: null, status: "loading" });
  });

  it("shows One moment while restoring", () => {
    useAuthStore.setState({ status: "loading", accessToken: null, user: null });
    render(
      <MemoryRouter>
        <HomeGate />
      </MemoryRouter>,
    );
    expect(screen.getByText("One moment…")).toBeTruthy();
    expect(screen.queryByText("Sit the next paper.")).toBeNull();
  });

  it("shows the landing when ready and signed out", () => {
    useAuthStore.setState({ status: "ready", accessToken: null, user: null });
    render(
      <MemoryRouter>
        <HomeGate />
      </MemoryRouter>,
    );
    expect(screen.getByText("Sit the next paper.")).toBeTruthy();
  });
});
```

Do not render the signed-in branch in this file — `EditorPage` pulls Lexical and React Query.

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web exec vitest run src/folio/HomeGate.test.tsx`

Expected: FAIL — `HomeGate` not found.

- [ ] **Step 3: Implement splash, gate, and routes**

`SessionSplash.tsx`:

```tsx
export function SessionSplash() {
  return (
    <main className="flex h-screen items-center justify-center">
      <p className="text-ink-faint">One moment…</p>
    </main>
  );
}
```

`HomeGate.tsx`:

```tsx
import { useAuthStore } from "../api/auth-store";
import { EditorPage } from "../pages/EditorPage";
import { LandingPage } from "../pages/LandingPage";
import { homeView } from "./home-view";
import { SessionSplash } from "./SessionSplash";

export function HomeGate() {
  const status = useAuthStore((state) => state.status);
  const accessToken = useAuthStore((state) => state.accessToken);
  const view = homeView(status, accessToken);

  if (view === "splash") return <SessionSplash />;
  if (view === "landing") return <LandingPage />;
  return <EditorPage />;
}
```

In `App.tsx`:

- Import `HomeGate`, `SessionSplash`.
- Replace the loading JSX inside `RequireAuth` with `<SessionSplash />`.
- Replace `<Route path="/" element={<EditorPage />} />` with `<Route path="/" element={<HomeGate />} />`.
- Add `<Route path="/write" element={<EditorPage />} />` immediately after `/`.

Keep `/doc/:id`, auth, practice, docs, and `*` as they are.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @writing-helper/web exec vitest run src/folio/HomeGate.test.tsx src/folio/home-view.test.ts src/pages/LandingPage.test.tsx`

Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/folio/SessionSplash.tsx apps/web/src/folio/HomeGate.tsx apps/web/src/folio/HomeGate.test.tsx apps/web/src/App.tsx
git commit -m "$(cat <<'EOF'
Gate / on session: landing for guests, editor when signed in.

Guests write at /write so the broadsheet can own the public home without killing the free desk.
EOF
)"
```

---

### Task 7: Auth redirects and editor lockup

**Files:**
- Modify: `apps/web/src/auth/AuthPage.tsx`
- Modify: `apps/web/src/pages/EditorPage.tsx`

- [ ] **Step 1: Write a failing test for after-auth wiring**

There is no AuthPage test file yet. Add `apps/web/src/auth/AuthPage.redirect.test.ts` that only asserts the helper still matches the spec (already covered in Task 3). Skip a second helper test.

Instead, change AuthPage and EditorPage in this task and cover AuthPage links with a shallow render:

Create `apps/web/src/auth/AuthPage.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import { AuthPage } from "./AuthPage";

describe("AuthPage", () => {
  it("sends Back to the editor to /write", () => {
    render(
      <MemoryRouter>
        <AuthPage mode="login" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Back to the editor" }).getAttribute("href")).toBe(
      "/write",
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web exec vitest run src/auth/AuthPage.test.tsx`

Expected: FAIL — href is `/` (current code).

- [ ] **Step 3: Patch AuthPage and EditorPage**

In `AuthPage.tsx`:

- Import `afterAuthPath` from `../folio/after-auth-path` and `Masthead` from `../folio/Masthead`.
- Replace `void navigate(hasStashedDraft() ? "/" : "/docs");` with `void navigate(afterAuthPath());`.
- Remove the unused `hasStashedDraft` import.
- Replace the lockup block (keep the large faded `AppMark`) so the name sits in a masthead:

```tsx
<div className="animate-fade-up relative" style={{ animationDelay: "40ms" }}>
  <AppMark className="pointer-events-none absolute -left-4 -top-16 h-28 w-28 text-rule select-none" />
  <Masthead />
  <h1 className="relative mt-6 font-display text-4xl font-semibold">{copy.heading}</h1>
  <p className="relative mt-2 text-ink-soft">{copy.lede}</p>
</div>
```

- Change the back `Link` `to="/"` to `to="/write"`.
- Remove the unused `BrandLockup` import if `Masthead` replaces it.

In `EditorPage.tsx`, replace `<BrandLockup to="/docs" />` with:

```tsx
<BrandLockup to={signedIn ? "/practice" : "/"} />
```

`signedIn` is already in that component.

- [ ] **Step 4: Run tests**

Run: `pnpm --filter @writing-helper/web exec vitest run src/auth/AuthPage.test.tsx src/folio/after-auth-path.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/auth/AuthPage.tsx apps/web/src/auth/AuthPage.test.tsx apps/web/src/pages/EditorPage.tsx
git commit -m "$(cat <<'EOF'
Point auth and the editor lockup at Folio routes.

Guests return to /write instead of the landing; signed-in writers land on practice after login.
EOF
)"
```

---

### Task 8: Masthead on Drafts and Practice

**Files:**
- Modify: `apps/web/src/pages/DocumentsPage.tsx`
- Modify: `apps/web/src/pages/PracticePage.tsx`

No new behaviour — same links, same queries. Do not add a component test that mounts React Query against the API.

- [ ] **Step 1: Confirm current headers**

`DocumentsPage` and `PracticePage` still use `<h1>` with `AppMark` plus a sibling nav. After this task the brand is in `Masthead` and the section name is an `h1` under it.

- [ ] **Step 2: There is no useful failing unit test** — skip red/green here; verify with typecheck + existing `pnpm --filter @writing-helper/web test`.

- [ ] **Step 3: Replace the headers**

`DocumentsPage.tsx` — remove `AppMark` import; add `Masthead`. Replace the `<header>…</header>` block with:

```tsx
<Masthead lockupTo="/practice">
  <div className="flex items-center gap-4 text-sm">
    <Link
      to="/"
      className="text-vermilion decoration-vermilion/40 underline-offset-4 hover:underline"
    >
      New draft
    </Link>
    <Link
      to="/practice"
      className="text-ink-faint decoration-vermilion/40 underline-offset-4 hover:text-vermilion hover:underline"
    >
      Practice
    </Link>
    {user && (
      <button
        type="button"
        onClick={() => void signOut()}
        className="text-ink-faint hover:text-vermilion"
      >
        Sign out
      </button>
    )}
  </div>
</Masthead>
<h1 className="animate-fade-up mt-8 font-display text-3xl font-semibold">Drafts</h1>
```

Keep `className="animate-fade-up"` on the outer `<main>`. Empty-state `¶` and `to="/"` stay.

`PracticePage.tsx` — same pattern: `Masthead lockupTo="/practice"` with Drafts + Sign out links (copy the existing link classes). Then:

```tsx
<h1 className="animate-fade-up mt-8 font-display text-3xl font-semibold">Practice</h1>
```

Keep level picker, **Start writing**, streak, chart, papers list unchanged.

- [ ] **Step 4: Typecheck and full web tests**

Run:

```bash
pnpm --filter @writing-helper/web typecheck
pnpm --filter @writing-helper/web test
```

Expected: `tsc` exit 0; Vitest all green (folio + landing + auth + existing editor/practice unit tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/DocumentsPage.tsx apps/web/src/pages/PracticePage.tsx
git commit -m "$(cat <<'EOF'
Put Drafts and Practice on the Folio masthead.

Section titles sit under the brand so list pages match the landing sheet, not a one-off h1 mark.
EOF
)"
```

---

### Task 9: Browser verification

**Files:** none (manual). Dev servers: `pnpm --filter @writing-helper/web dev` (5173) and API if login is needed.

- [ ] **Step 1: Logged out**

1. Clear site data or use a private window. Open `http://localhost:5173/`.
2. Confirm broadsheet: masthead, *Sit the next paper.*, B1 email paper, **Sit a paper**, **Open a draft**, Sign in.
3. Confirm the network tab does not call `/practice` or `/documents`.
4. **Sit a paper** → `/register`. **Open a draft** → `/write` with the editor (“Write something worth editing.”). Auth “Back to the editor” → `/write`, not the landing.
5. Resize to a phone width: sheet stacks; CTAs wrap; stamp does not cover the prompt.

- [ ] **Step 2: Session restore**

Sign in, reload `/`. Must see the editor, not a flash of the landing headline.

- [ ] **Step 3: After register / login without stash**

New account (or login with empty sessionStorage): lands on `/practice`. Sign out → landing at `/`.

- [ ] **Step 4: Regression**

Drafts list/empty, start a paper, exam header still Submit + clock. Do not change highlights or band stamps.

If anything fails, fix in a new commit on the same branch — do not silently skip.

- [ ] **Step 5: Commit only if you fixed verification bugs**

No commit if the browser pass is clean.

---

## Self-review

| Spec section | Task |
|---|---|
| Folio tokens / no new palette | Tasks 4–5, 8 (classes only) |
| Masthead | Task 4, 5, 8 |
| Sheet `max-w-3xl` | Landing, drafts, practice already / landing new |
| Ink vs vermilion actions | Task 5 CTAs; existing buttons untouched |
| AppMark vs grade stamps | Landing stamp on the sample paper only |
| `/` splash / landing / editor | Tasks 2, 6 |
| `/write` | Task 6 |
| Sit a paper / Open a draft / Sign in | Task 5 |
| after-auth `/practice` or `/write` | Tasks 3, 7 |
| Auth back `/write` | Task 7 |
| Editor lockup guest `/`, signed-in `/practice` | Task 7 |
| Drafts New draft stays `/` | Task 8 |
| Static B1 copy | Task 5 `landing-copy.ts` |
| No API on landing | Task 5–6 |
| Tests listed in spec §6 | Tasks 1–7 unit; Task 9 browser |

No TBD. `HomeGate` signed-in branch is proven by `homeView`, not by mounting Lexical.
