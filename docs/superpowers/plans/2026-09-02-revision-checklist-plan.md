# Checklist lỗi trong phòng sửa bài — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [../specs/2026-09-02-revision-checklist-design.md](../specs/2026-09-02-revision-checklist-design.md)

**Goal:** Thay gạch chân trên bài đang sửa bằng một checklist trong panel — liệt kê từng lỗi của bài gốc, đánh dấu được, lưu lại — để người học không mất danh sách việc ngay khi gõ phím đầu tiên.

**Architecture:** Không có gì định vị bằng offset nữa, nên không có gì lệch được. Checklist đọc `marks` của bài gốc (đã có sẵn qua query parent mà `ExamRoom` đang dùng cho `Previous feedback`), cắt đoạn chữ gốc từ `parent.plainText`, và ghi trạng thái vào một cột mới trên **bản sửa** qua đúng route `PATCH` autosave sẵn có. Việc gỡ gạch chân khỏi phòng sửa đồng thời xoá luôn cơ chế `liveText`/`carriedMarks` vốn chỉ tồn tại để chống lệch offset.

**Tech Stack:** pnpm workspaces, TypeScript, NestJS 11 + Prisma 7 (Postgres), React 18 + Vite + Lexical, Vitest (packages + web), Jest (api), Tailwind v4.

## Global Constraints

- `packages/analysis` **không được sửa**.
- `Editor` giữ nguyên prop `savedMarks` và hành vi vẽ mark — màn kết quả vẫn dùng. Chỉ `ExamRoom` thôi truyền nó.
- `ResultView` (màn kết quả) **không được sửa**.
- `Previous feedback`, hints, và dòng `Watch for` trong `PromptPane` **giữ nguyên**.
- `packages/practice` không import React, HTTP client, hay Prisma.
- Mọi chuỗi hiển thị bằng **tiếng Anh** — repo có test `no-vietnamese-display` chặn chuỗi tiếng Việt lọt vào UI. Chú thích code tiếng Việt là bình thường, giữ nguyên.
- Khoá định danh mark là `"start:end"`, đúng khoá `resolveWritingMarks` dùng để chống trùng span.
- Sau mỗi task: chạy test liên quan, commit riêng.

---

### Task 1: `markKey` và `countHandled` trong `packages/practice`

**Files:**
- Create: `packages/practice/src/handled-marks.ts`
- Create: `packages/practice/src/handled-marks.test.ts`
- Modify: `packages/practice/src/index.ts`

**Interfaces:**
- Consumes: type `WritingMark { start, end, category, severity, correction, note }` từ `./types`.
- Produces: `markKey(mark: Pick<WritingMark, "start" | "end">): string`; `countHandled(marks: WritingMark[], handled: string[]): { handled: number; total: number }`.

- [x] **Step 1: Write the failing test**

Create `packages/practice/src/handled-marks.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { countHandled, markKey } from "./handled-marks";
import type { WritingMark } from "./types";

function mark(start: number, end: number): WritingMark {
  return { start, end, category: "article", severity: "error", correction: "x", note: "y" };
}

describe("markKey", () => {
  it("identifies a mark by its span", () => {
    expect(markKey(mark(2, 11))).toBe("2:11");
  });

  it("gives two marks on different spans different keys", () => {
    expect(markKey(mark(2, 11))).not.toBe(markKey(mark(2, 12)));
  });
});

describe("countHandled", () => {
  it("counts nothing handled on a fresh revision", () => {
    expect(countHandled([mark(0, 3), mark(5, 9)], [])).toEqual({ handled: 0, total: 2 });
  });

  it("counts the marks whose keys are listed", () => {
    expect(countHandled([mark(0, 3), mark(5, 9)], ["0:3"])).toEqual({ handled: 1, total: 2 });
  });

  it("counts every mark when all are handled", () => {
    expect(countHandled([mark(0, 3), mark(5, 9)], ["0:3", "5:9"])).toEqual({
      handled: 2,
      total: 2,
    });
  });

  /**
   * A stored key can outlive the mark it referred to if a paper is ever
   * re-marked. It must not inflate the count past the marks that exist.
   */
  it("ignores a stored key that matches no current mark", () => {
    expect(countHandled([mark(0, 3)], ["0:3", "99:105"])).toEqual({ handled: 1, total: 1 });
  });

  it("reports zero of zero for a paper with no marks", () => {
    expect(countHandled([], ["0:3"])).toEqual({ handled: 0, total: 0 });
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/practice test handled-marks`
Expected: FAIL — cannot resolve `./handled-marks`.

