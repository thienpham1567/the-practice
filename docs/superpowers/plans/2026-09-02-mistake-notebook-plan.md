# Sổ lỗi tái diễn — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [../specs/2026-09-02-mistake-notebook-design.md](../specs/2026-09-02-mistake-notebook-design.md)

**Goal:** Đánh dấu từng lỗi ngôn ngữ cụ thể trên bài practice đã nộp (kèm câu sửa), và gộp lỗi qua các bài gốc thành hồ sơ "lỗi hay lặp" hiện ở `/progress` và nhắc lại trước khi viết.

**Architecture:** Bộ nhãn đóng 13 giá trị và hai hàm thuần (`summarizeMarks`, `focusCategories`) nằm ở `packages/practice`. Khi nộp bài, `submit()` chạy thêm một lời gọi OpenRouter **song song** với lời gọi chấm sẵn có, best-effort — model trích nguyên văn đoạn sai, server dò offset bằng `locateQuote` (primitive rút chung với speaking). Web tổng quát hoá painter Lexical sẵn có để vẽ được cả highlight văn phong lẫn gạch chân lỗi, hai lăng kính loại trừ nhau.

**Tech Stack:** pnpm workspaces, TypeScript, NestJS 11 + Prisma 7 (Postgres), React 18 + Vite + Lexical, Vitest (packages + web), Jest (api), Tailwind v4.

## Global Constraints

- `packages/analysis` **không được sửa một dòng nào**.
- `apps/api/src/practice/grade-prompt.ts` và `revision-grade-prompt.ts` **không được sửa**; test chấm điểm hiện có phải xanh mà không sửa file test.
- `locateMarks` của speaking đổi ruột nhưng **hành vi không đổi**: `apps/api/src/speaking/locate-marks.spec.ts` phải xanh mà không sửa một dòng nào.
- `apps/web/src/speaking/speaking-highlights.ts` **không đụng tới** — nó vẽ lên text node thuần, khác chất liệu với painter Lexical.
- `AiService` vẫn là cổng OpenRouter thuần: không thêm method nào biết về bóc lỗi. Prompt và schema nằm trong `PracticeModule`.
- `packages/practice` không import React, HTTP client, hay Prisma.
- Không tạo bảng thống kê — hồ sơ suy ra từ `PracticeAttempt.marks`.
- Bộ nhãn đóng, đúng 13 giá trị, theo thứ tự khai báo trong `MARK_CATEGORIES`.
- Nhãn và ghi chú bằng tiếng Anh. Repo có test chặn chuỗi tiếng Việt lọt vào UI (`apps/web/src/no-vietnamese-display.ts`).
- Sau mỗi task: chạy test liên quan, commit riêng.

---

### Task 1: Bộ nhãn lỗi trong `packages/practice`

**Files:**
- Modify: `packages/practice/src/types.ts` (append)
- Create: `packages/practice/src/mark-catalog.ts`
- Create: `packages/practice/src/mark-catalog.test.ts`
- Modify: `packages/practice/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: types `MarkSeverity`, `MarkCategory`, `WritingMark`, `AttemptMarkInput`, `MarkTally`, `MistakeProfile`; values `MARK_CATEGORIES: readonly MarkCategory[]`, `MARK_SEVERITY: Record<MarkCategory, MarkSeverity>`, `MARK_LABELS: Record<MarkCategory, string>`.

- [ ] **Step 1: Write the failing test**

Create `packages/practice/src/mark-catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { MARK_CATEGORIES, MARK_LABELS, MARK_SEVERITY } from "./mark-catalog";

