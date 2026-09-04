# Nhãn CEFR trên band stamp — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** [../specs/2026-09-04-cefr-label-design.md](../specs/2026-09-04-cefr-label-design.md)

**Goal:** Thay nhãn CEFR suy từ band (`≈ C1` trên một bài B1) bằng mức của chính đề bài, để stamp không còn tuyên bố điều nó không có bằng chứng.

**Architecture:** Gắn mức vào **chính `BandStamp`** chứ không vá từng trang, vì stamp là thứ đi kèm band ở mọi nơi — gắn vào đó thì band không bao giờ còn xuất hiện mà thiếu mức. `level` đã có sẵn ở cả 4 chỗ gọi và trong payload API, nên đây là thay đổi thuần frontend: không đổi API, không migration. Xoá luôn `bandToCefr` vì sau bản này không còn ai gọi.

**Tech Stack:** pnpm workspaces, TypeScript, React 18 + Vite, Vitest, Tailwind v4.

## Global Constraints

- Mọi chuỗi hiển thị bằng **tiếng Anh** — repo có test chặn chuỗi tiếng Việt lọt vào UI. Chú thích code tiếng Việt là bình thường.
- `packages/analysis` **không được sửa**.
- `/progress`, `levelUpVerdict`, `BandChart`, `ProgressBandChart` **không được sửa** — tuyên bố về trình độ ở lại đó.
- Prompt chấm bài (`apps/api/src/practice/grade-prompt.ts`) **không được sửa** — tài liệu đo variance kết luận không sửa prompt khi không có lý do đo được.
- Không sửa gì trong `apps/api`.
- Nhánh trả về sớm `formatChainSummary(...)` trong `PaperBandMeta` và `TalkBandMeta` **không được đụng** — đó là chuỗi `5.5 → 6.5`, không phải stamp.
- Sau mỗi task: chạy test liên quan, commit riêng.

---

### Task 1: `BandStamp` hiện mức đề thay cho CEFR

**Files:**
- Modify: `apps/web/src/practice/BandStamp.tsx`
- Modify: `apps/web/src/practice/BandStamp.test.tsx`

**Interfaces:**
- Consumes: type `Level` từ `@writing-helper/practice`.
- Produces: `<BandStamp band={number} level={Level} size?={"sm" | "lg"} />` — prop `level` **bắt buộc**.

**Ghi chú về code sẵn có:** file hiện import `bandToCefr`, có hằng `CEFR_HINT`, và gắn `title` + `aria-label` lên `<span>` chứa nhãn. Cả ba thứ đó biến mất trong task này. Phần khung stamp (double border, `-rotate-2`, hai cỡ `sm`/`lg`) **giữ nguyên** — chỉ đổi nội dung dòng thứ hai.

- [ ] **Step 1: Viết lại test cho hợp đồng mới**

File `apps/web/src/practice/BandStamp.test.tsx` hiện có 2 test khẳng định đúng hành vi bản này xoá đi. **Viết lại cả hai**, không xoá — chúng vẫn là chỗ chốt hành vi của component. Thay toàn bộ khối `describe` bằng:

```tsx
describe("BandStamp", () => {
  it("shows the band and the level of the task it was earned on", () => {
    render(<BandStamp band={6.5} level="B1" />);
    expect(screen.getByText("Band 6.5")).toBeTruthy();
    expect(screen.getByText("B1 task")).toBeTruthy();
  });

  /*
    Đây là regression cần chốt: band 7 trên một đề B1 từng hiện "≈ C1" — một
    tuyên bố về trình độ người viết mà một bài đơn lẻ không chứng minh được.
  */
  it("never converts the band into a CEFR claim about the writer", () => {
    const { container } = render(<BandStamp band={7} level="B1" />);
    expect(screen.getByText("B1 task")).toBeTruthy();
    expect(container.textContent).not.toMatch(/≈/);
    expect(container.textContent).not.toMatch(/C1/);
  });

  it("keeps both sizes readable", () => {
    render(<BandStamp band={5} level="A2" size="sm" />);
    expect(screen.getByText("Band 5")).toBeTruthy();
    expect(screen.getByText("A2 task")).toBeTruthy();
  });
});
```