- [x] **Step 3: Write the implementation**

Create `packages/practice/src/handled-marks.ts`:

```ts
import type { WritingMark } from "./types";

/**
 * Định danh một mark trong phạm vi một bài. Dùng span vì `resolveWritingMarks`
 * đã bỏ mark trùng span y hệt, nên khoá này duy nhất theo cách dựng — và mark
 * của một bài đã nộp thì không đổi nữa, nên nó ổn định.
 */
export function markKey(mark: Pick<WritingMark, "start" | "end">): string {
  return `${mark.start}:${mark.end}`;
}

/**
 * Bao nhiêu mark đã được đánh dấu xử lý, trên tổng số. Đếm theo mark hiện có
 * chứ không theo số khoá đã lưu: khoá cũ không khớp mark nào thì bỏ qua, để
 * không bao giờ đếm vượt tổng.
 */
export function countHandled(
  marks: WritingMark[],
  handled: string[],
): { handled: number; total: number } {
  const keys = new Set(handled);
  return {
    handled: marks.filter((mark) => keys.has(markKey(mark))).length,
    total: marks.length,
  };
}
```

- [x] **Step 4: Export and run tests**

In `packages/practice/src/index.ts` add beside the other value exports:

```ts
export { countHandled, markKey } from "./handled-marks";
```

Run: `pnpm --filter @writing-helper/practice test`
Expected: PASS — 6 new tests plus every existing one.

- [x] **Step 5: Commit**

```bash
git add packages/practice/src/handled-marks.ts packages/practice/src/handled-marks.test.ts packages/practice/src/index.ts
git commit -m "Add markKey and countHandled for the revision checklist"
```

---

### Task 2: Cột `handledMarks` trên `PracticeAttempt`

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_attempt_handled_marks/migration.sql` (do `prisma migrate dev` sinh ra)

**Interfaces:**
- Consumes: nothing.
- Produces: `PracticeAttempt.handledMarks` kiểu `Json?`, đọc ra là `string[] | null`.

- [x] **Step 1: Add the column to the schema**

Trong `apps/api/prisma/schema.prisma`, model `PracticeAttempt`, thêm ngay dưới dòng `marks Json?`:

```prisma
  /// string[] khoá "start:end" của mark thuộc bài gốc mà bản sửa này đã xử lý.
  /// Đặt trên bản sửa vì đây là tiến độ của lượt sửa, không phải thuộc tính bài gốc.
  handledMarks Json?
```

- [x] **Step 2: Make sure Postgres is running**

Run: `docker start writing-helper-db`
Expected: prints the container name; it is already healthy from earlier work. Do NOT use `docker compose up` — it conflicts on the container name across checkouts.

- [x] **Step 3: Generate and apply the migration**

Run: `cd apps/api && npx prisma migrate dev --name attempt_handled_marks`
Expected: a new migration directory, and "Your database is now in sync with your schema."

- [x] **Step 4: Verify migration state is clean**

Run: `cd apps/api && npx prisma migrate status`
Expected: "Database schema is up to date!"

- [x] **Step 5: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "Add handledMarks column to PracticeAttempt"
```

---

### Task 3: `PATCH` chấp nhận `handledMarks`

**Files:**
- Modify: `apps/api/src/practice/dto/practice.dto.ts` (class `UpdateAttemptDto`)
- Modify: `apps/api/src/practice/practice.service.ts` (method `update`)
- Modify: `apps/api/src/practice/practice.service.spec.ts` (bên trong `describe("update")`)
- Modify: `apps/api/test/app.e2e-spec.ts`