describe("mark catalog", () => {
  it("holds exactly 13 categories with no duplicates", () => {
    expect(MARK_CATEGORIES).toHaveLength(13);
    expect(new Set(MARK_CATEGORIES).size).toBe(13);
  });

  it("gives every category a severity", () => {
    for (const category of MARK_CATEGORIES) {
      expect(MARK_SEVERITY[category]).toMatch(/^(error|refinement)$/);
    }
  });

  it("marks only word-choice and register as refinement", () => {
    const refinements = MARK_CATEGORIES.filter((c) => MARK_SEVERITY[c] === "refinement");
    expect(refinements).toEqual(["word-choice", "register"]);
  });

  it("gives every category a non-empty label", () => {
    for (const category of MARK_CATEGORIES) {
      expect(MARK_LABELS[category].length).toBeGreaterThan(0);
    }
  });

  it("puts article first so it wins ties in taxonomy order", () => {
    expect(MARK_CATEGORIES[0]).toBe("article");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/practice test`
Expected: FAIL — cannot resolve `./mark-catalog`.

- [ ] **Step 3: Add the types**

Append to `packages/practice/src/types.ts`:

```ts
export type MarkSeverity = "error" | "refinement";

export type MarkCategory =
  // "error" tier — objectively wrong
  | "article"
  | "verb-tense"
  | "subject-verb-agreement"
  | "noun-number"
  | "preposition"
  | "word-order"
  | "word-form"
  | "spelling"
  | "punctuation"
  | "sentence-structure"
  | "pronoun"
  // "refinement" tier — grammatical but not idiomatic
  | "word-choice"
  | "register";

/**
 * A marked mistake on a written attempt, located by character offset on
 * plainText. Same span shape as the speaking transcript's SpeakingMark.
 */
export interface WritingMark {
  /** inclusive */
  start: number;
  /** exclusive */
  end: number;
  category: MarkCategory;
  severity: MarkSeverity;
  correction: string;
  note: string;
}

/** Just enough of an attempt to build the recurring-mistake profile. */
export interface AttemptMarkInput {
  marks: WritingMark[];
  wordCount: number;
  submittedAt: Date;
}

export interface MarkTally {
  category: MarkCategory;
  count: number;
  /** null when there are too few attempts to read a direction. */
  trend: "down" | "flat" | "up" | null;
}

export interface MistakeProfile {
  tallies: MarkTally[];
  attemptsConsidered: number;
}
```

- [ ] **Step 4: Write the catalog**

Create `packages/practice/src/mark-catalog.ts`:

```ts
import type { MarkCategory, MarkSeverity } from "./types";

/**
 * The one source of the closed label set. Declaration order is also the
 * tie-break order: two categories with the same count keep this order, so it
 * must stay stable.
 */
export const MARK_CATEGORIES: readonly MarkCategory[] = [
  "article",
  "verb-tense",
  "subject-verb-agreement",
  "noun-number",
  "preposition",
  "word-order",
  "word-form",
  "spelling",
  "punctuation",
  "sentence-structure",
  "pronoun",
  "word-choice",
  "register",
];

/**
 * Severity belongs to the label, not to one occurrence of it — so it is
 * derived here rather than asked of the model, which would only invite
 * contradictions like `article` + `refinement`.
 */
export const MARK_SEVERITY: Record<MarkCategory, MarkSeverity> = {
  article: "error",
  "verb-tense": "error",
  "subject-verb-agreement": "error",
  "noun-number": "error",
  preposition: "error",
  "word-order": "error",
  "word-form": "error",
  spelling: "error",
  punctuation: "error",
  "sentence-structure": "error",
  pronoun: "error",
  "word-choice": "refinement",
  register: "refinement",
};

export const MARK_LABELS: Record<MarkCategory, string> = {
  article: "Articles",
  "verb-tense": "Verb tense",
  "subject-verb-agreement": "Subject-verb agreement",
  "noun-number": "Singular / plural",
  preposition: "Prepositions",
  "word-order": "Word order",
  "word-form": "Word form",
  spelling: "Spelling",
  punctuation: "Punctuation",
  "sentence-structure": "Sentence structure",
  pronoun: "Pronouns",
  "word-choice": "Word choice",
  register: "Register",
};
```

- [ ] **Step 5: Export from the package**

In `packages/practice/src/index.ts`, add the new type names to the existing `export type { ... } from "./types";` block — `AttemptMarkInput`, `MarkCategory`, `MarkSeverity`, `MarkTally`, `MistakeProfile`, `WritingMark` — and add a new export line beside the other value exports:

```ts
export { MARK_CATEGORIES, MARK_LABELS, MARK_SEVERITY } from "./mark-catalog";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @writing-helper/practice test`
Expected: PASS — 5 new tests plus every existing one.

- [ ] **Step 7: Commit**

```bash
git add packages/practice/src/types.ts packages/practice/src/mark-catalog.ts packages/practice/src/mark-catalog.test.ts packages/practice/src/index.ts
git commit -m "Add the closed mistake taxonomy to packages/practice"
```

---

### Task 2: `summarizeMarks`

**Files:**
- Create: `packages/practice/src/summarize-marks.ts`
- Create: `packages/practice/src/summarize-marks.test.ts`
- Modify: `packages/practice/src/index.ts`

**Interfaces:**
- Consumes: `MARK_CATEGORIES` (Task 1); types `AttemptMarkInput`, `MarkCategory`, `MarkTally`, `MistakeProfile`, `WritingMark`.
- Produces: `summarizeMarks(attempts: AttemptMarkInput[]): MistakeProfile`, `PROFILE_WINDOW = 10`, `MIN_OCCURRENCES = 2`, `MIN_ATTEMPTS_FOR_TREND = 4`.

- [ ] **Step 1: Write the failing test**

Create `packages/practice/src/summarize-marks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarizeMarks } from "./summarize-marks";
import type { AttemptMarkInput, MarkCategory, WritingMark } from "./types";

function mark(category: MarkCategory): WritingMark {
  return { start: 0, end: 1, category, severity: "error", correction: "x", note: "y" };
}

function attempt(day: number, categories: MarkCategory[], wordCount = 100): AttemptMarkInput {
  return {
    marks: categories.map(mark),
    wordCount,
    submittedAt: new Date(Date.UTC(2026, 0, day)),
  };
}

describe("summarizeMarks", () => {
  it("returns an empty profile for no attempts", () => {
    expect(summarizeMarks([])).toEqual({ tallies: [], attemptsConsidered: 0 });
  });

  it("drops categories seen only once", () => {
    const profile = summarizeMarks([attempt(1, ["article", "spelling"])]);
    expect(profile.tallies).toEqual([]);
    expect(profile.attemptsConsidered).toBe(1);
  });

  it("keeps categories seen at least twice, sorted by count", () => {
    const profile = summarizeMarks([
      attempt(1, ["article", "article", "spelling", "spelling", "spelling"]),
    ]);
    expect(profile.tallies.map((t) => [t.category, t.count])).toEqual([
      ["spelling", 3],
      ["article", 2],
    ]);
  });

  it("breaks count ties in taxonomy order", () => {
    // article is declared before spelling, so it must come first.
    const profile = summarizeMarks([
      attempt(1, ["spelling", "spelling", "article", "article"]),
    ]);
    expect(profile.tallies.map((t) => t.category)).toEqual(["article", "spelling"]);
  });

  it("keeps only the 10 most recent attempts", () => {
    const many = Array.from({ length: 12 }, (_, i) => attempt(i + 1, ["article", "article"]));
    const profile = summarizeMarks(many);
    expect(profile.attemptsConsidered).toBe(10);
    // Days 1 and 2 fall outside the window: 10 x 2 = 20, not 24.
    expect(profile.tallies[0]).toMatchObject({ category: "article", count: 20 });
  });

  it("sorts by submittedAt itself, so caller order does not matter", () => {
    const shuffled = [
      attempt(3, ["article", "article"]),
      attempt(1, ["spelling"]),
      attempt(2, ["spelling"]),
    ];
    const profile = summarizeMarks(shuffled);
    expect(profile.attemptsConsidered).toBe(3);
    expect(profile.tallies.map((t) => t.category)).toEqual(["article", "spelling"]);
  });

  it("leaves trend null below four attempts", () => {
    const profile = summarizeMarks([
      attempt(1, ["article", "article"]),
      attempt(2, ["article"]),
    ]);
    expect(profile.tallies[0]!.trend).toBeNull();
  });

  it("reports down when the recent half improves", () => {
    const profile = summarizeMarks([
      attempt(1, ["article", "article", "article", "article"]),
      attempt(2, ["article", "article", "article", "article"]),
      attempt(3, []),
      attempt(4, []),
    ]);
    expect(profile.tallies[0]).toMatchObject({ category: "article", count: 8, trend: "down" });
  });

  it("reports up when the recent half worsens", () => {
    const profile = summarizeMarks([
      attempt(1, []),
      attempt(2, []),
      attempt(3, ["article", "article", "article", "article"]),
      attempt(4, ["article", "article", "article", "article"]),
    ]);
    expect(profile.tallies[0]!.trend).toBe("up");
  });

  it("reports flat when the rate barely moves", () => {
    const profile = summarizeMarks([
      attempt(1, ["article", "article"]),
      attempt(2, ["article", "article"]),
      attempt(3, ["article", "article"]),
      attempt(4, ["article", "article"]),
    ]);
    expect(profile.tallies[0]!.trend).toBe("flat");
  });

  it("normalises by words, so longer papers are not read as regression", () => {
    // Same rate per 100 words in both halves; the recent papers are just longer.
    const profile = summarizeMarks([
      attempt(1, ["article", "article"], 100),
      attempt(2, ["article", "article"], 100),
      attempt(3, ["article", "article", "article", "article"], 200),
      attempt(4, ["article", "article", "article", "article"], 200),
    ]);
    expect(profile.tallies[0]!.trend).toBe("flat");
  });

  it("puts the middle paper in the recent half when the count is odd", () => {
    // 5 papers: older = days 1-2, recent = days 3-5. The clean day 3 lands in
    // the recent half, which is what makes this read as down.
    const profile = summarizeMarks([
      attempt(1, ["article", "article", "article"]),
      attempt(2, ["article", "article", "article"]),
      attempt(3, []),
      attempt(4, []),
      attempt(5, []),
    ]);
    expect(profile.tallies[0]!.trend).toBe("down");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/practice test summarize-marks`
Expected: FAIL — cannot resolve `./summarize-marks`.

- [ ] **Step 3: Write the implementation**

Create `packages/practice/src/summarize-marks.ts`:

```ts
import { MARK_CATEGORIES } from "./mark-catalog";
import type {
  AttemptMarkInput,
  MarkCategory,
  MarkTally,
  MistakeProfile,
} from "./types";

/** Recent papers considered — close enough to reflect the current level. */
export const PROFILE_WINDOW = 10;
/** One occurrence is an accident, not a pattern. */
export const MIN_OCCURRENCES = 2;
/** Below this, halving the window says nothing. */
export const MIN_ATTEMPTS_FOR_TREND = 4;

/** Thresholds differ so small wobble is not read as a direction. */
const IMPROVED_BELOW = 0.75;
const WORSENED_ABOVE = 1.33;

/**
 * Recurring-mistake profile, derived from graded papers — there is no tally
 * table. Sorts and windows its own input so callers carry no preconditions.
 */
export function summarizeMarks(attempts: AttemptMarkInput[]): MistakeProfile {
  const window = [...attempts]
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
    .slice(-PROFILE_WINDOW);

  if (window.length === 0) return { tallies: [], attemptsConsidered: 0 };

  const counts = new Map<MarkCategory, number>();
  for (const attempt of window) {
    for (const mark of attempt.marks) {
      counts.set(mark.category, (counts.get(mark.category) ?? 0) + 1);
    }
  }

  // Odd count: the middle paper belongs to the recent half, biasing toward now.
  const split = Math.floor(window.length / 2);
  const older = window.slice(0, split);
  const recent = window.slice(split);
  const canTrend = window.length >= MIN_ATTEMPTS_FOR_TREND;

  const tallies: MarkTally[] = [];
  for (const category of MARK_CATEGORIES) {
    const count = counts.get(category) ?? 0;
    if (count < MIN_OCCURRENCES) continue;
    tallies.push({
      category,
      count,
      trend: canTrend ? trendFor(category, older, recent) : null,
    });
  }

  // Stable sort: ties keep the taxonomy order this loop walked in.
  tallies.sort((a, b) => b.count - a.count);

  return { tallies, attemptsConsidered: window.length };
}

/** Mistakes per 100 words — unnormalised, a longer paper looks like decline. */
function ratePer100Words(category: MarkCategory, attempts: AttemptMarkInput[]): number {
  let marks = 0;
  let words = 0;

  for (const attempt of attempts) {
    marks += attempt.marks.filter((mark) => mark.category === category).length;
    words += attempt.wordCount;
  }

  return words === 0 ? 0 : (marks / words) * 100;
}

function trendFor(
  category: MarkCategory,
  older: AttemptMarkInput[],
  recent: AttemptMarkInput[],
): "down" | "flat" | "up" {
  const before = ratePer100Words(category, older);
  const after = ratePer100Words(category, recent);

  if (before === 0) return after === 0 ? "flat" : "up";
  if (after < before * IMPROVED_BELOW) return "down";
  if (after > before * WORSENED_ABOVE) return "up";
  return "flat";
}
```

- [ ] **Step 4: Export and run tests**

In `packages/practice/src/index.ts` add:

```ts
export {
  summarizeMarks,
  PROFILE_WINDOW,
  MIN_OCCURRENCES,
  MIN_ATTEMPTS_FOR_TREND,
} from "./summarize-marks";
```

Run: `pnpm --filter @writing-helper/practice test`
Expected: PASS — 12 new tests.

- [ ] **Step 5: Commit**

```bash
git add packages/practice/src/summarize-marks.ts packages/practice/src/summarize-marks.test.ts packages/practice/src/index.ts
git commit -m "Add summarizeMarks: recurring-mistake profile from recent papers"
```

---

### Task 3: `focusCategories`

**Files:**
- Create: `packages/practice/src/focus-categories.ts`
- Create: `packages/practice/src/focus-categories.test.ts`
- Modify: `packages/practice/src/index.ts`

**Interfaces:**
- Consumes: `MARK_CATEGORIES`, `MARK_SEVERITY` (Task 1); types `MarkCategory`, `WritingMark`.
- Produces: `focusCategories(marks: WritingMark[], limit?: number): MarkCategory[]`.

- [ ] **Step 1: Write the failing test**

Create `packages/practice/src/focus-categories.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { focusCategories } from "./focus-categories";
import type { MarkCategory, MarkSeverity, WritingMark } from "./types";

function mark(category: MarkCategory, severity: MarkSeverity = "error"): WritingMark {
  return { start: 0, end: 1, category, severity, correction: "x", note: "y" };
}

describe("focusCategories", () => {
  it("returns nothing for an empty list", () => {
    expect(focusCategories([])).toEqual([]);
  });

  it("returns the three most common categories, most common first", () => {
    const marks = [
      mark("spelling"), mark("spelling"), mark("spelling"),
      mark("article"), mark("article"),
      mark("preposition"),
      mark("pronoun"),
    ];
    // preposition and pronoun both appear once; preposition is earlier in the taxonomy.
    expect(focusCategories(marks)).toEqual(["spelling", "article", "preposition"]);
  });

  it("ignores the refinement tier", () => {
    const marks = [
      mark("word-choice", "refinement"), mark("word-choice", "refinement"),
      mark("word-choice", "refinement"), mark("register", "refinement"),
      mark("article"),
    ];
    expect(focusCategories(marks)).toEqual(["article"]);
  });

  it("breaks ties in taxonomy order", () => {
    expect(focusCategories([mark("spelling"), mark("article")])).toEqual([
      "article",
      "spelling",
    ]);
  });

  it("returns fewer than three when there are fewer categories", () => {
    expect(focusCategories([mark("article"), mark("article")])).toEqual(["article"]);
  });

  it("honours an explicit limit", () => {
    const marks = [mark("article"), mark("spelling"), mark("pronoun")];
    expect(focusCategories(marks, 2)).toEqual(["article", "spelling"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/practice test focus-categories`
Expected: FAIL — cannot resolve `./focus-categories`.

- [ ] **Step 3: Write the implementation**

Create `packages/practice/src/focus-categories.ts`:

```ts
import { MARK_CATEGORIES, MARK_SEVERITY } from "./mark-catalog";
import type { MarkCategory, WritingMark } from "./types";

/**
 * The few groups worth fixing first in one paper. "error" tier only: telling a
 * learner to polish word choice while their grammar is still wrong is the
 * wrong order.
 *
 * Deliberately unrelated to the recurring profile — the results screen is
 * about the paper just written, /progress is about the long-term trend.
 */
export function focusCategories(marks: WritingMark[], limit = 3): MarkCategory[] {
  const counts = new Map<MarkCategory, number>();

  for (const mark of marks) {
    if (MARK_SEVERITY[mark.category] !== "error") continue;
    counts.set(mark.category, (counts.get(mark.category) ?? 0) + 1);
  }

  return MARK_CATEGORIES.filter((category) => counts.has(category))
    .sort((a, b) => counts.get(b)! - counts.get(a)!)
    .slice(0, limit);
}
```

- [ ] **Step 4: Export and run tests**

In `packages/practice/src/index.ts` add:

```ts
export { focusCategories } from "./focus-categories";
```

Run: `pnpm --filter @writing-helper/practice test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/practice/src/focus-categories.ts packages/practice/src/focus-categories.test.ts packages/practice/src/index.ts
git commit -m "Add focusCategories: which mistakes to fix first in one paper"
```

---

### Task 4: `locateQuote` — primitive dùng chung với speaking

**Files:**
- Create: `apps/api/src/common/locate-quote.ts`
- Create: `apps/api/src/common/locate-quote.spec.ts`
- Modify: `apps/api/src/speaking/locate-marks.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `locateQuote(text: string, quote: string, occurrence?: number): { start: number; end: number } | null`.

**Ràng buộc:** `apps/api/src/speaking/locate-marks.spec.ts` phải xanh mà **không sửa một dòng nào**. `locateMarks` giữ nguyên chữ ký, kiểu trả về, và hành vi (bỏ quote rỗng, bỏ quote không tìm thấy, dùng lần xuất hiện đầu tiên).

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/common/locate-quote.spec.ts`:

```ts
import { locateQuote } from "./locate-quote";

describe("locateQuote", () => {
  const text = "the cat and the dog and the bird";

  it("finds the first occurrence by default", () => {
    expect(locateQuote(text, "the")).toEqual({ start: 0, end: 3 });
  });

  it("finds the nth occurrence when asked", () => {
    expect(locateQuote(text, "the", 2)).toEqual({ start: 12, end: 15 });
    expect(locateQuote(text, "the", 3)).toEqual({ start: 24, end: 27 });
  });

  it("returns null when the occurrence overshoots", () => {
    expect(locateQuote(text, "the", 4)).toBeNull();
  });

  it("returns null when the quote is absent", () => {
    expect(locateQuote(text, "elephant")).toBeNull();
  });

  it("returns null for an empty quote", () => {
    expect(locateQuote(text, "")).toBeNull();
  });

  it("returns null for a whitespace-only quote", () => {
    expect(locateQuote(text, "   ")).toBeNull();
  });

  it("returns null for a non-positive or non-integer occurrence", () => {
    expect(locateQuote(text, "the", 0)).toBeNull();
    expect(locateQuote(text, "the", -1)).toBeNull();
    expect(locateQuote(text, "the", 1.5)).toBeNull();
  });

  it("matches the quote verbatim, without trimming it first", () => {
    expect(locateQuote("a  b", " b")).toEqual({ start: 2, end: 4 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/common/locate-quote.spec.ts`
Expected: FAIL — cannot find module `./locate-quote`.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/common/locate-quote.ts`:

```ts
/**
 * Where a verbatim quote sits in a text.
 *
 * Models count characters badly, so every feature that marks spans has the
 * model quote the text and locates the quote here instead of trusting offsets
 * it produced. Speaking marks and writing marks both go through this.
 *
 * Returns null rather than throwing: a mark that cannot be placed is dropped,
 * never fatal.
 */
export function locateQuote(
  text: string,
  quote: string,
  occurrence = 1,
): { start: number; end: number } | null {
  if (quote.trim() === "") return null;
  if (!Number.isInteger(occurrence) || occurrence < 1) return null;

  let start = -1;
  for (let seen = 0; seen < occurrence; seen++) {
    start = text.indexOf(quote, start + 1);
    if (start === -1) return null;
  }

  return { start, end: start + quote.length };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/common/locate-quote.spec.ts`
Expected: PASS — 8 tests.

- [ ] **Step 5: Route speaking through the primitive**

Replace the body of `locateMarks` in `apps/api/src/speaking/locate-marks.ts` (keep the exported types and the doc comment above the function as they are), adding the import:

```ts
import { locateQuote } from "../common/locate-quote";
```

```ts
export function locateMarks(quotes: MarkQuote[], transcript: string): LocatedMark[] {
  const located: LocatedMark[] = [];

  for (const item of quotes) {
    // Speaking quotes the transcript loosely, so it trims before matching and
    // always takes the first occurrence.
    const found = locateQuote(transcript, item.quote.trim());
    if (!found) continue;

    located.push({
      start: found.start,
      end: found.end,
      kind: item.kind,
      note: item.note,
    });
  }

  return located;
}
```

- [ ] **Step 6: Verify speaking behaviour is unchanged**

Run: `cd apps/api && npx jest src/speaking/locate-marks.spec.ts`
Expected: PASS — all 5 existing tests, with the spec file untouched.

- [ ] **Step 7: Run the api unit suite**

Run: `cd apps/api && npx jest`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/common/locate-quote.ts apps/api/src/common/locate-quote.spec.ts apps/api/src/speaking/locate-marks.ts
git commit -m "Extract locateQuote so speaking and writing share one locator"
```

---

### Task 5: Cột `marks` trên `PracticeAttempt`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_practice_attempt_marks/migration.sql` (do `prisma migrate dev` sinh ra)

**Interfaces:**
- Consumes: nothing.
- Produces: `PracticeAttempt.marks` kiểu `Json?`, đọc ra là `WritingMark[] | null`.

- [ ] **Step 1: Add the column to the schema**

Trong `apps/api/prisma/schema.prisma`, model `PracticeAttempt`, thêm ngay dưới dòng `styleSnapshot Json?`:

```prisma
  /// WritingMark[] — null khi bóc lỗi thất bại; [] khi bài không có lỗi nào.
  marks Json?
```

- [ ] **Step 2: Make sure the dev database is up**

Run: `docker compose up -d postgres`
Expected: container `writing-helper-db` running.

- [ ] **Step 3: Generate and apply the migration**

Run: `cd apps/api && npx prisma migrate dev --name practice_attempt_marks`
Expected: a new migration directory, and "Your database is now in sync with your schema."

- [ ] **Step 4: Verify migration state is clean**

Run: `cd apps/api && npx prisma migrate status`
Expected: "Database schema is up to date!"

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "Add marks column to PracticeAttempt"
```

---

### Task 6: Prompt và schema bóc lỗi

**Files:**
- Create: `apps/api/src/practice/mark-prompt.ts`
- Create: `apps/api/src/practice/mark-prompt.spec.ts`

**Interfaces:**
- Consumes: `MARK_CATEGORIES`, types `MarkCategory`, `TaskSpec` from `@writing-helper/practice`; `JsonSchemaSpec` from `../ai/ai.service`.
- Produces: `RawWritingMark`, `ExtractMarksResult`, `EXTRACT_MARKS_SCHEMA`, `buildMarkPrompt(task: TaskSpec, essay: string): string`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/practice/mark-prompt.spec.ts`:

```ts
import { MARK_CATEGORIES, TASK_CATALOG } from "@writing-helper/practice";
import { EXTRACT_MARKS_SCHEMA, buildMarkPrompt } from "./mark-prompt";

const emailTask = TASK_CATALOG.find((task) => task.type === "email")!;

describe("buildMarkPrompt", () => {
  it("includes the essay", () => {
    expect(buildMarkPrompt(emailTask, "I very like it.")).toContain("I very like it.");
  });

  it("names the task type so register is judged in context", () => {
    expect(buildMarkPrompt(emailTask, "hello")).toContain(emailTask.label);
  });

  it("demands a verbatim quote", () => {
    expect(buildMarkPrompt(emailTask, "hello")).toContain("character for character");
  });

  it("keeps style out of scope so it does not fight the rule engine", () => {
    expect(buildMarkPrompt(emailTask, "hello")).toContain("Do not comment on style");
  });
});

describe("EXTRACT_MARKS_SCHEMA", () => {
  const item = (
    (EXTRACT_MARKS_SCHEMA.schema.properties as Record<string, any>).marks.items
  ) as Record<string, any>;

  it("locks category to the closed taxonomy", () => {
    expect(item.properties.category.enum).toEqual([...MARK_CATEGORIES]);
  });

  it("requires every field the resolver reads", () => {
    expect(item.required).toEqual([
      "quote",
      "occurrence",
      "category",
      "correction",
      "note",
    ]);
  });

  it("does not ask the model for severity", () => {
    expect(item.properties).not.toHaveProperty("severity");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/practice/mark-prompt.spec.ts`
Expected: FAIL — cannot find module `./mark-prompt`.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/practice/mark-prompt.ts`:

```ts
import { MARK_CATEGORIES } from "@writing-helper/practice";
import type { MarkCategory, TaskSpec } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";

/**
 * What the model returns. No `severity`: the tier belongs to the label, and is
 * derived in `resolveWritingMarks` rather than asked for and reconciled.
 */
export interface RawWritingMark {
  quote: string;
  occurrence: number;
  category: MarkCategory;
  correction: string;
  note: string;
}

export interface ExtractMarksResult {
  marks: RawWritingMark[];
}

export const EXTRACT_MARKS_SCHEMA: JsonSchemaSpec = {
  name: "practice_marks",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["marks"],
    properties: {
      marks: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["quote", "occurrence", "category", "correction", "note"],
          properties: {
            quote: { type: "string" },
            occurrence: { type: "integer", minimum: 1 },
            category: { type: "string", enum: [...MARK_CATEGORIES] },
            correction: { type: "string" },
            note: { type: "string" },
          },
        },
      },
    },
  },
};

export function buildMarkPrompt(task: TaskSpec, essay: string): string {
  return (
    `You mark language mistakes in English exam writing.\n\n` +
    `Task type: ${task.label}. Judge register against what that task type expects.\n\n` +
    `Writer's response:\n${essay}\n\n` +
    `List every mistake worth correcting. For each one:\n` +
    `- "quote": copy the exact substring from the response, character for character. ` +
    `Never paraphrase it and never fix it inside the quote. Keep it short — the ` +
    `smallest span that still contains the mistake.\n` +
    `- "occurrence": 1 if that substring appears once in the response; otherwise ` +
    `which occurrence you mean, counting from 1.\n` +
    `- "category": the closest label from the fixed list.\n` +
    `- "correction": the corrected version of the quoted span only.\n` +
    `- "note": one short sentence saying why, written for a learner.\n\n` +
    `Do not comment on style, sentence length, or word count — only language ` +
    `mistakes and unnatural word choice. Return an empty list if there are none.`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/practice/mark-prompt.spec.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/practice/mark-prompt.ts apps/api/src/practice/mark-prompt.spec.ts
git commit -m "Add the mistake-extraction prompt and JSON schema"
```

---

### Task 7: Phân giải mark của model thành offset

**Files:**
- Create: `apps/api/src/practice/resolve-marks.ts`
- Create: `apps/api/src/practice/resolve-marks.spec.ts`

**Interfaces:**
- Consumes: `locateQuote` (Task 4); `MARK_CATEGORIES`, `MARK_SEVERITY`, type `WritingMark` from `@writing-helper/practice`; `RawWritingMark` (Task 6).
- Produces: `resolveWritingMarks(plainText: string, raw: RawWritingMark[]): WritingMark[]` — sắp theo `start` tăng dần.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/practice/resolve-marks.spec.ts`:

```ts
import type { RawWritingMark } from "./mark-prompt";
import { resolveWritingMarks } from "./resolve-marks";

function raw(overrides: Partial<RawWritingMark> = {}): RawWritingMark {
  return {
    quote: "very like",
    occurrence: 1,
    category: "word-order",
    correction: "like ... very much",
    note: "Word order.",
    ...overrides,
  };
}

describe("resolveWritingMarks", () => {
  it("locates a quote and derives severity from the category", () => {
    expect(resolveWritingMarks("I very like it.", [raw()])).toEqual([
      {
        start: 2,
        end: 11,
        category: "word-order",
        severity: "error",
        correction: "like ... very much",
        note: "Word order.",
      },
    ]);
  });

  it("marks refinement categories as refinement", () => {
    const [resolved] = resolveWritingMarks("I made a big mistake.", [
      raw({ quote: "big", category: "word-choice" }),
    ]);
    expect(resolved!.severity).toBe("refinement");
  });

  it("honours occurrence for a repeated quote", () => {
    const [resolved] = resolveWritingMarks("the cat and the dog", [
      raw({ quote: "the", occurrence: 2, category: "article" }),
    ]);
    expect(resolved).toMatchObject({ start: 12, end: 15 });
  });

  it("drops a mark whose quote is absent", () => {
    expect(resolveWritingMarks("I like it.", [raw({ quote: "not in the essay" })])).toEqual([]);
  });

  it("drops a mark whose occurrence overshoots", () => {
    expect(
      resolveWritingMarks("the cat", [raw({ quote: "the", occurrence: 3, category: "article" })]),
    ).toEqual([]);
  });

  it("drops empty and whitespace-only quotes", () => {
    expect(resolveWritingMarks("I like it.", [raw({ quote: "" }), raw({ quote: "   " })])).toEqual(
      [],
    );
  });

  it("drops a category outside the taxonomy", () => {
    const bad = raw({ category: "vibes" as RawWritingMark["category"] });
    expect(resolveWritingMarks("I very like it.", [bad])).toEqual([]);
  });

  it("keeps the first of two marks on the same span", () => {
    const resolved = resolveWritingMarks("I very like it.", [
      raw({ note: "first" }),
      raw({ note: "second" }),
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.note).toBe("first");
  });

  it("sorts the result by start offset", () => {
    const resolved = resolveWritingMarks("the cat very like fish", [
      raw({ quote: "very like" }),
      raw({ quote: "the", category: "article" }),
    ]);
    expect(resolved.map((mark) => mark.start)).toEqual([0, 8]);
  });

  it("treats a missing occurrence as the first one", () => {
    const bad = { ...raw(), occurrence: undefined as unknown as number };
    expect(resolveWritingMarks("I very like it.", [bad])[0]).toMatchObject({ start: 2 });
  });

  it("returns an empty array for no raw marks", () => {
    expect(resolveWritingMarks("I like it.", [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/practice/resolve-marks.spec.ts`
Expected: FAIL — cannot find module `./resolve-marks`.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/practice/resolve-marks.ts`:

```ts
import { MARK_CATEGORIES, MARK_SEVERITY } from "@writing-helper/practice";
import type { WritingMark } from "@writing-helper/practice";
import { locateQuote } from "../common/locate-quote";
import type { RawWritingMark } from "./mark-prompt";

const KNOWN_CATEGORIES = new Set<string>(MARK_CATEGORIES);

/**
 * Turn the model's verbatim quotes into offsets on the submitted text.
 *
 * Every failure mode drops the one mark and keeps the rest: losing a single
 * underline beats failing the whole results screen over one bad item.
 */
export function resolveWritingMarks(
  plainText: string,
  raw: RawWritingMark[],
): WritingMark[] {
  const resolved: WritingMark[] = [];
  const takenSpans = new Set<string>();

  for (const item of raw) {
    if (!KNOWN_CATEGORIES.has(item.category)) continue;

    const found = locateQuote(plainText, item.quote ?? "", item.occurrence ?? 1);
    if (!found) continue;

    const span = `${found.start}:${found.end}`;
    if (takenSpans.has(span)) continue;
    takenSpans.add(span);

    resolved.push({
      start: found.start,
      end: found.end,
      category: item.category,
      severity: MARK_SEVERITY[item.category],
      correction: item.correction,
      note: item.note,
    });
  }

  return resolved.sort((a, b) => a.start - b.start);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/practice/resolve-marks.spec.ts`
Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/practice/resolve-marks.ts apps/api/src/practice/resolve-marks.spec.ts
git commit -m "Resolve model-quoted mistakes into character offsets"
```

---

### Task 8: `submit()` bóc lỗi song song với chấm điểm

**Files:**
- Modify: `apps/api/src/practice/practice.service.ts` (hàm `submit`)
- Modify: `apps/api/src/practice/practice.service.spec.ts` (bên trong `describe("submit")`)

**Interfaces:**
- Consumes: `buildMarkPrompt`, `EXTRACT_MARKS_SCHEMA`, `ExtractMarksResult` (Task 6); `resolveWritingMarks` (Task 7); cột `marks` (Task 5).
- Produces: `submit()` ghi thêm `marks`. Không đổi chữ ký public nào.

**Ghi chú về code sẵn có:** `submit()` chiếm khoá chấm bài (`gradingStartedAt`) trước khi gọi AI, rồi vào `try { ... } catch { nhả khoá; throw }`. Bên trong có hai nhánh chấm — revision dùng `buildRevisionGradePrompt`, gốc dùng `buildGradePrompt`. **Không đụng vào hai nhánh đó.** Helper test là `serviceWith({ attempt, updated, ... })` trả `{ service, prisma, complete }`; `graded` và `draft` đã có sẵn trong `describe("submit")`.

- [ ] **Step 1: Write the failing tests**

Thêm vào `apps/api/src/practice/practice.service.spec.ts`, bên trong `describe("submit", ...)`, sau test cuối cùng đang có:

```ts
    it("stores mistakes resolved from the model's quotes", async () => {
      const { service, prisma, complete } = serviceWith({ attempt: draft });
      // The marks call is started before the grade call, so it is mocked first.
      complete
        .mockResolvedValueOnce({
          marks: [
            {
              quote: "very like",
              occurrence: 1,
              category: "word-order",
              correction: "like it very much",
              note: "Word order.",
            },
          ],
        })
        .mockResolvedValueOnce(graded);

      await service.submit("user-1", "a1", {
        styleSnapshot: {},
        plainText: "I very like it.",
      });

      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            marks: [
              {
                start: 2,
                end: 11,
                category: "word-order",
                severity: "error",
                correction: "like it very much",
                note: "Word order.",
              },
            ],
          }),
        }),
      );
    });

    it("still saves the band when mistake extraction fails", async () => {
      const { service, prisma, complete } = serviceWith({ attempt: draft });
      complete
        .mockRejectedValueOnce(new Error("model returned junk"))
        .mockResolvedValueOnce(graded);

      await service.submit("user-1", "a1", {
        styleSnapshot: {},
        plainText: "I very like it.",
      });

      const { data } = prisma.practiceAttempt.update.mock.calls[0][0];
      expect(data.band).toBe(overallBand(graded.scores));
      expect(data.marks).toBeUndefined();
    });

    it("stores an empty list when the paper has no mistakes", async () => {
      const { service, prisma, complete } = serviceWith({ attempt: draft });
      complete.mockResolvedValueOnce({ marks: [] }).mockResolvedValueOnce(graded);

      await service.submit("user-1", "a1", {
        styleSnapshot: {},
        plainText: "Flawless.",
      });

      const { data } = prisma.practiceAttempt.update.mock.calls[0][0];
      expect(data.marks).toEqual([]);
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx jest src/practice/practice.service.spec.ts`
Expected: FAIL — `data.marks` is undefined in the first test.

- [ ] **Step 3: Start the marks call alongside grading**

Trong `apps/api/src/practice/practice.service.ts`, thêm imports:

```ts
import { EXTRACT_MARKS_SCHEMA, buildMarkPrompt, type ExtractMarksResult } from "./mark-prompt";
import { resolveWritingMarks } from "./resolve-marks";
```

Ngay sau dòng mở `try {` của `submit()` — tức **trước** `let graded: GradeResult | RevisionGradeResult;` — chèn:

```ts
      // Bóc lỗi chạy song song với chấm điểm. `.catch` gắn ngay tại đây nên
      // promise này không bao giờ reject: chấm điểm hỏng thì submit hỏng như
      // cũ, còn bóc lỗi hỏng thì người học vẫn có band, chỉ mất phần đánh dấu.
      const marksPromise = this.ai
        .complete<ExtractMarksResult>({
          prompt: buildMarkPrompt(task, plainText),
          schema: EXTRACT_MARKS_SCHEMA,
          maxTokens: 2000,
          timeoutMs: PRACTICE_TIMEOUT_MS,
          deadlineMs: PRACTICE_DEADLINE_MS,
          usage: { userId, endpoint: "practice.marks" },
        })
        .then((result) => resolveWritingMarks(plainText, result.marks ?? []))
        .catch((error: unknown) => {
          this.logger.warn(
            `event=practice_marks_failed attemptId=${id} ${error instanceof Error ? error.message : "unknown"}`,
          );
          return null;
        });
```

Giữ nguyên toàn bộ khối chấm điểm phía dưới. Sau đó, **trước** lời gọi `this.prisma.practiceAttempt.update`, thêm:

```ts
      const marks = await marksPromise;
```

và trong object `data` của lời gọi update đó, thêm ngay sau dòng `styleSnapshot:`:

```ts
          ...(marks !== null && { marks: marks as unknown as Prisma.InputJsonValue }),
```

Mảng rỗng vẫn được ghi (`[]`) để phân biệt "bài sạch lỗi" với "bóc lỗi hỏng" (`null`, không ghi gì).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/practice`
Expected: PASS — kể cả các test `submit` cũ.

- [ ] **Step 5: Run the whole api unit suite**

Run: `cd apps/api && npx jest`
Expected: PASS — không sửa file test chấm điểm hay speaking nào.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/practice/practice.service.ts apps/api/src/practice/practice.service.spec.ts
git commit -m "Extract mistakes alongside grading when a paper is submitted"
```

---

### Task 9: `GET /practice/mistakes`

**Files:**
- Create: `apps/api/src/practice/mistakes.service.ts`
- Create: `apps/api/src/practice/mistakes.service.spec.ts`
- Create: `apps/api/src/practice/mistakes.controller.ts`
- Modify: `apps/api/src/practice/practice.module.ts`
- Modify: `apps/api/test/app.e2e-spec.ts`

**Interfaces:**
- Consumes: `summarizeMarks`, `PROFILE_WINDOW`, types `MistakeProfile`, `WritingMark` from `@writing-helper/practice`; cột `marks` (Task 5).
- Produces: `MistakesService.profile(userId: string): Promise<MistakeProfile>`; route `GET /practice/mistakes`.

- [ ] **Step 1: Write the failing unit test**

Create `apps/api/src/practice/mistakes.service.spec.ts`:

```ts
import type { PrismaService } from "../prisma/prisma.service";
import { MistakesService } from "./mistakes.service";

function serviceWith(rows: unknown[]) {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = { practiceAttempt: { findMany } };
  return {
    service: new MistakesService(prisma as unknown as PrismaService),
    findMany,
  };
}

const mark = (category: string) => ({
  start: 0,
  end: 1,
  category,
  severity: "error",
  correction: "x",
  note: "y",
});

describe("MistakesService", () => {
  it("asks only for graded root attempts, newest first", async () => {
    const { service, findMany } = serviceWith([]);

    await service.profile("user-1");

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", submittedAt: { not: null }, parentAttemptId: null },
        orderBy: { submittedAt: "desc" },
        take: 10,
      }),
    );
  });

  it("summarises the marks it finds", async () => {
    const { service } = serviceWith([
      {
        marks: [mark("article"), mark("article")],
        wordCount: 100,
        submittedAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);

    const profile = await service.profile("user-1");

    expect(profile.attemptsConsidered).toBe(1);
    expect(profile.tallies).toEqual([{ category: "article", count: 2, trend: null }]);
  });

  it("skips rows whose marks are null because extraction failed", async () => {
    const { service } = serviceWith([
      { marks: null, wordCount: 100, submittedAt: new Date("2026-01-01T00:00:00Z") },
      {
        marks: [mark("article"), mark("article")],
        wordCount: 100,
        submittedAt: new Date("2026-01-02T00:00:00Z"),
      },
    ]);

    const profile = await service.profile("user-1");

    expect(profile.attemptsConsidered).toBe(1);
  });

  it("returns an empty profile when nothing is graded yet", async () => {
    const { service } = serviceWith([]);
    expect(await service.profile("user-1")).toEqual({ tallies: [], attemptsConsidered: 0 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/practice/mistakes.service.spec.ts`
Expected: FAIL — cannot find module `./mistakes.service`.

- [ ] **Step 3: Write the service**

Create `apps/api/src/practice/mistakes.service.ts`:

```ts
import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import {
  PROFILE_WINDOW,
  summarizeMarks,
  type MistakeProfile,
  type WritingMark,
} from "@writing-helper/practice";
import { PrismaService } from "../prisma/prisma.service";

const PROFILE_FIELDS = {
  marks: true,
  wordCount: true,
  submittedAt: true,
} satisfies Prisma.PracticeAttemptSelect;

@Injectable()
export class MistakesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Root attempts only (`parentAttemptId: null`): a revision starts from the
   * paper it revises, so counting both would double-count the same mistakes.
   * Same rule the progress page settled on.
   *
   * The profile is computed here rather than shipping every paper's marks to
   * the client — both consumers only need labels and counts.
   */
  async profile(userId: string): Promise<MistakeProfile> {
    const rows = await this.prisma.practiceAttempt.findMany({
      where: { userId, submittedAt: { not: null }, parentAttemptId: null },
      orderBy: { submittedAt: "desc" },
      take: PROFILE_WINDOW,
      select: PROFILE_FIELDS,
    });

    return summarizeMarks(
      rows
        .filter((row) => Array.isArray(row.marks))
        .map((row) => ({
          marks: row.marks as unknown as WritingMark[],
          wordCount: row.wordCount,
          submittedAt: row.submittedAt as Date,
        })),
    );
  }
}
```

- [ ] **Step 4: Write the controller**

Create `apps/api/src/practice/mistakes.controller.ts`:

```ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUserId } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { MistakesService } from "./mistakes.service";

@Controller("practice/mistakes")
@UseGuards(JwtAuthGuard)
export class MistakesController {
  constructor(private readonly mistakes: MistakesService) {}

  @Get()
  profile(@CurrentUserId() userId: string) {
    return this.mistakes.profile(userId);
  }
}
```

- [ ] **Step 5: Register both in the module**

Trong `apps/api/src/practice/practice.module.ts`, thêm imports và ghi tên vào hai mảng:

```ts
import { MistakesController } from "./mistakes.controller";
import { MistakesService } from "./mistakes.service";
```

```ts
  controllers: [PracticeController, ProgressController, VocabController, MistakesController],
  providers: [PracticeService, ProgressService, VocabService, MistakesService],
```

- [ ] **Step 6: Run the unit test**

Run: `cd apps/api && npx jest src/practice/mistakes.service.spec.ts`
Expected: PASS — 4 tests.

- [ ] **Step 7: Teach the e2e OpenRouter mock about the new schema**

`mockPracticeAi()` trong `apps/api/test/app.e2e-spec.ts` phân nhánh theo tên schema. Chưa có nhánh `practice_marks` thì lời gọi bóc lỗi nhận về object sinh đề và âm thầm ra mảng rỗng.

Thêm một fixture cạnh `graded` trong `describe("practice")`. Hai mark cùng nhãn `article` là cố ý — `MIN_OCCURRENCES` là 2, nên đây là dữ liệu tối thiểu để hồ sơ có gì để hiện:

```ts
    const extractedMarks = {
      marks: [
        {
          quote: "a school",
          occurrence: 1,
          category: "article",
          correction: "the school",
          note: "Use the definite article for a specific school.",
        },
        {
          quote: "a trip",
          occurrence: 1,
          category: "article",
          correction: "the trip",
          note: "The trip has already been mentioned.",
        },
      ],
    };
```

và đổi biểu thức `content` trong `mockPracticeAi` thành:

```ts
        const schemaName = body.response_format?.json_schema?.name;
        const content =
          schemaName === "practice_grade"
            ? JSON.stringify(graded)
            : schemaName === "practice_marks"
              ? JSON.stringify(extractedMarks)
              : JSON.stringify(generated);
```

Nếu `mockPracticeAi` đã có nhánh cho schema chấm revision, giữ nguyên nhánh đó và chỉ chèn thêm nhánh `practice_marks`.

- [ ] **Step 8: Write the failing e2e tests**

Thêm vào `describe("practice", ...)` trong `apps/api/test/app.e2e-spec.ts`, dùng đúng helper sẵn có của file (`server()`, `registerUser(email)` trả `{ accessToken }`, `mockPracticeAi()`):

```ts
    it("chặn hồ sơ lỗi khi chưa đăng nhập", async () => {
      await server().get("/practice/mistakes").expect(401);
    });

    it("trả hồ sơ rỗng khi chưa nộp bài nào", async () => {
      const { accessToken } = await registerUser("mistakes-empty@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const response = await server().get("/practice/mistakes").set(auth).expect(200);

      expect(response.body).toEqual({ tallies: [], attemptsConsidered: 0 });
    });

    it("đánh dấu lỗi khi nộp và gộp vào hồ sơ", async () => {
      mockPracticeAi();
      const { accessToken } = await registerUser("mistakes-profile@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const created = await server()
        .post("/practice/attempts")
        .set(auth)
        .send({ level: "A2", taskType: "email" })
        .expect(201);

      const submitted = await server()
        .post(`/practice/attempts/${created.body.id}/submit`)
        .set(auth)
        .send({
          styleSnapshot: {},
          plainText: "I went on a trip with a school group and it was memorable.",
          wordCount: 12,
        })
        .expect(201);

      expect(submitted.body.marks).toEqual([
        expect.objectContaining({ category: "article", severity: "error" }),
        expect.objectContaining({ category: "article", severity: "error" }),
      ]);

      const profile = await server().get("/practice/mistakes").set(auth).expect(200);

      expect(profile.body.attemptsConsidered).toBe(1);
      // Two marks reach MIN_OCCURRENCES; one paper is too few for a trend.
      expect(profile.body.tallies).toEqual([
        { category: "article", count: 2, trend: null },
      ]);
    });
```

- [ ] **Step 9: Run the e2e suite**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand`
Expected: PASS — toàn bộ e2e cũ vẫn xanh cộng 3 test mới.

- [ ] **Step 10: Commit**

```bash
git add apps/api/src/practice/mistakes.service.ts apps/api/src/practice/mistakes.service.spec.ts apps/api/src/practice/mistakes.controller.ts apps/api/src/practice/practice.module.ts apps/api/test/app.e2e-spec.ts
git commit -m "Serve the recurring-mistake profile at GET /practice/mistakes"
```

---

### Task 10: Tổng quát hoá painter và hit-test sang "span"

**Files:**
- Create: `apps/web/src/editor/spans.ts`
- Modify: `apps/web/src/editor/highlight-painter.ts`
- Modify: `apps/web/src/editor/highlight-hit.ts`
- Modify: `apps/web/src/editor/highlight-hit.test.ts`
- Modify: `apps/web/src/editor/plugins/AnalysisPlugin.tsx`
- Modify: `apps/web/src/editor/Editor.tsx`

**Interfaces:**
- Consumes: `Highlight`, `HighlightType` from `@writing-helper/analysis`; `MarkSeverity`, `WritingMark` from `@writing-helper/practice`.
- Produces: `SpanLayer`, `EditorSpan`, `styleSpans(highlights)`, `markSpans(marks)` from `./spans`; `paintSpans(index, spans)`, `clearSpans()` from `./highlight-painter`; `findSpanAtOffset<T extends {start,end}>(spans, offset)` from `./highlight-hit`.

**Ràng buộc:** `apps/web/src/speaking/speaking-highlights.ts` không đụng tới.

- [ ] **Step 1: Rewrite the hit test around the new name**

Thay toàn bộ `apps/web/src/editor/highlight-hit.test.ts` bằng:

```ts
import { describe, expect, it } from "vitest";
import type { Highlight } from "@writing-helper/analysis";
import { findSpanAtOffset } from "./highlight-hit";

const sentence: Highlight = { start: 0, end: 20, type: "hard-sentence" };
const adverb: Highlight = { start: 4, end: 11, type: "adverb" };
const complex: Highlight = { start: 20, end: 27, type: "complex-phrase" };

describe("findSpanAtOffset", () => {
  it("finds the span under the offset", () => {
    expect(findSpanAtOffset([complex], 22)).toBe(complex);
  });

  it("prefers the narrower span when they nest", () => {
    expect(findSpanAtOffset([sentence, adverb], 6)).toBe(adverb);
  });

  it("falls back to the wider span outside the narrow one", () => {
    expect(findSpanAtOffset([sentence, adverb], 15)).toBe(sentence);
  });

  it("treats end as exclusive", () => {
    expect(findSpanAtOffset([adverb], 11)).toBeNull();
  });

  it("treats start as inclusive", () => {
    expect(findSpanAtOffset([adverb], 4)).toBe(adverb);
  });

  it("returns null with no spans", () => {
    expect(findSpanAtOffset([], 5)).toBeNull();
  });

  it("works on any span shape, not just analysis highlights", () => {
    const mistake = { start: 2, end: 11, category: "word-order" as const };
    expect(findSpanAtOffset([mistake], 5)).toBe(mistake);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web test highlight-hit`
Expected: FAIL — `findSpanAtOffset` does not exist.

- [ ] **Step 3: Create the span vocabulary**

Create `apps/web/src/editor/spans.ts`:

```ts
import type { Highlight, HighlightType } from "@writing-helper/analysis";
import type { MarkSeverity, WritingMark } from "@writing-helper/practice";

/**
 * One paint layer. The two sources are very different — a rule engine running
 * in the browser, and mistakes a model quoted — but to the painter they are
 * only spans carrying a layer name.
 */
export type SpanLayer = HighlightType | MarkSeverity;

export interface EditorSpan {
  start: number;
  end: number;
  layer: SpanLayer;
}

export const styleSpans = (highlights: Highlight[]): EditorSpan[] =>
  highlights.map((highlight) => ({
    start: highlight.start,
    end: highlight.end,
    layer: highlight.type,
  }));

export const markSpans = (marks: WritingMark[]): EditorSpan[] =>
  marks.map((mark) => ({ start: mark.start, end: mark.end, layer: mark.severity }));
```

- [ ] **Step 4: Generalise the painter**

Thay toàn bộ `apps/web/src/editor/highlight-painter.ts`:

```ts
import { rangeFor, type TextIndex } from "./text-index";
import type { EditorSpan, SpanLayer } from "./spans";

/**
 * Tô bằng CSS Custom Highlight API: trình duyệt vẽ trực tiếp lên range, không
 * cần chèn thẻ nào vào DOM.
 *
 * Đổi lại là highlight không bắt được sự kiện chuột — việc đó do
 * `highlight-hit.ts` lo bằng cách dò con trỏ.
 */

const REGISTRY_PREFIX = "wh-";

/** Câu vẽ dưới, từ vẽ đè lên, lỗi ngôn ngữ vẽ trên cùng. */
const SENTENCE_LAYERS = new Set<SpanLayer>(["hard-sentence", "very-hard-sentence"]);
const MISTAKE_LAYERS = new Set<SpanLayer>(["error", "refinement"]);

const ALL_LAYERS: SpanLayer[] = [
  "very-hard-sentence",
  "hard-sentence",
  "passive",
  "adverb",
  "qualifier",
  "complex-phrase",
  "refinement",
  "error",
];

function priorityOf(layer: SpanLayer): number {
  if (SENTENCE_LAYERS.has(layer)) return 0;
  if (MISTAKE_LAYERS.has(layer)) return 2;
  return 1;
}

export function highlightsSupported(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS;
}

export function paintSpans(index: TextIndex, spans: EditorSpan[]): void {
  if (!highlightsSupported()) return;

  const byLayer = new Map<SpanLayer, Range[]>();

  for (const span of spans) {
    const range = rangeFor(index, span.start, span.end);
    if (!range) continue;

    const ranges = byLayer.get(span.layer);
    if (ranges) ranges.push(range);
    else byLayer.set(span.layer, [range]);
  }

  for (const layer of ALL_LAYERS) {
    const ranges = byLayer.get(layer);
    const name = REGISTRY_PREFIX + layer;

    if (!ranges || ranges.length === 0) {
      CSS.highlights.delete(name);
      continue;
    }

    const painted = new Highlight(...ranges);
    painted.priority = priorityOf(layer);
    CSS.highlights.set(name, painted);
  }
}

export function clearSpans(): void {
  if (!highlightsSupported()) return;

  for (const layer of ALL_LAYERS) CSS.highlights.delete(REGISTRY_PREFIX + layer);
}
```

- [ ] **Step 5: Generalise the hit test**

Trong `apps/web/src/editor/highlight-hit.ts`, xoá dòng import `Highlight as TextHighlight` và thay hàm `findHighlightAtOffset` bằng:

```ts
/**
 * Span tại một offset. Khi nhiều span lồng nhau (trạng từ nằm trong câu khó),
 * trả về cái hẹp nhất — lời khuyên cụ thể hơn.
 *
 * Generic theo hình dạng span để dùng được cho cả highlight văn phong lẫn lỗi
 * ngôn ngữ, mà caller vẫn nhận lại đúng kiểu mình truyền vào.
 */
export function findSpanAtOffset<T extends { start: number; end: number }>(
  spans: T[],
  offset: number,
): T | null {
  let best: T | null = null;

  for (const span of spans) {
    if (offset < span.start || offset >= span.end) continue;

    const width = span.end - span.start;
    if (!best || width < best.end - best.start) best = span;
  }

  return best;
}
```

- [ ] **Step 6: Update the call sites**

Trong `apps/web/src/editor/plugins/AnalysisPlugin.tsx`: đổi import từ `../highlight-painter` thành `{ clearSpans, paintSpans }`, thêm `import { styleSpans } from "../spans";`, đổi mọi `clearHighlights` → `clearSpans` (kể cả trong `useEffect(() => clearHighlights, [])`), và `paintHighlights(index, result.highlights)` → `paintSpans(index, styleSpans(result.highlights))`.

Trong `apps/web/src/editor/Editor.tsx`: đổi import từ `./highlight-hit` thành `{ findSpanAtOffset, offsetAtPoint }`, import từ `./highlight-painter` thành `{ clearSpans, paintSpans }`, thêm `import { styleSpans } from "./spans";`, đổi cả hai chỗ gọi `findHighlightAtOffset(highlights, offset)` → `findSpanAtOffset(highlights, offset)`, `paintHighlights(index, result.highlights)` → `paintSpans(index, styleSpans(result.highlights))`, và `clearHighlights()` → `clearSpans()`.

- [ ] **Step 7: Confirm no stale names remain**

Run: `grep -rn "paintHighlights\|clearHighlights\|findHighlightAtOffset" apps/web/src`
Expected: no output.

- [ ] **Step 8: Run the web suite and typecheck**

Run: `pnpm --filter @writing-helper/web test && pnpm --filter @writing-helper/web typecheck`
Expected: PASS, typecheck sạch.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/editor/spans.ts apps/web/src/editor/highlight-painter.ts apps/web/src/editor/highlight-hit.ts apps/web/src/editor/highlight-hit.test.ts apps/web/src/editor/plugins/AnalysisPlugin.tsx apps/web/src/editor/Editor.tsx
git commit -m "Generalise the painter and hit test from highlights to spans"
```

---

### Task 11: Editor vẽ mark và mở thẻ khi click

**Files:**
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/api/practice.ts`
- Modify: `apps/web/src/editor/Editor.tsx`

**Interfaces:**
- Consumes: `markSpans`, `paintSpans`, `clearSpans`, `findSpanAtOffset` (Task 10); `MARK_LABELS`, `WritingMark` from `@writing-helper/practice`.
- Produces: `Editor` nhận prop `savedMarks?: WritingMark[] | null`; `PracticeAttemptDetail.marks: WritingMark[] | null`.

- [ ] **Step 1: Add the two mistake layers to CSS**

Trong `apps/web/src/index.css`, thêm ngay sau khối `::highlight(wh-complex-phrase)`:

```css
/*
 * Lỗi ngôn ngữ vẽ bằng gạch chân chứ không phải nền màu: nền màu đã là ngôn ngữ
 * của highlight văn phong, dùng lại sẽ khiến hai thứ khác hẳn nhau trông giống
 * nhau.
 */
::highlight(wh-error) {
  text-decoration: underline wavy var(--color-vermilion);
  text-underline-offset: 3px;
}
::highlight(wh-refinement) {
  text-decoration: underline dotted var(--color-ink-faint);
  text-underline-offset: 3px;
}
```

- [ ] **Step 2: Add `marks` to the API client type**

Trong `apps/web/src/api/practice.ts`, thêm `WritingMark` vào import type từ `@writing-helper/practice`, rồi thêm vào interface `PracticeAttemptDetail`:

```ts
  /** null khi bóc lỗi thất bại; [] khi bài không có lỗi nào. */
  marks: WritingMark[] | null;
```

- [ ] **Step 3: Teach the Editor to paint marks**

Trong `apps/web/src/editor/Editor.tsx`, thêm imports:

```ts
import { MARK_LABELS, type WritingMark } from "@writing-helper/practice";
import { markSpans, styleSpans } from "./spans";
```

(gộp với dòng `styleSpans` đã thêm ở Task 10, đừng import hai lần)

Thêm vào `EditorProps`, `EditorBodyProps`, và phần `Editor` truyền xuống `EditorBody`:

```ts
  /** Paint stored mistakes instead of style highlights (results view). */
  savedMarks?: WritingMark[] | null;
```

Trong `EditorBody`, nhận `savedMarks = null` và thêm cạnh `stateRef`:

```ts
  const marksRef = useRef<{ index: TextIndex | null; marks: WritingMark[] }>({
    index: null,
    marks: [],
  });
  const [markPick, setMarkPick] = useState<{ mark: WritingMark; x: number; y: number } | null>(
    null,
  );
```

Ở đầu `handleClick`, **trước** dòng `if (readOnly || !aiEnabled) return;`, chèn:

```ts
    // Lăng kính lỗi chạy được cả khi read-only, nên phải xử lý trước guard của
    // AI rewrite.
    if (savedMarks) {
      const { index, marks } = marksRef.current;
      if (!index) return;

      const offset = offsetAtPoint(index, event.clientX, event.clientY);
      const found = offset === null ? null : findSpanAtOffset(marks, offset);

      setMarkPick(found ? { mark: found, ...containerPoint(event.clientX, event.clientY) } : null);
      return;
    }
```

Thêm plugin vào cây render, ngay sau dòng `{savedResult && <SavedHighlightsPlugin ... />}`:

```tsx
      {savedMarks && (
        <SavedMarksPlugin
          marks={savedMarks}
          onReady={(index) => {
            marksRef.current = { index, marks: savedMarks };
          }}
        />
      )}
```

Thêm overlay ngay sau `{hover && !popover && <HighlightTooltip hover={hover} />}`:

```tsx
        {markPick && <MistakeCard pick={markPick} />}
```

Thêm hai component ở cuối file:

```tsx
function MistakeCard({ pick }: { pick: { mark: WritingMark; x: number; y: number } }) {
  const flipBelow = shouldFlipBelow(pick.y);

  return (
    <div
      role="dialog"
      aria-label="Mistake"
      className={`absolute z-20 max-w-72 -translate-x-1/2 rounded-sm border border-rule bg-paper px-3 py-2 shadow-[0_6px_20px_-8px_rgba(31,28,24,0.4)] ${
        flipBelow ? "" : "-translate-y-full"
      }`}
      style={{ left: pick.x, top: pick.y + (flipBelow ? 14 : -10) }}
    >
      <p className="font-mono text-[0.7rem] uppercase tracking-wider text-vermilion">
        {MARK_LABELS[pick.mark.category]}
      </p>
      <p className="mt-1 font-display text-base leading-snug">{pick.mark.correction}</p>
      <p className="mt-1 text-sm leading-snug text-ink-soft">{pick.mark.note}</p>
    </div>
  );
}

function SavedMarksPlugin({
  marks,
  onReady,
}: {
  marks: WritingMark[];
  onReady: (index: TextIndex) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const onReadyRef = useRef(onReady);

  useEffect(() => {
    onReadyRef.current = onReady;
  }, [onReady]);

  useEffect(() => {
    const paint = () => {
      const root = editor.getRootElement();
      if (!root) return;
      const index = buildTextIndex(root);
      paintSpans(index, markSpans(marks));
      onReadyRef.current(index);
    };

    paint();
    const unregister = editor.registerUpdateListener(paint);
    return () => {
      unregister();
      clearSpans();
    };
  }, [editor, marks]);

  return null;
}
```

- [ ] **Step 4: Typecheck and run the web suite**

Run: `pnpm --filter @writing-helper/web typecheck && pnpm --filter @writing-helper/web test`
Expected: typecheck sạch, tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/index.css apps/web/src/api/practice.ts apps/web/src/editor/Editor.tsx
git commit -m "Paint resolved mistakes in the editor and open a card on click"
```

---

### Task 12: Màn kết quả — hai lăng kính và "Fix these first"

**Files:**
- Create: `apps/web/src/practice/FixTheseFirst.tsx`
- Create: `apps/web/src/practice/FixTheseFirst.test.tsx`
- Modify: `apps/web/src/pages/PracticeAttemptPage.tsx` (hàm `ResultView`)

**Interfaces:**
- Consumes: `focusCategories`, `MARK_LABELS`, `WritingMark` from `@writing-helper/practice`; `Editor` prop `savedMarks` (Task 11).
- Produces: `<FixTheseFirst marks={...} />`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/practice/FixTheseFirst.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MarkCategory, WritingMark } from "@writing-helper/practice";
import { FixTheseFirst } from "./FixTheseFirst";

function mark(category: MarkCategory): WritingMark {
  return { start: 0, end: 1, category, severity: "error", correction: "x", note: "y" };
}

describe("FixTheseFirst", () => {
  it("names the most common error-tier categories", () => {
    render(<FixTheseFirst marks={[mark("article"), mark("article"), mark("spelling")]} />);
    expect(screen.getByText("Articles")).toBeInTheDocument();
    expect(screen.getByText("Spelling")).toBeInTheDocument();
  });

  it("says so when the paper has no mistakes", () => {
    render(<FixTheseFirst marks={[]} />);
    expect(screen.getByText(/nothing to fix/i)).toBeInTheDocument();
  });

  it("renders nothing when extraction failed", () => {
    const { container } = render(<FixTheseFirst marks={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web test FixTheseFirst`
Expected: FAIL — cannot resolve `./FixTheseFirst`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/practice/FixTheseFirst.tsx`:

```tsx
import { MARK_LABELS, focusCategories, type WritingMark } from "@writing-helper/practice";

/**
 * A starting point: a paper with 30 underlines tells the learner nothing about
 * where to begin.
 *
 * `null` means extraction failed — stay silent, which is a different thing
 * from a paper that came back clean.
 */
export function FixTheseFirst({ marks }: { marks: WritingMark[] | null }) {
  if (!marks) return null;

  const focus = focusCategories(marks);

  return (
    <section className="mt-8 border-t border-rule pt-6">
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-vermilion">
        Fix these first
      </h2>
      {focus.length === 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          Nothing to fix in this paper. Well done.
        </p>
      ) : (
        <ol className="mt-3 space-y-1">
          {focus.map((category, position) => (
            <li key={category} className="font-display text-lg leading-snug">
              <span className="mr-2 font-mono text-[0.7rem] text-ink-faint">{position + 1}</span>
              {MARK_LABELS[category]}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @writing-helper/web test FixTheseFirst`
Expected: PASS — 3 tests.

- [ ] **Step 5: Add the lens toggle to `ResultView`**

Trong `apps/web/src/pages/PracticeAttemptPage.tsx`, thêm `import { FixTheseFirst } from "../practice/FixTheseFirst";` (và `useState` nếu chưa có — nó đã được import ở file này, đừng nhân đôi).

Trong `ResultView`, thêm state ngay sau `const snapshot = attempt.styleSnapshot;`:

```ts
  // Mặc định lăng kính lỗi — đó là thứ người học sửa được ngay. Bóc lỗi hỏng
  // (`marks === null`) thì không có gì để xem ở đó, lùi về Style.
  const [lens, setLens] = useState<"mistakes" | "style">(
    attempt.marks ? "mistakes" : "style",
  );
```

Trong header của `ResultView` (khối `<header>` đang chứa `BrandLockup` và nhãn dạng bài), thêm toggle vào cuối header, chỉ khi có mark:

```tsx
        {attempt.marks && (
          <div className="ml-auto flex border border-rule font-mono text-[0.65rem] uppercase tracking-[0.15em]">
            {(["mistakes", "style"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setLens(option)}
                aria-pressed={lens === option}
                className={`px-3 py-1 ${
                  lens === option ? "bg-ink text-paper" : "text-ink-soft hover:text-vermilion"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        )}
```

Trong sidebar, thêm `<FixTheseFirst marks={attempt.marks} />` ngay **trước** khối `{snapshot && ( ... <StyleProfile ... /> ... )}`.

Đổi lời gọi `<Editor>` trong `ResultView` thành:

```tsx
          {/*
            Hai lăng kính loại trừ nhau: vẽ cả gạch lỗi lẫn nền văn phong lên
            cùng một bài thì vừa rối vừa mâu thuẫn — Hemingway thưởng câu ngắn,
            IELTS thưởng câu phức.
          */}
          <Editor
            key={`${attempt.id}-result-${lens}`}
            mode="edit"
            readOnly
            savedResult={lens === "style" ? snapshot : null}
            savedMarks={lens === "mistakes" ? attempt.marks : null}
            initialEditorState={attempt.content}
            onChange={() => undefined}
            onAnalysis={() => undefined}
          />
```

- [ ] **Step 6: Run the web suite and typecheck**

Run: `pnpm --filter @writing-helper/web test && pnpm --filter @writing-helper/web typecheck`
Expected: PASS, typecheck sạch. `PracticeAttemptPage.test.tsx` sẵn có phải xanh — nếu nó dựng attempt fixture thiếu `marks`, thêm `marks: null` vào fixture đó (đúng nghĩa: bài cũ chưa bóc lỗi).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/practice/FixTheseFirst.tsx apps/web/src/practice/FixTheseFirst.test.tsx apps/web/src/pages/PracticeAttemptPage.tsx
git commit -m "Show mistakes and style as two lenses on the results screen"
```

---

### Task 13: Phòng sửa bài hiện mark của bài gốc, và dòng "Watch for"

**Files:**
- Modify: `apps/web/src/api/practice.ts`
- Modify: `apps/web/src/pages/PracticeAttemptPage.tsx` (`ExamRoom` và `PromptPane`)

**Interfaces:**
- Consumes: `GET /practice/mistakes` (Task 9); `Editor` prop `savedMarks` (Task 11); `MARK_LABELS`, types `MistakeProfile`, `MarkCategory` from `@writing-helper/practice`.
- Produces: `getMistakeProfile(): Promise<MistakeProfile>`.

**Ghi chú về code sẵn có:** `ExamRoom` đã có `const parent = useQuery({ queryKey: ["practice-attempt", attempt.parentAttemptId], queryFn: () => getAttempt(attempt.parentAttemptId!), enabled: Boolean(attempt.parentAttemptId) })` và đã truyền `parentFeedback={parent.data?.feedback ?? null}` xuống `PromptPane`. Mark của bài gốc lấy từ chính query đó, không cần request mới.

- [ ] **Step 1: Add the API client call**

Trong `apps/web/src/api/practice.ts`, thêm `MistakeProfile` vào import type từ `@writing-helper/practice` và thêm ở cuối file:

```ts
export const getMistakeProfile = () => apiFetch<MistakeProfile>("/practice/mistakes");
```

- [ ] **Step 2: Show the parent's marks while revising**

Trong `ExamRoom`, đổi lời gọi `<Editor>` thành:

```tsx
          {/*
            Bản sửa nạp luôn mark của bài gốc: không có thì người học phải nhớ
            lỗi từ màn kết quả rồi lật qua lại giữa hai trang.
          */}
          <Editor
            key={attempt.id}
            mode="write"
            initialEditorState={attempt.content}
            savedMarks={isRevision ? (parent.data?.marks ?? null) : null}
            onChange={handleChange}
            onAnalysis={() => undefined}
            placeholder="Write from the prompt. Marks stay hidden until you submit."
          />
```

- [ ] **Step 3: Fetch the profile and pass the top three down**

Trong `ExamRoom`, thêm query cạnh `parent`:

```ts
  const mistakes = useQuery({ queryKey: ["practice-mistakes"], queryFn: getMistakeProfile });
```

thêm `getMistakeProfile` vào import từ `../api/practice`, và truyền xuống `PromptPane` cạnh `parentFeedback`:

```tsx
            watchFor={(mistakes.data?.tallies ?? []).slice(0, 3).map((tally) => tally.category)}
```

- [ ] **Step 4: Render the reminder in `PromptPane`**

Thêm `MARK_LABELS` và `type MarkCategory` vào import sẵn có từ `@writing-helper/practice`, thêm `watchFor: MarkCategory[]` vào kiểu props của `PromptPane`, và render ở cuối phần thân panel (sau khối hints):

```tsx
      {watchFor.length > 0 && (
        <p className="mt-8 border-t border-rule pt-6 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          Watch for: {watchFor.map((category) => MARK_LABELS[category]).join(", ")}
        </p>
      )}
```

Không gate như hints và không ghi cờ nào: nhắc lỗi nói về điểm yếu của chính người viết, không tiết lộ gì về nội dung bài.

- [ ] **Step 5: Run the web suite and typecheck**

Run: `pnpm --filter @writing-helper/web test && pnpm --filter @writing-helper/web typecheck`
Expected: PASS, typecheck sạch. `PracticeAttemptPage.test.tsx` render `ExamRoom` nên giờ gọi thêm một query — nếu file test dùng mock fetch theo đường dẫn, thêm nhánh trả `{ tallies: [], attemptsConsidered: 0 }` cho `/practice/mistakes`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/api/practice.ts apps/web/src/pages/PracticeAttemptPage.tsx
git commit -m "Carry mistakes into the revision room and remind before writing"
```

---

### Task 14: Mục `Recurring` trên `/progress`

**Files:**
- Create: `apps/web/src/practice/RecurringMistakes.tsx`
- Create: `apps/web/src/practice/RecurringMistakes.test.tsx`
- Modify: `apps/web/src/pages/ProgressPage.tsx`

**Interfaces:**
- Consumes: `getMistakeProfile` (Task 13); `MARK_LABELS`, types `MarkTally`, `MistakeProfile` from `@writing-helper/practice`.
- Produces: `<RecurringMistakes profile={...} />`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/practice/RecurringMistakes.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { MistakeProfile } from "@writing-helper/practice";
import { RecurringMistakes } from "./RecurringMistakes";

const profile: MistakeProfile = {
  attemptsConsidered: 6,
  tallies: [
    { category: "article", count: 9, trend: "down" },
    { category: "verb-tense", count: 4, trend: "flat" },
    { category: "spelling", count: 2, trend: "up" },
  ],
};

describe("RecurringMistakes", () => {
  it("lists categories with their counts", () => {
    render(<RecurringMistakes profile={profile} />);
    expect(screen.getByText("Articles")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("shows a direction for each tally", () => {
    render(<RecurringMistakes profile={profile} />);
    expect(screen.getByLabelText("down")).toBeInTheDocument();
    expect(screen.getByLabelText("up")).toBeInTheDocument();
  });

  it("renders nothing when there is no pattern yet", () => {
    const { container } = render(
      <RecurringMistakes profile={{ tallies: [], attemptsConsidered: 1 }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the profile is loading", () => {
    const { container } = render(<RecurringMistakes profile={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web test RecurringMistakes`
Expected: FAIL — cannot resolve `./RecurringMistakes`.

- [ ] **Step 3: Write the component**

Create `apps/web/src/practice/RecurringMistakes.tsx`:

```tsx
import { MARK_LABELS, type MarkTally, type MistakeProfile } from "@writing-helper/practice";

const ARROW: Record<NonNullable<MarkTally["trend"]>, string> = {
  down: "↓",
  flat: "→",
  up: "↑",
};

/**
 * Hidden until a pattern exists — a box saying "not enough data" only adds
 * noise to a page the learner opened to see how they are doing.
 */
export function RecurringMistakes({ profile }: { profile: MistakeProfile | undefined }) {
  if (!profile || profile.tallies.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Recurring
      </h2>
      <ul className="mt-3 space-y-2">
        {profile.tallies.slice(0, 5).map((tally) => (
          <li key={tally.category} className="flex items-baseline gap-3">
            <span className="font-display text-lg">{MARK_LABELS[tally.category]}</span>
            <span className="font-mono text-[0.7rem] text-ink-faint">{tally.count}</span>
            {tally.trend && (
              <span
                aria-label={tally.trend}
                className={tally.trend === "down" ? "text-ink-soft" : "text-vermilion"}
              >
                {ARROW[tally.trend]}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @writing-helper/web test RecurringMistakes`
Expected: PASS — 4 tests.

- [ ] **Step 5: Wire it into `/progress`**

Trong `apps/web/src/pages/ProgressPage.tsx`, thêm `getMistakeProfile` vào import từ `../api/practice`, thêm `import { RecurringMistakes } from "../practice/RecurringMistakes";`, thêm query cạnh query tổng hợp sẵn có:

```ts
  const mistakes = useQuery({ queryKey: ["practice-mistakes"], queryFn: getMistakeProfile });
```

và render `<RecurringMistakes profile={mistakes.data} />` sau phần biểu đồ tiêu chí, trước phần hồ sơ văn phong (nếu bố cục khác, đặt nó là mục cuối của cột nội dung chính).

- [ ] **Step 6: Run everything**

Run: `pnpm test && pnpm lint`
Expected: toàn bộ suite xanh, lint sạch. Nếu `ProgressPage.test.tsx` mock fetch theo đường dẫn, thêm nhánh trả `{ tallies: [], attemptsConsidered: 0 }` cho `/practice/mistakes`.

- [ ] **Step 7: Verify in the browser**

Chạy `docker compose up -d postgres`, mở preview qua launch config `writing-helper`. Đăng nhập, nộp một bài thật, và kiểm bằng mắt:
- Màn kết quả mặc định ở lăng kính `mistakes`, có gạch sóng đỏ và gạch chấm mờ.
- Click vào một chỗ gạch → thẻ hiện nhãn, câu sửa, ghi chú.
- Chuyển sang `style` → gạch lỗi biến mất, highlight Hemingway hiện lên.
- Ô `Fix these first` liệt kê tối đa ba nhóm.
- Bấm Revise → phòng sửa hiện mark của bài gốc.
- Sau vài bài, `/progress` hiện mục `Recurring`, và phòng thi hiện dòng `Watch for:`.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/practice/RecurringMistakes.tsx apps/web/src/practice/RecurringMistakes.test.tsx apps/web/src/pages/ProgressPage.tsx
git commit -m "Surface the recurring-mistake profile on the progress page"
```

---

## Rủi ro cần theo dõi khi triển khai

- **Tỉ lệ trích sai của model.** Sau Task 8 chạy được với AI thật, đếm số mark bị `resolveWritingMarks` bỏ trên vài bài dài. Rơi nhiều thì cân nhắc dò gần đúng (chuẩn hoá khoảng trắng, bỏ phân biệt hoa thường) — nhưng chỉ sau khi đo được, không làm phòng xa.
- **Chi phí.** Mỗi lần nộp giờ tốn hai lời gọi AI. Endpoint mới dùng `usage: { endpoint: "practice.marks" }` nên `AiUsage` đếm riêng được — kiểm bảng đó sau vài bài thật trước khi làm tiếp.
- **`text-decoration` trong `::highlight()`.** Được spec hỗ trợ nhưng ít dùng. Safari không vẽ gạch sóng thì đổi `wh-error` sang nền `--color-vermilion-soft`, giữ `wh-refinement` gạch chấm — vẫn phân biệt được hai tầng.