Import ở đầu file giữ nguyên (`cleanup`, `render`, `screen`, `afterEach`, `describe`, `expect`, `it`, `BandStamp`).

- [ ] **Step 2: Chạy test để thấy nó fail**

Run: `pnpm --filter @writing-helper/web test BandStamp`
Expected: FAIL — TypeScript báo `level` không tồn tại trên props, và không tìm thấy `"B1 task"`.

- [ ] **Step 3: Sửa component**

Thay toàn bộ `apps/web/src/practice/BandStamp.tsx` bằng:

```tsx
import type { Level } from "@writing-helper/practice";

interface BandStampProps {
  band: number;
  /**
   * Mức của đề, không phải trình độ suy ra từ band. Bắt buộc: một band không
   * kèm mức chính là thứ bản này sửa — đề B1 được 7 nghĩa là làm rất tốt một
   * việc dễ, không phải người viết đã lên C1.
   */
  level: Level;
  size?: "sm" | "lg";
}

/** Same rubber-stamp chrome as GradeStamp: double frame, tilt, ink grain. */
export function BandStamp({ band, level, size = "lg" }: BandStampProps) {
  const isLarge = size === "lg";

  return (
    <div
      className={`stamp animate-stamp-in inline-flex -rotate-2 flex-col items-center border-2 border-double border-vermilion ${
        isLarge ? "px-5 py-3" : "px-3 py-1.5"
      }`}
    >
      <span
        className={`font-display font-semibold leading-none ${isLarge ? "text-3xl" : "text-base"}`}
      >
        Band {band}
      </span>
      <span
        className={`font-mono uppercase tracking-[0.2em] text-ink ${
          isLarge ? "mt-1 text-[0.7rem]" : "mt-0.5 text-[0.55rem]"
        }`}
      >
        {level} task
      </span>
    </div>
  );
}
```

- [ ] **Step 4: Chạy test**

Run: `pnpm --filter @writing-helper/web test BandStamp`
Expected: PASS — 3 test.

Typecheck sẽ **chưa** sạch: 4 chỗ gọi còn thiếu prop `level`. Đó là đúng, Task 2 sửa. Đừng thêm `?` vào `level` để làm typecheck im — prop bắt buộc là chủ ý.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/practice/BandStamp.tsx apps/web/src/practice/BandStamp.test.tsx
git commit -m "Show the task level on the band stamp instead of a CEFR guess"
```

---

### Task 2: Truyền `level` vào cả bốn chỗ gọi

**Files:**
- Modify: `apps/web/src/pages/PracticeAttemptPage.tsx`
- Modify: `apps/web/src/pages/SpeakingAttemptPage.tsx`
- Modify: `apps/web/src/pages/PracticePage.tsx`
- Modify: `apps/web/src/pages/SpeakingPage.tsx`
- Modify: `apps/web/src/pages/PracticePage.test.tsx`
- Modify: `apps/web/src/pages/SpeakingPage.test.tsx`

**Interfaces:**
- Consumes: `<BandStamp>` với prop `level` bắt buộc (Task 1).
- Produces: không có API mới cho task sau.

**Ghi chú về code sẵn có:** hai màn kết quả gọi `<BandStamp band={attempt.band} />` trực tiếp và đã có `attempt.level` trong scope. Hai trang danh sách gọi qua component trung gian — `PaperBandMeta` (writing) và `TalkBandMeta` (speaking) — nên hai component đó phải nhận thêm prop. Cả hai đều có nhánh `formatChainSummary` trả về **trước** khi tới stamp; **không đụng nhánh đó**.

- [ ] **Step 1: Hai màn kết quả**

Trong `apps/web/src/pages/PracticeAttemptPage.tsx`, đổi:

```tsx
                <BandStamp band={attempt.band} />
```

thành:

```tsx
                <BandStamp band={attempt.band} level={attempt.level} />