**Interfaces:**
- Consumes: cột `handledMarks` (Task 2).
- Produces: `UpdateAttemptDto.handledMarks?: string[]`; `update()` ghi nó vào DB.

**Ghi chú về code sẵn có:** `update()` đã chặn bài đã nộp bằng `ConflictException` và ghi từng trường bằng spread có điều kiện. Không đụng vào phần đó. `UpdateAttemptDto` đã import `IsOptional`, `IsString` từ `class-validator`; `IsArray` thì chưa — thêm vào cùng dòng import.

**File spec hiện KHÔNG có `describe("update")`** — nó chỉ có `create`, `findOne`, `remove`, `submit`, `list`, `revise`. Bạn tạo mới khối này. Fixture `draft` trong `describe("submit")` nằm trong scope của khối đó, không dùng lại được — khai báo fixture riêng như dưới.

- [x] **Step 1: Write the failing tests**

Thêm một khối mới vào `apps/api/src/practice/practice.service.spec.ts`, đặt sau `describe("findOne", ...)` (giữ thứ tự khối gần với thứ tự vòng đời):

```ts
  describe("update", () => {
    const editable = {
      id: "a1",
      userId: "user-1",
      level: "A2",
      taskType: "email",
      prompt: "Write to your teacher.",
      plainText: "Dear teacher, ...",
      wordCount: 95,
      startedAt: new Date("2026-08-25T10:00:00Z"),
      submittedAt: null,
    };

    it("stores the handled-mark keys", async () => {
      const { service, prisma } = serviceWith({ attempt: editable });

      await service.update("user-1", "a1", { handledMarks: ["2:11", "20:26"] });

      expect(prisma.practiceAttempt.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ handledMarks: ["2:11", "20:26"] }),
        }),
      );
    });

    /** Bỏ đánh dấu cái cuối cùng gửi lên mảng rỗng — phải ghi, không phải bỏ qua. */
    it("stores an empty list when the last mark is unticked", async () => {
      const { service, prisma } = serviceWith({ attempt: editable });

      await service.update("user-1", "a1", { handledMarks: [] });

      const { data } = prisma.practiceAttempt.update.mock.calls[0][0];
      expect(data.handledMarks).toEqual([]);
    });

    it("leaves handledMarks alone when the autosave does not mention it", async () => {
      const { service, prisma } = serviceWith({ attempt: editable });

      await service.update("user-1", "a1", { plainText: "just the text" });

      const { data } = prisma.practiceAttempt.update.mock.calls[0][0];
      expect(data).not.toHaveProperty("handledMarks");
    });

    it("refuses to touch a submitted paper", async () => {
      const { service } = serviceWith({ attempt: { ...editable, submittedAt: new Date() } });

      await expect(
        service.update("user-1", "a1", { handledMarks: ["2:11"] }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });
```

`ConflictException` đã được import ở đầu file spec — không thêm import trùng.

- [x] **Step 2: Run tests to verify they fail**

Run: `cd apps/api && npx jest src/practice/practice.service.spec.ts`
Expected: FAIL — `data.handledMarks` is undefined in the first test.

- [x] **Step 3: Add the DTO field**

Trong `apps/api/src/practice/dto/practice.dto.ts`, thêm `IsArray` vào import từ `class-validator`, rồi thêm vào cuối `UpdateAttemptDto`:

```ts
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  handledMarks?: string[];
```

- [x] **Step 4: Write it in the service**

Trong `apps/api/src/practice/practice.service.ts`, trong object `data` của `update()`, thêm ngay sau dòng `hintsOpened`:

```ts
        ...(dto.handledMarks !== undefined && {
          handledMarks: dto.handledMarks as unknown as Prisma.InputJsonValue,
        }),
```

Dùng `!== undefined` chứ không phải kiểm truthy: mảng rỗng là giá trị hợp lệ (bỏ đánh dấu hết) và phải được ghi.

