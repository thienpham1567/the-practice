# Sổ lỗi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [../specs/2026-08-26-error-notebook-design.md](../specs/2026-08-26-error-notebook-design.md)

**Goal:** Đánh dấu từng lỗi ngôn ngữ cụ thể trên bài luyện tập đã nộp, và gộp lỗi qua nhiều bài thành hồ sơ "lỗi hay lặp" hiện ở dashboard và nhắc lại trước khi viết bài mới.

**Architecture:** Taxonomy 13 nhãn đóng và các hàm thuần (`summarizeErrors`, `focusCategories`) nằm ở `packages/practice`. Khi nộp bài, `PracticeService.submit()` chạy song song hai lời gọi OpenRouter: chấm điểm (bắt buộc, prompt cũ không đổi) và bóc lỗi (best-effort, schema mới). AI trả nguyên văn đoạn sai; server tự dò offset trên `plainText`. Web tổng quát hoá painter sẵn có để vẽ được cả highlight văn phong lẫn gạch chân lỗi, hai lăng kính loại trừ nhau trên màn kết quả.

**Tech Stack:** pnpm workspaces, TypeScript, NestJS 11 + Prisma 7 (Postgres), React 18 + Vite + Lexical, Vitest (packages + web), Jest (api), Tailwind v4.

## Global Constraints

- `packages/analysis` **không được sửa một dòng nào**.
- Prompt chấm điểm (`apps/api/src/practice/grade-prompt.ts`) **không được sửa**, và toàn bộ test chấm điểm hiện có phải xanh mà không sửa file test.
- `AiService` vẫn là cổng OpenRouter thuần: không thêm method nào biết về bóc lỗi. Prompt và schema nằm trong `PracticeModule`.
- `packages/practice` không import React, HTTP client, hay Prisma.
- Không tạo bảng thống kê lỗi — hồ sơ suy ra từ `PracticeAttempt.errors`.
- Nhãn lỗi và giải thích bằng tiếng Anh.
- Bộ nhãn đóng, đúng 13 giá trị, theo thứ tự khai báo trong `ERROR_CATEGORIES`.
- Sau mỗi task: chạy test liên quan, commit riêng.

---

### Task 1: Taxonomy lỗi trong `packages/practice`

**Files:**
- Modify: `packages/practice/src/types.ts`
- Create: `packages/practice/src/error-catalog.ts`
- Create: `packages/practice/src/error-catalog.test.ts`
- Modify: `packages/practice/src/index.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `ErrorSeverity`, `ErrorCategory`, `WritingError`, `AttemptErrorInput`, `ErrorTally`, `ErrorProfile` types; `ERROR_CATEGORIES: readonly ErrorCategory[]`, `ERROR_SEVERITY: Record<ErrorCategory, ErrorSeverity>`, `ERROR_LABELS: Record<ErrorCategory, string>`.

- [ ] **Step 1: Write the failing test**

Create `packages/practice/src/error-catalog.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { ERROR_CATEGORIES, ERROR_LABELS, ERROR_SEVERITY } from "./error-catalog";