```

Trong `apps/web/src/pages/SpeakingAttemptPage.tsx`, đổi đúng cùng một dòng theo đúng cùng một cách.

- [ ] **Step 2: `PaperBandMeta` trong `PracticePage.tsx`**

Thêm `level` vào cả phần destructure lẫn kiểu props, và truyền xuống stamp:

```tsx
function PaperBandMeta({
  band,
  level,
  latestBand,
  revisionCount,
}: {
  band: number | null;
  level: Level;
  latestBand: number | null;
  revisionCount: number;
}) {
  const summary = formatChainSummary(band, latestBand, revisionCount);
  if (summary) {
    return (
      <span className="shrink-0 font-mono text-[0.75rem] tracking-wide text-ink-soft">
        {summary}
      </span>
    );
  }
  if (band !== null) return <BandStamp band={band} level={level} size="sm" />;
  return null;
}
```

Rồi ở chỗ gọi, thêm `level={attempt.level}` vào giữa `band` và `latestBand`:

```tsx
                    <PaperBandMeta
                      band={attempt.band}
                      level={attempt.level}
                      latestBand={attempt.latestBand}
                      revisionCount={attempt.revisionCount}
                    />
```

`Level` đã được import sẵn ở đầu file (`import { computeStreak, TASK_CATALOG, type Level } from "@writing-helper/practice";`) — không thêm import trùng.

- [ ] **Step 3: `TalkBandMeta` trong `SpeakingPage.tsx`**

Làm y hệt Step 2 nhưng cho `TalkBandMeta`: thêm `level: Level` vào props, truyền `level={level}` vào `<BandStamp>`, và thêm `level={attempt.level}` ở chỗ gọi. `Level` cũng đã được import sẵn (`import { computeStreak, type Level } from "@writing-helper/practice";`).

- [ ] **Step 4: Chốt dòng danh sách writing bằng test**

Dòng danh sách writing trước bản này **không hiện mức ở đâu cả** — chỉ `Email` + ngày + band. Thêm test vào `apps/web/src/pages/PracticePage.test.tsx`, ngay sau test `"shows BandStamp when a paper has no revisions"`:

```tsx
  it("shows which level the paper's band was earned on", async () => {
    vi.mocked(listAttempts).mockResolvedValue([rootNoRevisions]);
    renderPage();

    expect(await screen.findByText("B1 task")).toBeTruthy();
  });
```

Fixture `rootNoRevisions` đã có `level: "B1"` — không sửa fixture.

- [ ] **Step 5: Chạy toàn bộ test web và typecheck**

Run: `pnpm --filter @writing-helper/web test && pnpm --filter @writing-helper/web typecheck`
Expected: PASS, typecheck sạch.

`SpeakingPage.test.tsx` có sẵn `expect(screen.getByRole("link", { name: /B1/i }))` — dòng speaking vốn đã in `Part 2 · B1`, giờ thêm `B1 task` trong cùng link. Accessible name chứa "B1" hai lần, regex vẫn khớp, test vẫn xanh. **Không nới lỏng hay sửa test đó.**

Nếu có test nào khác fail vì fixture thiếu `level`, thêm `level: "B1"` vào **fixture**; không được nới lỏng bất kỳ assertion nào.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/pages/PracticeAttemptPage.tsx apps/web/src/pages/SpeakingAttemptPage.tsx apps/web/src/pages/PracticePage.tsx apps/web/src/pages/SpeakingPage.tsx apps/web/src/pages/PracticePage.test.tsx apps/web/src/pages/SpeakingPage.test.tsx
git commit -m "Pass the task level into every band stamp"
```

---

### Task 3: Xoá `bandToCefr`

**Files:**
- Delete: `packages/practice/src/band-to-cefr.ts`
- Delete: `packages/practice/src/band-to-cefr.test.ts`
- Modify: `packages/practice/src/index.ts`

**Interfaces:**
- Consumes: không.
- Produces: không — task này chỉ gỡ bỏ.

**Vì sao xoá:** sau Task 1 không còn ai gọi. Giữ lại một hàm quy đổi band → CEFR chỉ là để mời người sau dùng lại đúng cái vừa gỡ đi.