- [x] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && npx jest src/practice`
Expected: PASS — kể cả các test `update` cũ.

- [x] **Step 6: Add e2e coverage**

Trong `apps/api/test/app.e2e-spec.ts`, `describe("practice", ...)`, thêm test dùng đúng helper sẵn có (`server()`, `registerUser(email)` trả `{ accessToken }`, `mockPracticeAi()`):

```ts
    it("lưu và trả lại handledMarks qua autosave", async () => {
      mockPracticeAi();
      const { accessToken } = await registerUser("handled-marks@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const created = await server()
        .post("/practice/attempts")
        .set(auth)
        .send({ level: "A2", taskType: "email" })
        .expect(201);

      await server()
        .patch(`/practice/attempts/${created.body.id}`)
        .set(auth)
        .send({ handledMarks: ["2:11"] })
        .expect(200);

      const fetched = await server()
        .get(`/practice/attempts/${created.body.id}`)
        .set(auth)
        .expect(200);

      expect(fetched.body.handledMarks).toEqual(["2:11"]);
    });

    it("từ chối handledMarks không phải mảng chuỗi", async () => {
      const { accessToken } = await registerUser("handled-marks-bad@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const created = await server()
        .post("/practice/attempts")
        .set(auth)
        .send({ level: "A2", taskType: "email" })
        .expect(201);

      await server()
        .patch(`/practice/attempts/${created.body.id}`)
        .set(auth)
        .send({ handledMarks: [1, 2] })
        .expect(400);
    });
```

Test thứ hai cần `mockPracticeAi()` cho lời gọi tạo đề — nếu nó nằm ngoài phạm vi mock sẵn có, gọi `mockPracticeAi()` ở đầu test đó luôn.

- [x] **Step 7: Run the e2e suite**

Run: `cd apps/api && npx jest --config ./test/jest-e2e.json --runInBand`
Expected: PASS — toàn bộ e2e cũ vẫn xanh cộng 2 test mới.

- [x] **Step 8: Commit**

```bash
git add apps/api/src/practice/dto/practice.dto.ts apps/api/src/practice/practice.service.ts apps/api/src/practice/practice.service.spec.ts apps/api/test/app.e2e-spec.ts
git commit -m "Accept handledMarks on the practice autosave route"
```

---

### Task 4: Component checklist

**Files:**
- Create: `apps/web/src/practice/RevisionChecklist.tsx`
- Create: `apps/web/src/practice/RevisionChecklist.test.tsx`

**Interfaces:**
- Consumes: `countHandled`, `markKey`, `MARK_LABELS`, type `WritingMark` từ `@writing-helper/practice`.
- Produces: `<RevisionChecklist marks={...} parentPlainText={...} handled={...} onToggle={...} />` với props:
  - `marks: WritingMark[]`
  - `parentPlainText: string`
  - `handled: string[]`
  - `onToggle: (key: string) => void`

**Vì sao cần `parentPlainText`:** `WritingMark` chỉ lưu `start`/`end`, **không lưu đoạn trích**. Đoạn chữ gốc phải cắt ra bằng `parentPlainText.slice(mark.start, mark.end)`.

- [x] **Step 1: Write the failing test**

Create `apps/web/src/practice/RevisionChecklist.test.tsx`:

```tsx
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { WritingMark } from "@writing-helper/practice";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RevisionChecklist } from "./RevisionChecklist";

const TEXT = "I have many idea for we to do together.";

const marks: WritingMark[] = [
  {
    start: 7,
    end: 16,
    category: "noun-number",
    severity: "error",
    correction: "many ideas",
    note: "Use the plural after 'many'.",
  },
  {
    start: 17,
    end: 23,
    category: "pronoun",
    severity: "error",
    correction: "for us",
    note: "'We' is a subject pronoun; after a preposition use 'us'.",
  },
];

function renderList(overrides: Partial<Parameters<typeof RevisionChecklist>[0]> = {}) {
  return render(
    <RevisionChecklist
      marks={marks}
      parentPlainText={TEXT}
      handled={[]}
      onToggle={() => undefined}
      {...overrides}
    />,
  );
}

afterEach(() => {
  cleanup();
});

describe("RevisionChecklist", () => {
  it("shows the original wording cut from the paper, not the offsets", () => {
    renderList();

    expect(screen.getByText("many idea")).toBeInTheDocument();
    expect(screen.getByText("for we")).toBeInTheDocument();
  });

  it("shows the correction and the category label for each mark", () => {
    renderList();

    expect(screen.getByText("many ideas")).toBeInTheDocument();
    expect(screen.getByText("Singular / plural")).toBeInTheDocument();
    expect(screen.getByText("Pronouns")).toBeInTheDocument();
  });

  it("keeps the note hidden until the row is opened", async () => {
    renderList();

    expect(screen.queryByText("Use the plural after 'many'.")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /many idea/i }));

    expect(screen.getByText("Use the plural after 'many'.")).toBeInTheDocument();
  });

  it("counts how many are done in the heading", () => {
    renderList({ handled: ["7:16"] });

    expect(screen.getByText(/1\s*\/\s*2/)).toBeInTheDocument();
  });

  it("marks a handled row as done and leaves the others alone", () => {
    renderList({ handled: ["7:16"] });

    expect(screen.getByRole("checkbox", { name: /many idea/i })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: /for we/i })).not.toBeChecked();
  });

  it("reports the key of the row that was ticked", async () => {
    const onToggle = vi.fn();
    renderList({ onToggle });

    await userEvent.click(screen.getByRole("checkbox", { name: /for we/i }));

    expect(onToggle).toHaveBeenCalledWith("17:23");
  });

  it("keeps rows in paper order so they can be followed down the text", () => {
    renderList();

    const rows = screen.getAllByRole("checkbox").map((box) => box.getAttribute("aria-label"));
    expect(rows[0]).toMatch(/many idea/);
    expect(rows[1]).toMatch(/for we/);
  });

  it("renders nothing when the paper had no marks", () => {
    const { container } = renderList({ marks: [] });

    expect(container).toBeEmptyDOMElement();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web test RevisionChecklist`
Expected: FAIL — cannot resolve `./RevisionChecklist`.

- [x] **Step 3: Write the component**

Create `apps/web/src/practice/RevisionChecklist.tsx`:

```tsx
import { MARK_LABELS, countHandled, markKey, type WritingMark } from "@writing-helper/practice";
import { useState } from "react";

/**
 * Việc cần sửa trong phòng sửa bài. Không có gì định vị bằng offset ở đây, nên
 * không có gì lệch được khi người học bắt đầu gõ — đó là cả lý do danh sách
 * này thay cho việc gạch chân trên bài đang sửa.
 *
 * Dòng đã xử lý giữ nguyên vị trí thay vì dồn xuống cuối: thứ tự theo vị trí
 * trong bài chính là thứ giúp dò theo văn bản.
 */
export function RevisionChecklist({
  marks,
  parentPlainText,
  handled,
  onToggle,
}: {
  marks: WritingMark[];
  parentPlainText: string;
  handled: string[];
  onToggle: (key: string) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (marks.length === 0) return null;

  const done = new Set(handled);
  const counted = countHandled(marks, handled);

  return (
    <section className="mt-8 border-t border-rule pt-6">
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-vermilion">
        To fix · {counted.handled}/{counted.total}
      </h2>
      <ul className="mt-3 space-y-3">
        {marks.map((mark) => {
          const key = markKey(mark);
          const quote = parentPlainText.slice(mark.start, mark.end);
          const isDone = done.has(key);

          return (
            <li key={key} className={isDone ? "opacity-50" : ""}>
              <div className="flex items-baseline gap-2">
                <input
                  type="checkbox"
                  aria-label={quote}
                  checked={isDone}
                  onChange={() => onToggle(key)}
                  className="mt-1 accent-vermilion"
                />
                <button
                  type="button"
                  onClick={() => setOpenKey(openKey === key ? null : key)}
                  aria-expanded={openKey === key}
                  className="flex-1 text-left text-sm leading-snug"
                >
                  <span className={isDone ? "line-through" : ""}>{quote}</span>
                  <span className="text-ink-faint"> → </span>
                  <span className="font-display">{mark.correction}</span>
                  <span className="mt-0.5 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">
                    {MARK_LABELS[mark.category]}
                  </span>
                </button>
              </div>
              {openKey === key && (
                <p className="mt-1 pl-6 text-sm leading-snug text-ink-soft">{mark.note}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
```

- [x] **Step 4: Run tests and typecheck**

Run: `pnpm --filter @writing-helper/web test RevisionChecklist && pnpm --filter @writing-helper/web typecheck`
Expected: PASS — 8 tests; typecheck clean.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/practice/RevisionChecklist.tsx apps/web/src/practice/RevisionChecklist.test.tsx
git commit -m "Add the revision checklist component"
```

---

### Task 5: Nối checklist vào phòng sửa, gỡ gạch chân

**Files:**
- Modify: `apps/web/src/api/practice.ts` (interfaces `PracticeAttemptDetail`, `UpdateAttemptInput`)
- Modify: `apps/web/src/pages/PracticeAttemptPage.tsx` (`ExamRoom` và `PromptPane`)

**Interfaces:**
- Consumes: `<RevisionChecklist>` (Task 4); `markKey` từ `@writing-helper/practice`; `PATCH` chấp nhận `handledMarks` (Task 3).
- Produces: không có API mới cho task sau.

**Ghi chú về code sẵn có:** `ExamRoom` đã có `const parent = useQuery({ queryKey: ["practice-attempt", attempt.parentAttemptId], ... })` và truyền `parentFeedback={parent.data?.feedback ?? null}` xuống `PromptPane`. Lấy `marks` và `plainText` của bài gốc từ **cùng query đó** — không thêm request nào. `save` là `useMutation` gọi `updateAttempt`.

- [x] **Step 1: Add the two fields to the API client types**

Trong `apps/web/src/api/practice.ts`:

thêm vào `PracticeAttemptDetail`:

```ts
  /** Khoá "start:end" của mark bài gốc mà bản sửa này đã xử lý. */
  handledMarks: string[] | null;
```

và vào `UpdateAttemptInput`:

```ts
  handledMarks?: string[];
```

- [x] **Step 2: Write the failing regression test**

Trong `apps/web/src/pages/PracticeAttemptPage.test.tsx`, thêm test khẳng định phòng sửa **không** còn vẽ mark.

File này **đã có sẵn** stub `Editor` phơi ra thuộc tính `data-marks` trên `[data-testid="editor"]` — `JSON.stringify(savedMarks)` khi có mark, chuỗi `"none"` khi không. Dùng đúng thuộc tính đó, đừng dựng stub thứ hai và đừng thêm helper mới.

```tsx
  it("does not paint marks over the paper being revised", async () => {
    // Bản sửa: bài gốc có mark, nhưng phòng sửa dùng checklist chứ không gạch chân.
    renderRevisionRoom();

    expect(await screen.findByText(/to fix/i)).toBeInTheDocument();
    expect(screen.getByTestId("editor")).toHaveAttribute("data-marks", "none");
  });
```

Dựng bản sửa bằng đúng cách file đang mock: `vi.mocked(getAttempt)` trả về attempt đang mở với `revisionRound: 1` và `parentAttemptId` khác null, và trả về bài gốc (khi được gọi với id của parent) có `marks` là mảng ít nhất một mark cùng `plainText` chứa đoạn chữ tương ứng. Đặt tên helper theo nếp các helper dựng dữ liệu sẵn có trong file.

- [x] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @writing-helper/web test PracticeAttemptPage`
Expected: FAIL — chưa có mục "To fix", và `savedMarks` vẫn được truyền.

- [x] **Step 4: Remove the underline machinery from `ExamRoom`**

Trong `apps/web/src/pages/PracticeAttemptPage.tsx`, xoá ba thứ tồn tại chỉ để chống lệch offset:

1. State `liveText` và dòng khởi tạo của nó (`const [liveText, setLiveText] = useState(attempt.plainText);` cùng chú thích phía trên).
2. Dòng `setLiveText(change.plainText);` trong `handleChange`.
3. Cả khối chú thích dài cùng `const parentPaper` / `const carriedMarks` — thay bằng:

```ts
  const parentPaper = parent.data;
```

Rồi bỏ hẳn prop `savedMarks={carriedMarks}` khỏi lời gọi `<Editor>` trong `ExamRoom`. `<Editor>` ở `ResultView` **không đụng tới**.

- [x] **Step 5: Wire the checklist through `PromptPane`**

Trong `ExamRoom`, thêm state và handler cạnh `save`:

```ts
  const [handledMarks, setHandledMarks] = useState<string[]>(attempt.handledMarks ?? []);

  const toggleHandled = useCallback(
    (key: string) => {
      setHandledMarks((current) => {
        const next = current.includes(key)
          ? current.filter((item) => item !== key)
          : [...current, key];
        // Gửi cả mảng thay vì thao tác thêm/bớt từng phần tử: đơn giản và
        // không có tranh chấp giữa hai lần bấm liên tiếp.
        save.mutate({ handledMarks: next });
        return next;
      });
    },
    [save],
  );
```

Truyền xuống `PromptPane` cạnh `parentFeedback`:

```tsx
            parentMarks={parentPaper?.marks ?? null}
            parentPlainText={parentPaper?.plainText ?? ""}
            handledMarks={handledMarks}
            onToggleHandled={toggleHandled}
```

- [x] **Step 6: Render it in `PromptPane`**

Thêm bốn prop vào cả phần destructure lẫn kiểu props của `PromptPane`:

```ts
  parentMarks: WritingMark[] | null;
  parentPlainText: string;
  handledMarks: string[];
  onToggleHandled: (key: string) => void;
```

Thêm `import { RevisionChecklist } from "../practice/RevisionChecklist";`, thêm `type WritingMark` vào import sẵn có từ `@writing-helper/practice`, rồi render **ngay trước** khối `{feedbackPoints.length > 0 && (` — checklist cụ thể và hành động được hơn nhận xét theo tiêu chí nên đứng trước:

```tsx
      {parentMarks && (
        <RevisionChecklist
          marks={parentMarks}
          parentPlainText={parentPlainText}
          handled={handledMarks}
          onToggle={onToggleHandled}
        />
      )}
```

`RevisionChecklist` tự trả `null` khi mảng rỗng, nên bài gốc sạch lỗi (`[]`) hay bóc lỗi hỏng (`null`) đều không hiện gì.

- [x] **Step 7: Run the web suite and typecheck**

Run: `pnpm --filter @writing-helper/web test && pnpm --filter @writing-helper/web typecheck`
Expected: PASS, typecheck clean. Nếu fixture attempt trong test nào đó thiếu `handledMarks`, thêm `handledMarks: null` vào fixture — chỉ sửa phần dựng dữ liệu, **không được nới lỏng assertion nào**.

- [x] **Step 8: Confirm the dead machinery is gone**

Run: `grep -rn "liveText\|carriedMarks" apps/web/src`
Expected: no output.

- [x] **Step 9: Commit**

```bash
git add apps/web/src/api/practice.ts apps/web/src/pages/PracticeAttemptPage.tsx apps/web/src/pages/PracticeAttemptPage.test.tsx
git commit -m "Swap revision-room underlines for the checklist"
```

---

### Task 6: Kiểm chứng trên trình duyệt

**Files:** không sửa file nào — đây là bước xác minh.

**Interfaces:**
- Consumes: toàn bộ Task 1–5.
- Produces: không.

- [x] **Step 1: Run everything**

Run: `pnpm test && pnpm lint`
Expected: toàn bộ suite xanh, lint sạch.

- [x] **Step 2: Start the app**

Run: `docker start writing-helper-db`, rồi mở preview qua launch config `writing-helper`.

- [x] **Step 3: Reach a revision room with marks**

Đăng nhập, mở một bài **đã nộp và có mark**, bấm **Revise this paper**. Không cần nộp bài mới — mỗi lần nộp tốn hai lượt gọi AI thật; các bài cũ đã đủ dùng. Nếu tài khoản chưa có bài nào có mark, nộp **một** bài, đừng lặp.

- [x] **Step 4: Check the checklist against the spec**

Xác nhận bằng mắt:
- Mục `To fix · 0/N` hiện **trên** `Previous feedback`.
- Mỗi dòng hiện đoạn chữ gốc → câu sửa, kèm nhãn lỗi; **ghi chú chưa hiện**.
- Bấm vào một dòng → ghi chú mở ra; bấm lại → đóng.
- Đánh dấu một dòng → gạch ngang, mờ đi, **giữ nguyên vị trí**, bộ đếm lên `1/N`.
- **Gõ vào bài → không có gạch chân nào xuất hiện trên chữ, và checklist không mất.** Đây là điều cả bản này tồn tại vì nó.

- [x] **Step 5: Check the tick survives a reload**

Tải lại trang. Các dòng đã đánh dấu vẫn còn đánh dấu, bộ đếm vẫn đúng.

- [x] **Step 6: Check the results screen is untouched**

Mở màn kết quả của một bài đã nộp. Lăng kính `mistakes` vẫn gạch chân như cũ, thẻ lỗi vẫn mở được — bản này không được đụng tới nó.

- [x] **Step 7: Report**

Ghi lại những gì quan sát được, kèm ảnh chụp phòng sửa có checklist. Nếu có gì lệch spec, báo cáo chứ đừng tự sửa ngoài phạm vi.

---

## Đã thực hiện — hai chỗ plan sai, sửa khi chạy

**Task 3 — fixture `editable` thiếu `revisions`.** `update()` gọi `findOne()`, và
`findOne()` destructure `revisions` rồi đọc `revisions[0]`. Fixture như plan viết
sẽ ném `Cannot read properties of undefined`. Đã thêm `revisions: []`.

**Task 5 — plan bỏ sót cả một khối test sẵn có.** `PracticeAttemptPage.test.tsx`
có `describe("PracticeAttemptPage ExamRoom carries the parent's marks")` với 4
test khẳng định *đúng hành vi mà bản này xoá đi*: vẽ mark khi chữ còn khớp, và
xoá sạch ở phím đầu tiên. Plan chỉ nói "thêm một test hồi quy".

Bốn test đó **viết lại theo hợp đồng mới**, không xoá — cùng cách xử lý như đợt 1:

| Test cũ | Test mới |
|---|---|
| paints the parent's marks while the text still matches | lists them in the panel and paints nothing over the paper |
| clears them on the first keystroke | **keeps the list after the first keystroke** |
| does not paint them when a part-written revision is reopened | lists them for a part-written revision reopened later |
| paints nothing on a first draft | lists nothing on a first draft |

Thêm hai test nữa cho phần lưu: gửi khoá ngay khi bấm, và nạp lại từ khoá đã lưu.

Ngoài ra: `prisma generate` phải chạy lại sau Task 2, nếu không e2e trả 500
(`PrismaClientValidationError`) — client sinh ra không biết cột mới. Lần thứ ba
bẫy này bắt được trong dự án; đáng thêm vào bước migration của plan sau.

## Rủi ro cần theo dõi

- **Panel dài.** Đo được 15–18 mark trên một bài thật. Ghi chú ẩn mặc định đã giảm bớt; nếu vẫn dài quá khi nhìn thật thì cân nhắc thu gọn nhóm đã xử lý — nhưng chỉ sau khi thấy, không làm phòng xa.
- **Người học đánh dấu mà chưa thật sự sửa.** Chấp nhận theo spec: đây là công cụ tự theo dõi, lần chấm lại mới là trọng tài.