describe("error catalog", () => {
  it("holds exactly 13 categories with no duplicates", () => {
    expect(ERROR_CATEGORIES).toHaveLength(13);
    expect(new Set(ERROR_CATEGORIES).size).toBe(13);
  });

  it("gives every category a severity", () => {
    for (const category of ERROR_CATEGORIES) {
      expect(ERROR_SEVERITY[category]).toMatch(/^(error|refinement)$/);
    }
  });

  it("marks only word-choice and register as refinement", () => {
    const refinements = ERROR_CATEGORIES.filter((c) => ERROR_SEVERITY[c] === "refinement");
    expect(refinements).toEqual(["word-choice", "register"]);
  });

  it("gives every category a non-empty label", () => {
    for (const category of ERROR_CATEGORIES) {
      expect(ERROR_LABELS[category].length).toBeGreaterThan(0);
    }
  });

  it("puts article first so it wins ties in taxonomy order", () => {
    expect(ERROR_CATEGORIES[0]).toBe("article");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/practice test`
Expected: FAIL — cannot resolve `./error-catalog`.

- [ ] **Step 3: Add the types**

Append to `packages/practice/src/types.ts`:

```ts
export type ErrorSeverity = "error" | "refinement";

export type ErrorCategory =
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

/** A marked mistake, located by character offset on the attempt's plainText. */
export interface WritingError {
  /** inclusive */
  start: number;
  /** exclusive */
  end: number;
  category: ErrorCategory;
  severity: ErrorSeverity;
  correction: string;
  explain: string;
}

/** Just enough of an attempt to build the recurring-error profile. */
export interface AttemptErrorInput {
  errors: WritingError[];
  wordCount: number;
  submittedAt: Date;
}

export interface ErrorTally {
  category: ErrorCategory;
  count: number;
  /** null when there are too few attempts to read a direction. */
  trend: "down" | "flat" | "up" | null;
}

export interface ErrorProfile {
  tallies: ErrorTally[];
  attemptsConsidered: number;
}
```

- [ ] **Step 4: Write the catalog**

Create `packages/practice/src/error-catalog.ts`:

```ts
import type { ErrorCategory, ErrorSeverity } from "./types";

/**
 * Nguồn duy nhất của bộ nhãn. Thứ tự khai báo cũng là thứ tự phá hoà: hai nhãn
 * cùng số lần thì nhãn đứng trước ở đây được ưu tiên, nên thứ tự phải ổn định.
 */
export const ERROR_CATEGORIES: readonly ErrorCategory[] = [
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
 * Tầng là thuộc tính của nhãn, không phải của từng lần mắc lỗi — nên suy ra ở
 * đây thay vì hỏi model, tránh mâu thuẫn kiểu `article` + `refinement`.
 */
export const ERROR_SEVERITY: Record<ErrorCategory, ErrorSeverity> = {
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

export const ERROR_LABELS: Record<ErrorCategory, string> = {
  article: "Articles",
  "verb-tense": "Verb tense",
  "subject-verb-agreement": "Subject–verb agreement",
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

In `packages/practice/src/index.ts`, add to the existing `export type { ... } from "./types";` block the names `AttemptErrorInput`, `ErrorCategory`, `ErrorProfile`, `ErrorSeverity`, `ErrorTally`, `WritingError`, and add a new line:

```ts
export { ERROR_CATEGORIES, ERROR_LABELS, ERROR_SEVERITY } from "./error-catalog";
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @writing-helper/practice test`
Expected: PASS — 5 new tests plus the existing 18.

- [ ] **Step 7: Commit**

```bash
git add packages/practice/src/types.ts packages/practice/src/error-catalog.ts packages/practice/src/error-catalog.test.ts packages/practice/src/index.ts
git commit -m "Add the closed error taxonomy to packages/practice"
```

---

### Task 2: `summarizeErrors`

**Files:**
- Create: `packages/practice/src/summarize-errors.ts`
- Create: `packages/practice/src/summarize-errors.test.ts`
- Modify: `packages/practice/src/index.ts`

**Interfaces:**
- Consumes: `ERROR_CATEGORIES` from Task 1; types `AttemptErrorInput`, `ErrorProfile`, `ErrorTally`, `WritingError`, `ErrorCategory`.
- Produces: `summarizeErrors(attempts: AttemptErrorInput[]): ErrorProfile`, plus `PROFILE_WINDOW = 10`, `MIN_OCCURRENCES = 2`, `MIN_ATTEMPTS_FOR_TREND = 4`.

- [ ] **Step 1: Write the failing test**

Create `packages/practice/src/summarize-errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { summarizeErrors } from "./summarize-errors";
import type { AttemptErrorInput, ErrorCategory, WritingError } from "./types";

function err(category: ErrorCategory): WritingError {
  return { start: 0, end: 1, category, severity: "error", correction: "x", explain: "y" };
}

function attempt(
  day: number,
  categories: ErrorCategory[],
  wordCount = 100,
): AttemptErrorInput {
  return {
    errors: categories.map(err),
    wordCount,
    submittedAt: new Date(Date.UTC(2026, 0, day)),
  };
}

describe("summarizeErrors", () => {
  it("returns an empty profile for no attempts", () => {
    expect(summarizeErrors([])).toEqual({ tallies: [], attemptsConsidered: 0 });
  });

  it("drops categories seen only once", () => {
    const profile = summarizeErrors([attempt(1, ["article", "spelling"])]);
    expect(profile.tallies).toEqual([]);
    expect(profile.attemptsConsidered).toBe(1);
  });

  it("keeps categories seen at least twice, sorted by count", () => {
    const profile = summarizeErrors([attempt(1, ["article", "article", "spelling", "spelling", "spelling"])]);
    expect(profile.tallies.map((t) => [t.category, t.count])).toEqual([
      ["spelling", 3],
      ["article", 2],
    ]);
  });

  it("breaks count ties in taxonomy order", () => {
    // spelling is declared after article, so article must come first.
    const profile = summarizeErrors([attempt(1, ["spelling", "spelling", "article", "article"])]);
    expect(profile.tallies.map((t) => t.category)).toEqual(["article", "spelling"]);
  });

  it("keeps only the 10 most recent attempts", () => {
    const many = Array.from({ length: 12 }, (_, i) => attempt(i + 1, ["article", "article"]));
    // Day 1 and 2 fall out of the window: 10 attempts x 2 = 20, not 24.
    const profile = summarizeErrors(many);
    expect(profile.attemptsConsidered).toBe(10);
    expect(profile.tallies[0]).toMatchObject({ category: "article", count: 20 });
  });

  it("sorts by submittedAt itself, so caller order does not matter", () => {
    const shuffled = [attempt(3, ["article", "article"]), attempt(1, ["spelling"]), attempt(2, ["spelling"])];
    const profile = summarizeErrors(shuffled);
    expect(profile.attemptsConsidered).toBe(3);
    expect(profile.tallies.map((t) => t.category)).toEqual(["article", "spelling"]);
  });

  it("leaves trend null below four attempts", () => {
    const profile = summarizeErrors([attempt(1, ["article", "article"]), attempt(2, ["article"])]);
    expect(profile.tallies[0]!.trend).toBeNull();
  });

  it("reports down when the recent half improves", () => {
    const profile = summarizeErrors([
      attempt(1, ["article", "article", "article", "article"]),
      attempt(2, ["article", "article", "article", "article"]),
      attempt(3, []),
      attempt(4, []),
    ]);
    expect(profile.tallies[0]).toMatchObject({ category: "article", count: 8, trend: "down" });
  });

  it("reports up when the recent half worsens", () => {
    const profile = summarizeErrors([
      attempt(1, []),
      attempt(2, []),
      attempt(3, ["article", "article", "article", "article"]),
      attempt(4, ["article", "article", "article", "article"]),
    ]);
    expect(profile.tallies[0]!.trend).toBe("up");
  });

  it("reports flat when the rate barely moves", () => {
    const profile = summarizeErrors([
      attempt(1, ["article", "article"]),
      attempt(2, ["article", "article"]),
      attempt(3, ["article", "article"]),
      attempt(4, ["article", "article"]),
    ]);
    expect(profile.tallies[0]!.trend).toBe("flat");
  });

  it("normalises by words, so longer papers are not read as regression", () => {
    // Same rate per 100 words on both halves, but the recent papers are longer.
    const profile = summarizeErrors([
      attempt(1, ["article", "article"], 100),
      attempt(2, ["article", "article"], 100),
      attempt(3, ["article", "article", "article", "article"], 200),
      attempt(4, ["article", "article", "article", "article"], 200),
    ]);
    expect(profile.tallies[0]!.trend).toBe("flat");
  });

  it("puts the middle paper in the recent half when the count is odd", () => {
    // 5 papers: older = days 1-2, recent = days 3-5. The clean day 3 belongs to
    // the recent half, which is what makes this read as down.
    const profile = summarizeErrors([
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

Run: `pnpm --filter @writing-helper/practice test summarize-errors`
Expected: FAIL — cannot resolve `./summarize-errors`.

- [ ] **Step 3: Write the implementation**

Create `packages/practice/src/summarize-errors.ts`:

```ts
import { ERROR_CATEGORIES } from "./error-catalog";
import type {
  AttemptErrorInput,
  ErrorCategory,
  ErrorProfile,
  ErrorTally,
} from "./types";

/** Bài gần nhất được xét — đủ gần để phản ánh trình độ hiện tại. */
export const PROFILE_WINDOW = 10;
/** Một lần là tai nạn, không phải pattern. */
export const MIN_OCCURRENCES = 2;
/** Dưới mức này thì chia đôi cửa sổ không còn ý nghĩa. */
export const MIN_ATTEMPTS_FOR_TREND = 4;

/** Lệch nhau để dao động nhỏ không bị đọc thành xu hướng. */
const IMPROVED_BELOW = 0.75;
const WORSENED_ABOVE = 1.33;

/**
 * Hồ sơ lỗi hay lặp, suy ra từ các bài đã nộp — không có bảng thống kê nào.
 * Hàm tự sắp xếp và tự cắt cửa sổ, caller không phải nhớ tiền điều kiện.
 */
export function summarizeErrors(attempts: AttemptErrorInput[]): ErrorProfile {
  const window = [...attempts]
    .sort((a, b) => a.submittedAt.getTime() - b.submittedAt.getTime())
    .slice(-PROFILE_WINDOW);

  if (window.length === 0) return { tallies: [], attemptsConsidered: 0 };

  const counts = new Map<ErrorCategory, number>();
  for (const attempt of window) {
    for (const error of attempt.errors) {
      counts.set(error.category, (counts.get(error.category) ?? 0) + 1);
    }
  }

  // Số bài lẻ: bài ở giữa thuộc nửa mới, thiên về phản ánh hiện tại.
  const split = Math.floor(window.length / 2);
  const older = window.slice(0, split);
  const recent = window.slice(split);
  const canTrend = window.length >= MIN_ATTEMPTS_FOR_TREND;

  const tallies: ErrorTally[] = [];
  for (const category of ERROR_CATEGORIES) {
    const count = counts.get(category) ?? 0;
    if (count < MIN_OCCURRENCES) continue;
    tallies.push({
      category,
      count,
      trend: canTrend ? trendFor(category, older, recent) : null,
    });
  }

  // Sort ổn định: đồng hạng giữ nguyên thứ tự taxonomy đã duyệt ở trên.
  tallies.sort((a, b) => b.count - a.count);

  return { tallies, attemptsConsidered: window.length };
}

/** Lỗi trên 100 từ — không chuẩn hoá thì bài dài hơn trông như đang tệ đi. */
function ratePer100Words(category: ErrorCategory, attempts: AttemptErrorInput[]): number {
  let errors = 0;
  let words = 0;

  for (const attempt of attempts) {
    errors += attempt.errors.filter((error) => error.category === category).length;
    words += attempt.wordCount;
  }

  return words === 0 ? 0 : (errors / words) * 100;
}

function trendFor(
  category: ErrorCategory,
  older: AttemptErrorInput[],
  recent: AttemptErrorInput[],
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
  summarizeErrors,
  PROFILE_WINDOW,
  MIN_OCCURRENCES,
  MIN_ATTEMPTS_FOR_TREND,
} from "./summarize-errors";
```

Run: `pnpm --filter @writing-helper/practice test`
Expected: PASS — all 12 new tests.

- [ ] **Step 5: Commit**

```bash
git add packages/practice/src/summarize-errors.ts packages/practice/src/summarize-errors.test.ts packages/practice/src/index.ts
git commit -m "Add summarizeErrors: recurring-error profile from recent attempts"
```

---

### Task 3: `focusCategories`

**Files:**
- Create: `packages/practice/src/focus-categories.ts`
- Create: `packages/practice/src/focus-categories.test.ts`
- Modify: `packages/practice/src/index.ts`

**Interfaces:**
- Consumes: `ERROR_CATEGORIES`, `ERROR_SEVERITY` from Task 1; type `WritingError`.
- Produces: `focusCategories(errors: WritingError[], limit?: number): ErrorCategory[]`.

- [ ] **Step 1: Write the failing test**

Create `packages/practice/src/focus-categories.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { focusCategories } from "./focus-categories";
import type { ErrorCategory, WritingError } from "./types";

function err(category: ErrorCategory, severity: "error" | "refinement" = "error"): WritingError {
  return { start: 0, end: 1, category, severity, correction: "x", explain: "y" };
}

describe("focusCategories", () => {
  it("returns nothing for an empty list", () => {
    expect(focusCategories([])).toEqual([]);
  });

  it("returns the three most common categories, most common first", () => {
    const errors = [
      err("spelling"), err("spelling"), err("spelling"),
      err("article"), err("article"),
      err("preposition"),
      err("pronoun"),
    ];
    // preposition and pronoun both have 1; preposition is earlier in taxonomy.
    expect(focusCategories(errors)).toEqual(["spelling", "article", "preposition"]);
  });

  it("ignores the refinement tier", () => {
    const errors = [
      err("word-choice", "refinement"), err("word-choice", "refinement"),
      err("word-choice", "refinement"), err("register", "refinement"),
      err("article"),
    ];
    expect(focusCategories(errors)).toEqual(["article"]);
  });

  it("breaks ties in taxonomy order", () => {
    // Both appear once; article is declared before spelling.
    expect(focusCategories([err("spelling"), err("article")])).toEqual(["article", "spelling"]);
  });

  it("returns fewer than three when there are fewer categories", () => {
    expect(focusCategories([err("article"), err("article")])).toEqual(["article"]);
  });

  it("honours an explicit limit", () => {
    const errors = [err("article"), err("spelling"), err("pronoun")];
    expect(focusCategories(errors, 2)).toEqual(["article", "spelling"]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/practice test focus-categories`
Expected: FAIL — cannot resolve `./focus-categories`.

- [ ] **Step 3: Write the implementation**

Create `packages/practice/src/focus-categories.ts`:

```ts
import { ERROR_CATEGORIES, ERROR_SEVERITY } from "./error-catalog";
import type { ErrorCategory, WritingError } from "./types";

/**
 * Vài nhóm lỗi đáng sửa trước trong riêng một bài. Chỉ tầng "error": bảo người
 * học ưu tiên chuyện dùng từ chưa hay trong khi còn sai ngữ pháp là sai thứ tự.
 *
 * Cố ý không dính tới hồ sơ tái diễn — màn kết quả nói về bài vừa viết,
 * dashboard mới nói về xu hướng dài hạn.
 */
export function focusCategories(errors: WritingError[], limit = 3): ErrorCategory[] {
  const counts = new Map<ErrorCategory, number>();

  for (const error of errors) {
    if (ERROR_SEVERITY[error.category] !== "error") continue;
    counts.set(error.category, (counts.get(error.category) ?? 0) + 1);
  }

  return ERROR_CATEGORIES.filter((category) => counts.has(category))
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

### Task 4: Cột `errors` trên `PracticeAttempt`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_attempt_errors/migration.sql` (do `prisma migrate dev` sinh ra)

**Interfaces:**
- Consumes: nothing.
- Produces: `PracticeAttempt.errors` kiểu `Json?`, đọc ra là `WritingError[] | null`.

- [ ] **Step 1: Add the column to the schema**

Trong `apps/api/prisma/schema.prisma`, model `PracticeAttempt`, thêm ngay dưới `styleSnapshot`:

```prisma
  /// WritingError[] — null khi bóc lỗi thất bại; [] khi bài không có lỗi nào.
  errors Json?
```

- [ ] **Step 2: Make sure the dev database is up**

Run: `docker compose up -d postgres`
Expected: container `writing-helper-db` running.

- [ ] **Step 3: Generate and apply the migration**

Run: `cd apps/api && npx prisma migrate dev --name attempt_errors`
Expected: tạo thư mục migration mới và in "Your database is now in sync with your schema."

- [ ] **Step 4: Verify migration state is clean**

Run: `cd apps/api && npx prisma migrate status`
Expected: "Database schema is up to date!"

- [ ] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "Add errors column to PracticeAttempt"
```

---

### Task 5: Prompt và schema bóc lỗi

**Files:**
- Create: `apps/api/src/practice/error-prompt.ts`
- Create: `apps/api/src/practice/error-prompt.spec.ts`

**Interfaces:**
- Consumes: `ERROR_CATEGORIES`, types `ErrorCategory`, `TaskSpec` from `@writing-helper/practice`; `JsonSchemaSpec` from `../ai/ai.service`.
- Produces: `RawWritingError`, `ExtractErrorsResult`, `EXTRACT_ERRORS_SCHEMA`, `buildErrorPrompt(task: TaskSpec, essay: string): string`.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/practice/error-prompt.spec.ts`:

```ts
import { ERROR_CATEGORIES, TASK_CATALOG } from "@writing-helper/practice";
import { EXTRACT_ERRORS_SCHEMA, buildErrorPrompt } from "./error-prompt";

const emailTask = TASK_CATALOG.find((task) => task.type === "email")!;

describe("buildErrorPrompt", () => {
  it("includes the essay", () => {
    const prompt = buildErrorPrompt(emailTask, "I very like it.");
    expect(prompt).toContain("I very like it.");
  });

  it("names the task type so register can be judged in context", () => {
    const prompt = buildErrorPrompt(emailTask, "hello");
    expect(prompt).toContain(emailTask.label);
  });

  it("demands a verbatim quote", () => {
    const prompt = buildErrorPrompt(emailTask, "hello");
    expect(prompt).toContain("character for character");
  });

  it("keeps style rules out of scope so it does not fight the rule engine", () => {
    const prompt = buildErrorPrompt(emailTask, "hello");
    expect(prompt).toContain("Do not comment on style");
  });
});

describe("EXTRACT_ERRORS_SCHEMA", () => {
  it("locks category to the closed taxonomy", () => {
    const errors = EXTRACT_ERRORS_SCHEMA.schema.properties as Record<string, any>;
    const item = errors.errors.items.properties as Record<string, any>;
    expect(item.category.enum).toEqual([...ERROR_CATEGORIES]);
  });

  it("requires every field the resolver reads", () => {
    const errors = EXTRACT_ERRORS_SCHEMA.schema.properties as Record<string, any>;
    expect(errors.errors.items.required).toEqual([
      "quote",
      "occurrence",
      "category",
      "correction",
      "explain",
    ]);
  });

  it("does not ask the model for severity", () => {
    const errors = EXTRACT_ERRORS_SCHEMA.schema.properties as Record<string, any>;
    expect(errors.errors.items.properties).not.toHaveProperty("severity");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/practice/error-prompt.spec.ts`
Expected: FAIL — cannot find module `./error-prompt`.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/practice/error-prompt.ts`:

```ts
import { ERROR_CATEGORIES } from "@writing-helper/practice";
import type { ErrorCategory, TaskSpec } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";

/**
 * Những gì model trả về. Không có `severity`: tầng là thuộc tính của nhãn, suy
 * ra ở `resolveErrors` thay vì hỏi model rồi phải xử lý mâu thuẫn.
 */
export interface RawWritingError {
  quote: string;
  occurrence: number;
  category: ErrorCategory;
  correction: string;
  explain: string;
}

export interface ExtractErrorsResult {
  errors: RawWritingError[];
}

export const EXTRACT_ERRORS_SCHEMA: JsonSchemaSpec = {
  name: "practice_errors",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["errors"],
    properties: {
      errors: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["quote", "occurrence", "category", "correction", "explain"],
          properties: {
            quote: { type: "string" },
            occurrence: { type: "integer", minimum: 1 },
            category: { type: "string", enum: [...ERROR_CATEGORIES] },
            correction: { type: "string" },
            explain: { type: "string" },
          },
        },
      },
    },
  },
};

export function buildErrorPrompt(task: TaskSpec, essay: string): string {
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
    `- "explain": one short sentence saying why, written for a learner.\n\n` +
    `Do not comment on style, sentence length, or word count — only language ` +
    `mistakes and unnatural word choice. Return an empty list if there are none.`
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/practice/error-prompt.spec.ts`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/practice/error-prompt.ts apps/api/src/practice/error-prompt.spec.ts
git commit -m "Add the error-extraction prompt and JSON schema"
```

---

### Task 6: Phân giải `quote` thành offset

**Files:**
- Create: `apps/api/src/practice/resolve-errors.ts`
- Create: `apps/api/src/practice/resolve-errors.spec.ts`

**Interfaces:**
- Consumes: `ERROR_CATEGORIES`, `ERROR_SEVERITY`, type `WritingError` from `@writing-helper/practice`; `RawWritingError` from Task 5.
- Produces: `resolveErrors(plainText: string, raw: RawWritingError[]): WritingError[]` — trả mảng sắp theo `start` tăng dần.

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/practice/resolve-errors.spec.ts`:

```ts
import type { RawWritingError } from "./error-prompt";
import { resolveErrors } from "./resolve-errors";

function raw(overrides: Partial<RawWritingError> = {}): RawWritingError {
  return {
    quote: "very like",
    occurrence: 1,
    category: "word-order",
    correction: "like ... very much",
    explain: "Word order.",
    ...overrides,
  };
}

describe("resolveErrors", () => {
  it("locates a quote and derives severity from the category", () => {
    const text = "I very like it.";
    expect(resolveErrors(text, [raw()])).toEqual([
      {
        start: 2,
        end: 11,
        category: "word-order",
        severity: "error",
        correction: "like ... very much",
        explain: "Word order.",
      },
    ]);
  });

  it("marks refinement categories as refinement", () => {
    const text = "I made a big mistake.";
    const [resolved] = resolveErrors(text, [raw({ quote: "big", category: "word-choice" })]);
    expect(resolved!.severity).toBe("refinement");
  });

  it("honours occurrence for a repeated quote", () => {
    const text = "the cat and the dog";
    const [resolved] = resolveErrors(text, [
      raw({ quote: "the", occurrence: 2, category: "article" }),
    ]);
    expect(resolved).toMatchObject({ start: 12, end: 15 });
  });

  it("drops an error whose quote is absent", () => {
    expect(resolveErrors("I like it.", [raw({ quote: "not in the essay" })])).toEqual([]);
  });

  it("drops an error whose occurrence overshoots", () => {
    expect(resolveErrors("the cat", [raw({ quote: "the", occurrence: 3, category: "article" })])).toEqual([]);
  });

  it("drops an empty or whitespace quote", () => {
    expect(resolveErrors("I like it.", [raw({ quote: "" }), raw({ quote: "   " })])).toEqual([]);
  });

  it("drops a category outside the taxonomy", () => {
    const bad = raw({ category: "vibes" as RawWritingError["category"] });
    expect(resolveErrors("I very like it.", [bad])).toEqual([]);
  });

  it("keeps the first of two errors on the same span", () => {
    const text = "I very like it.";
    const resolved = resolveErrors(text, [
      raw({ explain: "first" }),
      raw({ explain: "second" }),
    ]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0]!.explain).toBe("first");
  });

  it("sorts the result by start offset", () => {
    const text = "the cat very like fish";
    const resolved = resolveErrors(text, [
      raw({ quote: "very like" }),
      raw({ quote: "the", category: "article" }),
    ]);
    expect(resolved.map((error) => error.start)).toEqual([0, 8]);
  });

  it("treats a missing occurrence as the first one", () => {
    const bad = { ...raw(), occurrence: undefined as unknown as number };
    expect(resolveErrors("I very like it.", [bad])[0]).toMatchObject({ start: 2 });
  });

  it("returns an empty array for no raw errors", () => {
    expect(resolveErrors("I like it.", [])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest src/practice/resolve-errors.spec.ts`
Expected: FAIL — cannot find module `./resolve-errors`.

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/practice/resolve-errors.ts`:

```ts
import { ERROR_CATEGORIES, ERROR_SEVERITY } from "@writing-helper/practice";
import type { WritingError } from "@writing-helper/practice";
import type { RawWritingError } from "./error-prompt";

const KNOWN_CATEGORIES = new Set<string>(ERROR_CATEGORIES);

/**
 * Model đếm ký tự rất tệ, nên nó trích nguyên văn và ta tự dò vị trí.
 *
 * Mọi trường hợp hỏng đều bỏ im lặng: mất một dấu gạch tốt hơn là hỏng cả màn
 * kết quả vì một mục model trả về lệch.
 */
export function resolveErrors(plainText: string, raw: RawWritingError[]): WritingError[] {
  const resolved: WritingError[] = [];
  const takenSpans = new Set<string>();

  for (const item of raw) {
    const quote = item.quote ?? "";
    if (quote.trim() === "") continue;
    if (!KNOWN_CATEGORIES.has(item.category)) continue;

    const start = nthIndexOf(plainText, quote, item.occurrence ?? 1);
    if (start === -1) continue;

    const end = start + quote.length;
    const span = `${start}:${end}`;
    if (takenSpans.has(span)) continue;
    takenSpans.add(span);

    resolved.push({
      start,
      end,
      category: item.category,
      severity: ERROR_SEVERITY[item.category],
      correction: item.correction,
      explain: item.explain,
    });
  }

  return resolved.sort((a, b) => a.start - b.start);
}

/** Vị trí lần xuất hiện thứ `n` (1-based), hoặc -1 nếu không có đủ. */
function nthIndexOf(haystack: string, needle: string, n: number): number {
  if (!Number.isInteger(n) || n < 1) return -1;

  let index = -1;
  for (let seen = 0; seen < n; seen++) {
    index = haystack.indexOf(needle, index + 1);
    if (index === -1) return -1;
  }
  return index;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && npx jest src/practice/resolve-errors.spec.ts`
Expected: PASS — 11 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/practice/resolve-errors.ts apps/api/src/practice/resolve-errors.spec.ts
git commit -m "Resolve model-quoted mistakes into character offsets"
```

---

### Task 7: `submit()` chạy song song chấm điểm và bóc lỗi

**Files:**
- Modify: `apps/api/src/practice/practice.service.ts`
- Modify: `apps/api/src/practice/practice.service.spec.ts:108-159` (bên trong `describe("submit")`)
- Modify: `apps/api/test/app.e2e-spec.ts:355-371` (`mockPracticeAi`)

**Interfaces:**
- Consumes: `buildErrorPrompt`, `EXTRACT_ERRORS_SCHEMA`, `ExtractErrorsResult` (Task 5); `resolveErrors` (Task 6); cột `errors` (Task 4).
- Produces: `submit()` lưu thêm `errors`. Không đổi chữ ký public nào.

**Ghi chú về file spec sẵn có:** helper là `serviceWith({ attempt, updated, ... })`, trả `{ service, prisma, complete }`. `complete` là `jest.fn()` mock của `AiService.complete`. Object `graded` và `draft` đã có sẵn ở đầu `describe("submit")` — dùng lại, đừng dựng mới.

- [ ] **Step 1: Write the failing tests**

Thêm bốn test vào `apps/api/src/practice/practice.service.spec.ts`, bên trong `describe("submit", ...)`, sau test `"rejects a second submit with 409"`:

```ts
    it("stores mistakes resolved from the model's quotes", async () => {
      const { service, prisma, complete } = serviceWith({ attempt: draft });
      // Promise.allSettled gọi theo thứ tự mảng: chấm điểm trước, bóc lỗi sau.
      complete.mockResolvedValueOnce(graded).mockResolvedValueOnce({
        errors: [
          {
            quote: "very like",
            occurrence: 1,
            category: "word-order",
            correction: "like it very much",
            explain: "Word order.",
          },
        ],
      });

      await service.submit("user-1", "a1", {
        styleSnapshot: {},
        plainText: "I very like it.",
      });

      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            errors: [
              {
                start: 2,
                end: 11,
                category: "word-order",
                severity: "error",
                correction: "like it very much",
                explain: "Word order.",
              },
            ],
          }),
        }),
      );
    });

    it("still saves the band when mistake extraction fails", async () => {
      const { service, prisma, complete } = serviceWith({ attempt: draft });
      complete
        .mockResolvedValueOnce(graded)
        .mockRejectedValueOnce(new Error("model returned junk"));

      await service.submit("user-1", "a1", {
        styleSnapshot: {},
        plainText: "I very like it.",
      });

      const { data } = prisma.practiceAttempt.update.mock.calls[0][0];
      expect(data.band).toBe(overallBand(graded.scores));
      expect(data.errors).toBeUndefined();
    });

    it("fails the submit when grading fails", async () => {
      const { service, prisma, complete } = serviceWith({ attempt: draft });
      complete
        .mockRejectedValueOnce(new Error("grading is down"))
        .mockResolvedValueOnce({ errors: [] });

      await expect(
        service.submit("user-1", "a1", { styleSnapshot: {}, plainText: "hi" }),
      ).rejects.toThrow("grading is down");
      expect(prisma.practiceAttempt.update).not.toHaveBeenCalled();
    });

    it("stores an empty list when the paper has no mistakes", async () => {
      const { service, prisma, complete } = serviceWith({ attempt: draft });
      complete.mockResolvedValueOnce(graded).mockResolvedValueOnce({ errors: [] });

      await service.submit("user-1", "a1", {
        styleSnapshot: {},
        plainText: "Flawless.",
      });

      const { data } = prisma.practiceAttempt.update.mock.calls[0][0];
      expect(data.errors).toEqual([]);
    });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx jest src/practice/practice.service.spec.ts`
Expected: FAIL — `data.errors` là `undefined` ở test đầu, và service mới gọi `ai.complete` một lần.

- [ ] **Step 3: Rewrite the AI section of `submit()`**

Trong `apps/api/src/practice/practice.service.ts`, thêm import:

```ts
import { EXTRACT_ERRORS_SCHEMA, buildErrorPrompt, type ExtractErrorsResult } from "./error-prompt";
import { resolveErrors } from "./resolve-errors";
```

Thay khối `const graded = await this.ai.complete<GradeResult>({ ... });` bằng:

```ts
    // Hai việc khác nhau, hai lời gọi: nhét cả hai vào một prompt làm model rẻ
    // kém đi ở cả hai. Chạy song song nên không chậm thêm.
    const [gradeOutcome, errorOutcome] = await Promise.allSettled([
      this.ai.complete<GradeResult>({
        prompt: buildGradePrompt({
          task,
          promptText: attempt.prompt,
          essay: plainText,
          wordCount,
        }),
        schema: GRADE_TASK_SCHEMA,
        maxTokens: 1500,
      }),
      this.ai.complete<ExtractErrorsResult>({
        prompt: buildErrorPrompt(task, plainText),
        schema: EXTRACT_ERRORS_SCHEMA,
        maxTokens: 2000,
      }),
    ]);

    // Chấm điểm là bắt buộc; bóc lỗi là best-effort — hỏng thì người học vẫn
    // có band, chỉ mất phần đánh dấu.
    if (gradeOutcome.status === "rejected") throw gradeOutcome.reason;
    const graded = gradeOutcome.value;

    const errors =
      errorOutcome.status === "fulfilled"
        ? resolveErrors(plainText, errorOutcome.value.errors ?? [])
        : null;
```

Trong object `data` của `this.prisma.practiceAttempt.update`, thêm ngay sau `styleSnapshot`:

```ts
        ...(errors !== null && { errors: errors as unknown as Prisma.InputJsonValue }),
```

Mảng rỗng vẫn được lưu (`[]`), để phân biệt "bài không có lỗi" với "bóc lỗi hỏng" (`null`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/practice`
Expected: PASS — bao gồm cả các test `submit` cũ.

- [ ] **Step 5: Run the whole api unit suite to confirm grading is untouched**

Run: `cd apps/api && npx jest`
Expected: PASS — 33 unit test cũ vẫn xanh, không sửa file test chấm điểm nào.

- [ ] **Step 6: Teach the e2e OpenRouter mock about the new schema**

`mockPracticeAi()` trong `apps/api/test/app.e2e-spec.ts` phân nhánh theo tên schema; chưa có nhánh nào cho `practice_errors` thì lời gọi bóc lỗi sẽ nhận về object sinh đề và im lặng ra mảng rỗng.

Thêm cạnh `graded` (khoảng dòng 349) một fixture. Hai lỗi cùng nhãn `article` là cố ý — `MIN_OCCURRENCES` là 2, nên đây là dữ liệu tối thiểu để hồ sơ ở Task 8 có gì để hiện:

```ts
    const extracted = {
      errors: [
        {
          quote: "a school",
          occurrence: 1,
          category: "article",
          correction: "the school",
          explain: "Use the definite article for a specific school.",
        },
        {
          quote: "a trip",
          occurrence: 1,
          category: "article",
          correction: "the trip",
          explain: "The trip has already been mentioned.",
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
            : schemaName === "practice_errors"
              ? JSON.stringify(extracted)
              : JSON.stringify(generated);
```

- [ ] **Step 7: Assert the submitted paper carries resolved mistakes**

Trong e2e test luồng đầy đủ (`practice-flow@example.com`, khoảng dòng 419-466), bài nộp phải chứa cả hai chuỗi được trích. Đảm bảo `plainText` gửi lên ở bước submit có chứa `"a school"` và `"a trip"` — nếu chưa, sửa chuỗi đó thành:

```ts
"I went on a trip with a school group and it was memorable."
```

rồi thêm ngay sau assertion về `band` của lần submit:

```ts
      expect(submitted.body.errors).toEqual([
        expect.objectContaining({ category: "article", severity: "error" }),
        expect.objectContaining({ category: "article", severity: "error" }),
      ]);
```

Dùng đúng tên biến response mà test đó đang gán cho lời gọi submit.

- [ ] **Step 8: Run the e2e suite**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand`
Expected: PASS — 27 test cũ vẫn xanh.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/practice/practice.service.ts apps/api/src/practice/practice.service.spec.ts apps/api/test/app.e2e-spec.ts
git commit -m "Extract mistakes alongside grading when a paper is submitted"
```

---

### Task 8: `GET /practice/profile`

**Files:**
- Modify: `apps/api/src/practice/practice.service.ts`
- Create: `apps/api/src/practice/practice-profile.controller.ts`
- Modify: `apps/api/src/practice/practice.module.ts`
- Modify: `apps/api/test/app.e2e-spec.ts`

**Interfaces:**
- Consumes: `summarizeErrors`, `PROFILE_WINDOW`, types `ErrorProfile`, `WritingError` from `@writing-helper/practice`.
- Produces: `PracticeService.profile(userId: string): Promise<ErrorProfile>`; route `GET /practice/profile`.

- [ ] **Step 1: Write the failing e2e test**

Thêm vào `apps/api/test/app.e2e-spec.ts`, bên trong `describe("practice", ...)`. Dùng đúng các helper sẵn có của file: `server()`, `registerUser(email)` trả `{ accessToken }`, và `mockPracticeAi()` (đã có nhánh `practice_errors` từ Task 7).

```ts
    it("chặn hồ sơ lỗi khi chưa đăng nhập", async () => {
      await server().get("/practice/profile").expect(401);
    });

    it("trả hồ sơ rỗng khi chưa nộp bài nào", async () => {
      const { accessToken } = await registerUser("practice-profile-empty@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const response = await server().get("/practice/profile").set(auth).expect(200);

      expect(response.body).toEqual({ tallies: [], attemptsConsidered: 0 });
    });

    it("gộp lỗi của bài đã nộp vào hồ sơ", async () => {
      mockPracticeAi();
      const { accessToken } = await registerUser("practice-profile@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const created = await server()
        .post("/practice/attempts")
        .set(auth)
        .send({ level: "A2", taskType: "email" })
        .expect(201);

      await server()
        .post(`/practice/attempts/${created.body.id}/submit`)
        .set(auth)
        .send({
          styleSnapshot: {},
          plainText: "I went on a trip with a school group and it was memorable.",
          wordCount: 12,
        })
        .expect(201);

      const response = await server().get("/practice/profile").set(auth).expect(200);

      expect(response.body.attemptsConsidered).toBe(1);
      // Hai lỗi cùng nhãn đạt MIN_OCCURRENCES; một bài thì chưa đủ để có trend.
      expect(response.body.tallies).toEqual([
        { category: "article", count: 2, trend: null },
      ]);
    });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand`
Expected: FAIL — 404 trên `/practice/profile`.

- [ ] **Step 3: Add the service method**

Trong `apps/api/src/practice/practice.service.ts`, thêm import:

```ts
import {
  PROFILE_WINDOW,
  summarizeErrors,
  type ErrorProfile,
  type WritingError,
} from "@writing-helper/practice";
```

(gộp vào khối import `@writing-helper/practice` sẵn có)

Thêm method public, đặt ngay sau `list()`:

```ts
  /**
   * Hồ sơ lỗi hay lặp. Tính ở server thay vì đẩy `errors` đầy đủ của 10 bài
   * xuống client — dashboard chỉ cần nhãn và số đếm.
   */
  async profile(userId: string): Promise<ErrorProfile> {
    const rows = await this.prisma.practiceAttempt.findMany({
      where: { userId, submittedAt: { not: null } },
      orderBy: { submittedAt: "desc" },
      take: PROFILE_WINDOW,
      select: { errors: true, wordCount: true, submittedAt: true },
    });

    return summarizeErrors(
      rows
        .filter((row) => Array.isArray(row.errors))
        .map((row) => ({
          errors: row.errors as unknown as WritingError[],
          wordCount: row.wordCount,
          submittedAt: row.submittedAt as Date,
        })),
    );
  }
```

- [ ] **Step 4: Add the controller**

Create `apps/api/src/practice/practice-profile.controller.ts`:

```ts
import { Controller, Get, UseGuards } from "@nestjs/common";
import { CurrentUserId } from "../auth/current-user.decorator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { PracticeService } from "./practice.service";

/**
 * Controller riêng thay vì thêm route vào `PracticeController`: ở đó base path
 * là `practice/attempts` và đã có `@Get(":id")`, nên một `@Get("profile")`
 * cạnh nó sẽ phụ thuộc vào thứ tự khai báo mới khớp đúng. Tách ra thì không có
 * cái bẫy đó.
 */
@Controller("practice")
@UseGuards(JwtAuthGuard)
export class PracticeProfileController {
  constructor(private readonly practice: PracticeService) {}

  @Get("profile")
  profile(@CurrentUserId() userId: string) {
    return this.practice.profile(userId);
  }
}
```

- [ ] **Step 5: Register the controller**

Trong `apps/api/src/practice/practice.module.ts`:

```ts
import { PracticeProfileController } from "./practice-profile.controller";
```

và đổi `controllers` thành:

```ts
  controllers: [PracticeController, PracticeProfileController],
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand`
Expected: PASS — 27 e2e cũ vẫn xanh cộng 3 test mới.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/practice/practice.service.ts apps/api/src/practice/practice-profile.controller.ts apps/api/src/practice/practice.module.ts apps/api/test/app.e2e-spec.ts
git commit -m "Serve the recurring-error profile at GET /practice/profile"
```

---

### Task 9: Tổng quát hoá painter và hit-test sang "mark"

**Files:**
- Create: `apps/web/src/editor/marks.ts`
- Modify: `apps/web/src/editor/highlight-painter.ts`
- Modify: `apps/web/src/editor/highlight-hit.ts`
- Modify: `apps/web/src/editor/highlight-hit.test.ts`
- Modify: `apps/web/src/editor/plugins/AnalysisPlugin.tsx:5,34,52,67`
- Modify: `apps/web/src/editor/Editor.tsx:24,29,169,191,366,374`

**Interfaces:**
- Consumes: `Highlight`, `HighlightType` from `@writing-helper/analysis`; `ErrorSeverity`, `WritingError` from `@writing-helper/practice`.
- Produces: `MarkLayer`, `Mark`, `styleMarks(highlights)`, `errorMarks(errors)` from `./marks`; `paintMarks(index, marks)`, `clearMarks()` from `./highlight-painter`; `findMarkAtOffset<T extends {start,end}>(marks, offset)` from `./highlight-hit`.

- [ ] **Step 1: Write the failing test**

Thay toàn bộ `apps/web/src/editor/highlight-hit.test.ts` bằng phiên bản dùng tên mới, giữ nguyên các ca cũ và thêm một ca cho span lỗi:

```ts
import { describe, expect, it } from "vitest";
import type { Highlight } from "@writing-helper/analysis";
import { findMarkAtOffset } from "./highlight-hit";

const sentence: Highlight = { start: 0, end: 20, type: "hard-sentence" };
const adverb: Highlight = { start: 4, end: 11, type: "adverb" };
const complex: Highlight = { start: 20, end: 27, type: "complex-phrase" };

describe("findMarkAtOffset", () => {
  it("finds the mark under the offset", () => {
    expect(findMarkAtOffset([complex], 22)).toBe(complex);
  });

  it("prefers the narrower mark when they nest", () => {
    expect(findMarkAtOffset([sentence, adverb], 6)).toBe(adverb);
  });

  it("falls back to the wider mark outside the narrow one", () => {
    expect(findMarkAtOffset([sentence, adverb], 15)).toBe(sentence);
  });

  it("treats end as exclusive", () => {
    expect(findMarkAtOffset([adverb], 11)).toBeNull();
  });

  it("treats start as inclusive", () => {
    expect(findMarkAtOffset([adverb], 4)).toBe(adverb);
  });

  it("returns null with no marks", () => {
    expect(findMarkAtOffset([], 5)).toBeNull();
  });

  it("works on any span shape, not just analysis highlights", () => {
    const mistake = { start: 2, end: 11, category: "word-order" as const };
    expect(findMarkAtOffset([mistake], 5)).toBe(mistake);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web test highlight-hit`
Expected: FAIL — `findMarkAtOffset` không tồn tại.

- [ ] **Step 3: Create the mark vocabulary**

Create `apps/web/src/editor/marks.ts`:

```ts
import type { Highlight, HighlightType } from "@writing-helper/analysis";
import type { ErrorSeverity, WritingError } from "@writing-helper/practice";

/**
 * Một lớp vẽ. Hai nguồn span rất khác nhau — rule engine chạy trong trình duyệt
 * và lỗi do model bóc ra — nhưng với painter thì chúng chỉ là span có tên lớp.
 */
export type MarkLayer = HighlightType | ErrorSeverity;

export interface Mark {
  start: number;
  end: number;
  layer: MarkLayer;
}

export const styleMarks = (highlights: Highlight[]): Mark[] =>
  highlights.map((highlight) => ({
    start: highlight.start,
    end: highlight.end,
    layer: highlight.type,
  }));

export const errorMarks = (errors: WritingError[]): Mark[] =>
  errors.map((error) => ({ start: error.start, end: error.end, layer: error.severity }));
```

- [ ] **Step 4: Generalise the painter**

Thay toàn bộ `apps/web/src/editor/highlight-painter.ts`:

```ts
import { rangeFor, type TextIndex } from "./text-index";
import type { Mark, MarkLayer } from "./marks";

/**
 * Tô bằng CSS Custom Highlight API: trình duyệt vẽ trực tiếp lên range, không
 * cần chèn thẻ nào vào DOM.
 *
 * Đổi lại là highlight không bắt được sự kiện chuột — việc đó do
 * `highlight-hit.ts` lo bằng cách dò con trỏ.
 */

const REGISTRY_PREFIX = "wh-";

/** Highlight cấp câu vẽ dưới, cấp từ vẽ đè, lỗi vẽ trên cùng. */
const SENTENCE_LAYERS = new Set<MarkLayer>(["hard-sentence", "very-hard-sentence"]);
const ERROR_LAYERS = new Set<MarkLayer>(["error", "refinement"]);

const ALL_LAYERS: MarkLayer[] = [
  "very-hard-sentence",
  "hard-sentence",
  "passive",
  "adverb",
  "qualifier",
  "complex-phrase",
  "refinement",
  "error",
];

function priorityOf(layer: MarkLayer): number {
  if (SENTENCE_LAYERS.has(layer)) return 0;
  if (ERROR_LAYERS.has(layer)) return 2;
  return 1;
}

export function highlightsSupported(): boolean {
  return typeof CSS !== "undefined" && "highlights" in CSS;
}

export function paintMarks(index: TextIndex, marks: Mark[]): void {
  if (!highlightsSupported()) return;

  const byLayer = new Map<MarkLayer, Range[]>();

  for (const mark of marks) {
    const range = rangeFor(index, mark.start, mark.end);
    if (!range) continue;

    const ranges = byLayer.get(mark.layer);
    if (ranges) ranges.push(range);
    else byLayer.set(mark.layer, [range]);
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

export function clearMarks(): void {
  if (!highlightsSupported()) return;

  for (const layer of ALL_LAYERS) CSS.highlights.delete(REGISTRY_PREFIX + layer);
}
```

- [ ] **Step 5: Generalise the hit test**

Trong `apps/web/src/editor/highlight-hit.ts`, xoá dòng import `Highlight as TextHighlight` và thay hàm `findHighlightAtOffset` bằng:

```ts
/**
 * Mark tại một offset. Khi nhiều mark lồng nhau (trạng từ nằm trong câu khó),
 * trả về cái hẹp nhất — lời khuyên cụ thể hơn.
 *
 * Generic theo span để dùng được cho cả highlight văn phong lẫn lỗi ngôn ngữ,
 * mà caller vẫn nhận lại đúng kiểu mình truyền vào.
 */
export function findMarkAtOffset<T extends { start: number; end: number }>(
  marks: T[],
  offset: number,
): T | null {
  let best: T | null = null;

  for (const mark of marks) {
    if (offset < mark.start || offset >= mark.end) continue;

    const width = mark.end - mark.start;
    if (!best || width < best.end - best.start) best = mark;
  }

  return best;
}
```

- [ ] **Step 6: Update the two call sites**

Trong `apps/web/src/editor/plugins/AnalysisPlugin.tsx`:
- dòng 5: `import { clearMarks, paintMarks } from "../highlight-painter";` và thêm `import { styleMarks } from "../marks";`
- dòng 34: `clearHighlights()` → `clearMarks()`
- dòng 52: `paintHighlights(index, result.highlights)` → `paintMarks(index, styleMarks(result.highlights))`
- dòng 67: `useEffect(() => clearHighlights, [])` → `useEffect(() => clearMarks, [])`

Trong `apps/web/src/editor/Editor.tsx`:
- dòng 24: `import { findMarkAtOffset, offsetAtPoint } from "./highlight-hit";`
- dòng 29: `import { clearMarks, paintMarks } from "./highlight-painter";` và thêm `import { styleMarks } from "./marks";`
- dòng 169 và 191: `findHighlightAtOffset(highlights, offset)` → `findMarkAtOffset(highlights, offset)`
- dòng 366: `paintHighlights(index, result.highlights)` → `paintMarks(index, styleMarks(result.highlights))`
- dòng 374: `clearHighlights()` → `clearMarks()`

- [ ] **Step 7: Run the web suite**

Run: `pnpm --filter @writing-helper/web test`
Expected: PASS — 51 test cũ cộng ca mới; không còn tham chiếu nào tới tên cũ.

- [ ] **Step 8: Typecheck**

Run: `pnpm --filter @writing-helper/web typecheck`
Expected: sạch.

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/editor/marks.ts apps/web/src/editor/highlight-painter.ts apps/web/src/editor/highlight-hit.ts apps/web/src/editor/highlight-hit.test.ts apps/web/src/editor/plugins/AnalysisPlugin.tsx apps/web/src/editor/Editor.tsx
git commit -m "Generalise the painter and hit test from highlights to marks"
```

---

### Task 10: Vẽ lỗi trong Editor

**Files:**
- Modify: `apps/web/src/index.css`
- Modify: `apps/web/src/api/practice.ts`
- Modify: `apps/web/src/editor/Editor.tsx`

**Interfaces:**
- Consumes: `errorMarks`, `paintMarks`, `clearMarks`, `findMarkAtOffset` (Task 9); `ERROR_LABELS`, `WritingError` from `@writing-helper/practice`.
- Produces: `Editor` nhận prop `savedErrors?: WritingError[] | null`; `PracticeAttemptDetail.errors: WritingError[] | null`.

- [ ] **Step 1: Add the two error layers to CSS**

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

- [ ] **Step 2: Add `errors` to the API client**

Trong `apps/web/src/api/practice.ts`:
- thêm `WritingError` vào import type từ `@writing-helper/practice`
- thêm vào `PracticeAttemptDetail`:

```ts
  errors: WritingError[] | null;
```

- [ ] **Step 3: Teach the Editor to paint errors**

Trong `apps/web/src/editor/Editor.tsx`:

Thêm import:

```ts
import { ERROR_LABELS, type WritingError } from "@writing-helper/practice";
import { errorMarks } from "./marks";
```

Thêm vào `EditorProps` (và `EditorBodyProps`, cùng phần truyền xuống trong `Editor`):

```ts
  /** Paint stored mistakes instead of style highlights (results view). */
  savedErrors?: WritingError[] | null;
```

Trong `EditorBody`, nhận `savedErrors = null` và thêm state cùng ref:

```ts
  const errorsRef = useRef<{ index: TextIndex | null; errors: WritingError[] }>({
    index: null,
    errors: [],
  });
  const [errorPick, setErrorPick] = useState<{ error: WritingError; x: number; y: number } | null>(null);
```

Ở đầu `handleClick`, **trước** dòng `if (readOnly || !aiEnabled) return;`, chèn:

```ts
    // Lăng kính lỗi chạy được cả khi read-only, nên phải xử lý trước guard của
    // AI rewrite.
    if (savedErrors) {
      const { index, errors } = errorsRef.current;
      if (!index) return;

      const offset = offsetAtPoint(index, event.clientX, event.clientY);
      const found = offset === null ? null : findMarkAtOffset(errors, offset);

      setErrorPick(found ? { error: found, ...containerPoint(event.clientX, event.clientY) } : null);
      return;
    }
```

Thêm plugin vào cây render, ngay sau dòng `{savedResult && <SavedHighlightsPlugin ... />}`:

```tsx
      {savedErrors && (
        <SavedErrorsPlugin
          errors={savedErrors}
          onReady={(index) => {
            errorsRef.current = { index, errors: savedErrors };
          }}
        />
      )}
```

Thêm overlay, ngay sau `{hover && !popover && <HighlightTooltip hover={hover} />}`:

```tsx
        {errorPick && <ErrorCard pick={errorPick} />}
```

Thêm hai component ở cuối file:

```tsx
function ErrorCard({
  pick,
}: {
  pick: { error: WritingError; x: number; y: number };
}) {
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
        {ERROR_LABELS[pick.error.category]}
      </p>
      <p className="mt-1 font-display text-base leading-snug">{pick.error.correction}</p>
      <p className="mt-1 text-sm leading-snug text-ink-soft">{pick.error.explain}</p>
    </div>
  );
}

function SavedErrorsPlugin({
  errors,
  onReady,
}: {
  errors: WritingError[];
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
      paintMarks(index, errorMarks(errors));
      onReadyRef.current(index);
    };

    paint();
    const unregister = editor.registerUpdateListener(paint);
    return () => {
      unregister();
      clearMarks();
    };
  }, [editor, errors]);

  return null;
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @writing-helper/web typecheck`
Expected: sạch.

- [ ] **Step 5: Run the web suite**

Run: `pnpm --filter @writing-helper/web test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/index.css apps/web/src/api/practice.ts apps/web/src/editor/Editor.tsx
git commit -m "Paint resolved mistakes in the editor and open a card on click"
```

---

### Task 11: Màn kết quả — hai lăng kính và "Fix these first"

**Files:**
- Create: `apps/web/src/practice/FixTheseFirst.tsx`
- Create: `apps/web/src/practice/FixTheseFirst.test.tsx`
- Modify: `apps/web/src/pages/PracticeAttemptPage.tsx:242-297`

**Interfaces:**
- Consumes: `focusCategories`, `ERROR_LABELS`, `WritingError` from `@writing-helper/practice`; `Editor` prop `savedErrors` (Task 10).
- Produces: `<FixTheseFirst errors={...} />`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/practice/FixTheseFirst.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ErrorCategory, WritingError } from "@writing-helper/practice";
import { FixTheseFirst } from "./FixTheseFirst";

function err(category: ErrorCategory): WritingError {
  return { start: 0, end: 1, category, severity: "error", correction: "x", explain: "y" };
}

describe("FixTheseFirst", () => {
  it("names the most common error-tier categories", () => {
    render(<FixTheseFirst errors={[err("article"), err("article"), err("spelling")]} />);
    expect(screen.getByText("Articles")).toBeInTheDocument();
    expect(screen.getByText("Spelling")).toBeInTheDocument();
  });

  it("says so when the paper has no mistakes", () => {
    render(<FixTheseFirst errors={[]} />);
    expect(screen.getByText(/nothing to fix/i)).toBeInTheDocument();
  });

  it("renders nothing when extraction failed", () => {
    const { container } = render(<FixTheseFirst errors={null} />);
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
import { ERROR_LABELS, focusCategories, type WritingError } from "@writing-helper/practice";

/**
 * Điểm bắt đầu cho người học: bài có 30 chỗ gạch thì không ai biết sửa từ đâu.
 * `null` nghĩa là bóc lỗi thất bại — im lặng, khác hẳn với "bài sạch lỗi".
 */
export function FixTheseFirst({ errors }: { errors: WritingError[] | null }) {
  if (!errors) return null;

  const focus = focusCategories(errors);

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
              {ERROR_LABELS[category]}
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

Trong `apps/web/src/pages/PracticeAttemptPage.tsx`, thêm import:

```ts
import { useState } from "react";
import { FixTheseFirst } from "../practice/FixTheseFirst";
```

(`useState` có thể đã được import — gộp lại, đừng nhân đôi.)

Thay thân `ResultView` bằng:

```tsx
type Lens = "mistakes" | "style";

function ResultView({ attempt, spec }: { attempt: PracticeAttemptDetail; spec: TaskSpec }) {
  const snapshot = attempt.styleSnapshot;
  // Mặc định lăng kính lỗi: đó là thứ người học sửa được ngay.
  const [lens, setLens] = useState<Lens>("mistakes");

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-4 border-b border-rule px-6 py-3">
        <BrandLockup to="/practice" />
        <span className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          {spec.label}
        </span>
        <div className="ml-auto flex border border-rule font-mono text-[0.65rem] uppercase tracking-[0.15em]">
          {(["mistakes", "style"] as Lens[]).map((option) => (
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
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="prompt-scroll w-[22rem] shrink-0 overflow-y-auto border-r border-rule bg-paper-deep px-6 py-8">
          {attempt.band !== null && (
            <div className="mb-8">
              <BandStamp band={attempt.band} />
            </div>
          )}

          {attempt.scores && attempt.feedback && (
            <CriteriaBars scores={attempt.scores} feedback={attempt.feedback} />
          )}

          {attempt.feedback && (
            <section className="mt-8 border-t border-rule pt-6">
              <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-vermilion">
                Next time
              </h2>
              <p className="mt-3 font-display text-lg leading-snug">{attempt.feedback.nextFocus}</p>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{attempt.feedback.overview}</p>
            </section>
          )}

          <FixTheseFirst errors={attempt.errors} />

          {snapshot && (
            <div className="mt-8 border-t border-rule pt-6">
              <StyleProfile snapshot={snapshot} level={attempt.level} />
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/*
            Hai lăng kính loại trừ nhau: vẽ cả gạch lỗi lẫn nền văn phong lên
            cùng một bài thì vừa rối vừa mâu thuẫn — Hemingway thưởng câu ngắn,
            IELTS thưởng câu phức.
          */}
          <Editor
            key={`${attempt.id}-${lens}`}
            mode="edit"
            readOnly
            savedResult={lens === "style" ? snapshot : null}
            savedErrors={lens === "mistakes" ? attempt.errors : null}
            initialEditorState={attempt.content}
            onChange={() => undefined}
            onAnalysis={() => undefined}
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Run the web suite and typecheck**

Run: `pnpm --filter @writing-helper/web test && pnpm --filter @writing-helper/web typecheck`
Expected: PASS, typecheck sạch.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/practice/FixTheseFirst.tsx apps/web/src/practice/FixTheseFirst.test.tsx apps/web/src/pages/PracticeAttemptPage.tsx
git commit -m "Show mistakes and style as two lenses on the results screen"
```

---

### Task 12: Hồ sơ lỗi ở dashboard và phòng thi

**Files:**
- Modify: `apps/web/src/api/practice.ts`
- Create: `apps/web/src/practice/RecurringErrors.tsx`
- Create: `apps/web/src/practice/RecurringErrors.test.tsx`
- Modify: `apps/web/src/pages/PracticePage.tsx`
- Modify: `apps/web/src/pages/PracticeAttemptPage.tsx` (`PromptPane`)

**Interfaces:**
- Consumes: `GET /practice/profile` (Task 8); `ERROR_LABELS`, `ErrorProfile` from `@writing-helper/practice`.
- Produces: `getErrorProfile(): Promise<ErrorProfile>`; `<RecurringErrors profile={...} />`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/practice/RecurringErrors.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ErrorProfile } from "@writing-helper/practice";
import { RecurringErrors } from "./RecurringErrors";

const profile: ErrorProfile = {
  attemptsConsidered: 6,
  tallies: [
    { category: "article", count: 9, trend: "down" },
    { category: "verb-tense", count: 4, trend: "flat" },
    { category: "spelling", count: 2, trend: "up" },
  ],
};

describe("RecurringErrors", () => {
  it("lists categories with their counts", () => {
    render(<RecurringErrors profile={profile} />);
    expect(screen.getByText("Articles")).toBeInTheDocument();
    expect(screen.getByText("9")).toBeInTheDocument();
  });

  it("shows a direction for each tally", () => {
    render(<RecurringErrors profile={profile} />);
    expect(screen.getByLabelText("down")).toBeInTheDocument();
    expect(screen.getByLabelText("up")).toBeInTheDocument();
  });

  it("renders nothing when there is no pattern yet", () => {
    const { container } = render(
      <RecurringErrors profile={{ tallies: [], attemptsConsidered: 1 }} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the profile is loading", () => {
    const { container } = render(<RecurringErrors profile={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web test RecurringErrors`
Expected: FAIL — cannot resolve `./RecurringErrors`.

- [ ] **Step 3: Add the API client call**

Trong `apps/web/src/api/practice.ts`, thêm `ErrorProfile` vào import type từ `@writing-helper/practice` và thêm ở cuối:

```ts
export const getErrorProfile = () => apiFetch<ErrorProfile>("/practice/profile");
```

- [ ] **Step 4: Write the component**

Create `apps/web/src/practice/RecurringErrors.tsx`:

```tsx
import { ERROR_LABELS, type ErrorProfile, type ErrorTally } from "@writing-helper/practice";

const ARROW: Record<NonNullable<ErrorTally["trend"]>, string> = {
  down: "↓",
  flat: "→",
  up: "↑",
};

/**
 * Ẩn hẳn khi chưa có pattern nào — một ô rỗng nói "chưa đủ dữ liệu" chỉ làm
 * dashboard ồn thêm mà không cho người học việc gì để làm.
 */
export function RecurringErrors({ profile }: { profile: ErrorProfile | undefined }) {
  if (!profile || profile.tallies.length === 0) return null;

  return (
    <section className="mt-10">
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Recurring
      </h2>
      <ul className="mt-3 space-y-2">
        {profile.tallies.slice(0, 5).map((tally) => (
          <li key={tally.category} className="flex items-baseline gap-3">
            <span className="font-display text-lg">{ERROR_LABELS[tally.category]}</span>
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

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @writing-helper/web test RecurringErrors`
Expected: PASS — 4 tests.

- [ ] **Step 6: Wire it into the dashboard**

Trong `apps/web/src/pages/PracticePage.tsx`:
- thêm `getErrorProfile` vào import từ `../api/practice`
- thêm `import { RecurringErrors } from "../practice/RecurringErrors";`
- thêm query cạnh `attempts`:

```ts
  const profile = useQuery({ queryKey: ["practice-profile"], queryFn: getErrorProfile });
```

- render `<RecurringErrors profile={profile.data} />` ngay sau `<StreakStrip ... />` trong JSX.

- [ ] **Step 7: Add the reminder to the exam room**

Trong `apps/web/src/pages/PracticeAttemptPage.tsx`:
- thêm `getErrorProfile` vào import từ `../api/practice`
- thêm `ERROR_LABELS` và `type ErrorCategory` vào import sẵn có từ `@writing-helper/practice`
- `useQuery` đã được import ở file này cho `attempt` — dùng lại, đừng nhân đôi
- trong `ExamRoom`, thêm query và truyền xuống `PromptPane`:

```ts
  const profile = useQuery({ queryKey: ["practice-profile"], queryFn: getErrorProfile });
```

```tsx
        <PromptPane
          attempt={attempt}
          spec={spec}
          hintsOpen={hintsOpen}
          onOpenHints={openHints}
          watchFor={(profile.data?.tallies ?? []).slice(0, 3).map((tally) => tally.category)}
        />
```

- thêm `watchFor: ErrorCategory[]` vào props của `PromptPane` và render ở cuối `<aside>`, sau khối hints:

```tsx
      {watchFor.length > 0 && (
        <p className="mt-8 border-t border-rule pt-6 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          Watch for: {watchFor.map((category) => ERROR_LABELS[category]).join(", ")}
        </p>
      )}
```

Không gate như hints và không ghi cờ nào: nhắc lỗi nói về điểm yếu của chính người viết, không tiết lộ gì về nội dung bài.

- [ ] **Step 8: Run everything**

Run: `pnpm test && pnpm lint`
Expected: toàn bộ suite xanh, lint sạch.

- [ ] **Step 9: Verify in the browser**

Chạy `docker compose up -d postgres`, rồi mở preview qua launch config `writing-helper`. Đăng nhập, nộp một bài thật, và kiểm bằng mắt:
- Màn kết quả mặc định ở lăng kính `mistakes`, có gạch sóng đỏ và gạch chấm mờ.
- Click vào một chỗ gạch → hiện thẻ có nhãn, câu sửa, giải thích.
- Chuyển sang `style` → gạch lỗi biến mất, highlight Hemingway hiện lên.
- Ô `Fix these first` liệt kê tối đa ba nhóm.
- Sau vài bài, dashboard hiện mục `Recurring`, và phòng thi hiện dòng `Watch for:`.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/api/practice.ts apps/web/src/practice/RecurringErrors.tsx apps/web/src/practice/RecurringErrors.test.tsx apps/web/src/pages/PracticePage.tsx apps/web/src/pages/PracticeAttemptPage.tsx
git commit -m "Surface the recurring-error profile on the dashboard and in the exam room"
```

---

## Rủi ro cần theo dõi khi triển khai

- **Tỉ lệ trích sai của model.** Sau khi Task 7 chạy được với AI thật, log số lỗi bị `resolveErrors` bỏ trên vài bài dài. Rơi nhiều thì cân nhắc dò gần đúng (chuẩn hoá khoảng trắng, bỏ phân biệt hoa thường) trước khi bỏ hẳn — nhưng chỉ làm khi đo được, không làm phòng xa.
- **Chi phí.** Mỗi lần nộp giờ tốn hai lời gọi. Đo token thật ở Task 7 trên một bài 300 từ trước khi làm tiếp UI.
- **`text-decoration` trong `::highlight()`.** Được spec hỗ trợ nhưng ít dùng. Nếu Safari không vẽ gạch sóng, đổi `wh-error` sang nền `--color-vermilion-soft` và giữ `wh-refinement` gạch chấm — vẫn phân biệt được hai tầng, chỉ khác cách thể hiện.