- [ ] **Step 1: Chứng minh không còn ai dùng**

Run: `grep -rn "bandToCefr" apps packages`
Expected: chỉ còn 3 dòng — trong `band-to-cefr.ts`, `band-to-cefr.test.ts`, và dòng export ở `packages/practice/src/index.ts`.

Nếu còn dòng nào khác: **dừng lại và báo cáo**, đừng xoá. Nghĩa là Task 1 hoặc 2 còn sót chỗ gọi.

- [ ] **Step 2: Xoá**

```bash
git rm packages/practice/src/band-to-cefr.ts packages/practice/src/band-to-cefr.test.ts
```

Rồi xoá dòng này khỏi `packages/practice/src/index.ts`:

```ts
export { bandToCefr } from "./band-to-cefr";
```

- [ ] **Step 3: Chạy test và typecheck cả hai package**

Run: `pnpm --filter @writing-helper/practice test && pnpm --filter @writing-helper/web test && pnpm --filter @writing-helper/web typecheck`
Expected: PASS cả ba. Bộ test của `packages/practice` xanh mà không có `band-to-cefr.test.ts` chính là bằng chứng không ai phụ thuộc nó.

- [ ] **Step 4: Commit**

```bash
git add packages/practice/src/index.ts packages/practice/src/band-to-cefr.ts packages/practice/src/band-to-cefr.test.ts
git commit -m "Delete bandToCefr: nothing converts a band into a CEFR claim now"
```

---

### Task 4: Kiểm chứng trên trình duyệt

**Files:** không sửa file nào — đây là bước xác minh.

**Interfaces:**
- Consumes: Task 1–3.
- Produces: không.

- [ ] **Step 1: Chạy tất cả**

Run: `pnpm test && pnpm lint`
Expected: toàn bộ suite xanh, lint sạch.

- [ ] **Step 2: Mở app**

Run: `docker start writing-helper-db`, rồi mở preview qua launch config `writing-helper`.

Nếu Docker chưa chạy: `open -a OrbStack`, đợi `docker info` trả về, rồi `docker start writing-helper-db`.

- [ ] **Step 3: Xem trang danh sách bài viết**

Đăng nhập, mở `/practice`. **Không cần nộp bài mới** — mỗi lần nộp tốn hai lượt gọi AI thật; bài cũ đã đủ.

Xác nhận: mỗi bài đã chấm hiện `Band X` kèm `B1 task` (hoặc mức tương ứng). Không còn `≈` ở đâu.

- [ ] **Step 4: Xem màn kết quả**

Mở một bài đã chấm, bật panel `Scores`. Stamp lớn hiện `Band X` trên, `B1 task` dưới. Không có tooltip CEFR khi rê chuột.

- [ ] **Step 5: Xem bên speaking**

Mở `/speaking` và một bài nói đã chấm. Stamp cũng hiện mức. Dòng danh sách sẽ đọc là `Part 2 · B1 … Band 5.5 / B1 task` — thừa một chút, đúng như spec đã chấp nhận. Nếu nhìn thật mà thấy khó chịu quá thì **báo cáo**, đừng tự sửa ngoài phạm vi.

- [ ] **Step 6: Báo cáo**

Ghi lại quan sát kèm ảnh chụp cả trang danh sách lẫn màn kết quả. Có gì lệch spec thì báo, đừng tự sửa ngoài phạm vi.

---

## Rủi ro cần theo dõi

- **Stamp nhỏ trong dòng danh sách có thể chật.** `B1 task` dài hơn `≈ B2` một chút. Nếu vỡ layout ở màn hẹp, thu `tracking` của dòng dưới ở cỡ `sm` — đừng bỏ chữ "task", vì chính nó ngăn người đọc hiểu thành "bạn là B1".
- **Mất neo CEFR sau mỗi bài.** Đánh đổi có chủ ý theo spec: `/progress` giữ vai trò đó với `levelUpVerdict`, vốn đòi 5 bài liên tiếp ≥ 6.5 cùng mức.
