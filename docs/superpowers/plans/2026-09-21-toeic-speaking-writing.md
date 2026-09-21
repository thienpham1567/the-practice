# TOEIC Speaking & Writing (pha B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Luyện từng dạng TOEIC S&W đúng ETS: rating thô + practice score 0–200 (nhãn không-official), không còn IELTS band / Part 2 / CEFR-làm-đề.

**Architecture:** Package `practice` giữ catalog + `practiceScaled` + CEFR cuts + descriptors. API chấm holistic `rawRating` (không `overallBand` cho attempt mới). Web chọn `taskType`, timer theo dạng, stamp 0–200. Bài `scale=ielts` chỉ đọc legacy.

**Tech Stack:** `packages/practice` Vitest, Nest/Prisma, React/Vitest. Spec: `docs/superpowers/specs/2026-09-21-toeic-speaking-writing-design.md`.

**Pha C (full mock 11+8) không làm trong plan này.**

---

## File map

| File | Việc |
|---|---|
| `packages/practice/src/practice-scaled.ts` | `practiceScaled(raw, max)` |
| `packages/practice/src/toeic-cefr.ts` | Cắt ETS → A1–C1 |
| `packages/practice/src/toeic-descriptors.ts` | Dải descriptor Speaking 8 / Writing 9 |
| `packages/practice/src/types.ts` | `WritingTaskType`, `SpeakingTaskType`, bỏ IELTS TaskType cũ khỏi catalog mới |
| `packages/practice/src/task-catalog.ts` | 3 writing types |
| `packages/practice/src/speaking-catalog.ts` | 5 speaking types + pick |
| `packages/practice/src/toeic-scenes.ts` | 8 ảnh + 2 từ (path `/toeic/...`) |
| `apps/web/public/toeic/*.jpg` | Ảnh workplace/daily |
| Prisma + services + grade/generate prompts | Lưu scale/raw/estimatedScaled; chấm ETS |
| Web pages, stamp, charts, landing, recorder | Task picker, timer, UI 0–200 |

Giữ `overallBand()` cho script/legacy tests nếu còn gọi; **không** dùng khi submit toeic.

---

## Milestone 1 — Package thuần

### Task 1: `practiceScaled`

**Files:**
- Create: `packages/practice/src/practice-scaled.ts`
- Create: `packages/practice/src/practice-scaled.test.ts`
- Modify: `packages/practice/src/index.ts`

- [ ] **Step 1: Test fail**

```ts
import { describe, expect, it } from "vitest";
import { practiceScaled } from "./practice-scaled";

describe("practiceScaled", () => {
  it("maps 0 to 0", () => {
    expect(practiceScaled(0, 3)).toBe(0);
    expect(practiceScaled(-1, 5)).toBe(0);
  });

  it("maps a perfect raw score to 200", () => {
    expect(practiceScaled(3, 3)).toBe(200);
    expect(practiceScaled(4, 4)).toBe(200);
    expect(practiceScaled(5, 5)).toBe(200);
  });

  it("uses tenths of 200: 2/3 → 130, 4/5 → 160", () => {
    expect(practiceScaled(2, 3)).toBe(130);
    expect(practiceScaled(4, 5)).toBe(160);
    expect(practiceScaled(1, 3)).toBe(70);
  });

  it("clamps above max to 200", () => {
    expect(practiceScaled(9, 5)).toBe(200);
  });
});
```

- [ ] **Step 2: Run**

```bash
pnpm --filter @writing-helper/practice test src/practice-scaled.test.ts
```

Expected: FAIL missing module.

- [ ] **Step 3: Implement**

```ts
/** Practice TOEIC scaled 0–200 in steps of 10. Not an official ETS conversion. */
export function practiceScaled(raw: number, maxRaw: number): number {
  if (maxRaw <= 0 || raw <= 0) return 0;
  const ratio = Math.min(raw, maxRaw) / maxRaw;
  return Math.round(ratio * 20) * 10;
}
```

Export from `index.ts`.

- [ ] **Step 4: Tests pass.** Commit: `Add TOEIC practice scaled-score helper.`

---

### Task 2: CEFR cuts

**Files:** Create `toeic-cefr.ts` + `.test.ts`. Skill: speaking vs writing cuts khác nhau.

```ts
export type CefrEstimate = "A1" | "A2" | "B1" | "B2" | "C1";
export type ToeicSkill = "speaking" | "writing";

const CUTS: Record<ToeicSkill, Array<{ min: number; level: CefrEstimate }>> = {
  speaking: [
    { min: 180, level: "C1" },
    { min: 160, level: "B2" },
    { min: 120, level: "B1" },
    { min: 90, level: "A2" },
    { min: 50, level: "A1" },
  ],
  writing: [
    { min: 180, level: "C1" },
    { min: 150, level: "B2" },
    { min: 120, level: "B1" },
    { min: 70, level: "A2" },
    { min: 30, level: "A1" },
  ],
};

export function cefrFromScaled(
  scaled: number,
  skill: ToeicSkill,
): CefrEstimate | null {
  for (const row of CUTS[skill]) {
    if (scaled >= row.min) return row.level;
  }
  return null;
}
```

Tests: speaking 179 → B2, 180 → C1, 49 → null; writing 150 → B2, 149 → B1, 29 → null.

Commit: `Map practice TOEIC scores to ETS CEFR cut guidelines.`

---

### Task 3: Descriptors

`toeic-descriptors.ts`: functions `speakingDescriptor(scaled: number): string` và `writingDescriptor(scaled: number): string`.

Dải (ETS Score User Guide, rút gọn 1–2 câu mỗi dải — copy ý không bịa):

Speaking: 190–200, 160–180, 130–150, 110–120, 80–100, 60–70, 40–50, 0–30.  
Writing: 200, 170–190, 140–160, 110–130, 90–100, 70–80, 50–60, 40, 0–30.

Test: 200 speaking chứa "workplace" hoặc "sustained"; 0 chứa "left" / "did not" / "significant". 165 khớp dải 160–180.

Commit: `Add ETS proficiency descriptor lookup for practice scores.`

---

### Task 4: Writing catalog

Thay `types.ts` `TaskType`:

```ts
export type WritingTaskType =
  | "picture-sentence"
  | "email-request"
  | "opinion-essay";

export type TaskType = WritingTaskType; // catalog mới; bài ielts cũ vẫn là string trên DB
```

`TaskSpec` thêm `maxRaw: 3 | 4 | 5`. `levels` **xóa** — mọi dạng cho mọi người. `tasksForLevel` xóa.

`TASK_CATALOG`:

```ts
export const TASK_CATALOG: TaskSpec[] = [
  {
    type: "picture-sentence",
    minWords: 1,
    maxWords: 40,
    timeMinutes: 1.5, // 90s — hoặc timeSeconds: 90; nếu TaskSpec đang Int phút, thêm timeSeconds: number
    label: "Picture sentence",
    maxRaw: 3,
    instruction:
      "Write one sentence about the picture. You must use both given words (you may change their form).",
  },
  {
    type: "email-request",
    minWords: 40,
    maxWords: 200,
    timeMinutes: 10,
    timeSeconds: 600,
    label: "Email response",
    maxRaw: 4,
    instruction:
      "Read the email. Reply in 10 minutes. Answer every request.",
  },
  {
    type: "opinion-essay",
    minWords: 300,
    maxWords: 400,
    timeMinutes: 30,
    timeSeconds: 1800,
    label: "Opinion essay",
    maxRaw: 5,
    instruction:
      "State, explain, and support your opinion. An effective essay is typically at least 300 words.",
  },
];
```

Đổi `TaskSpec.timeMinutes` → thêm `timeSeconds: number` (nguồn sự thật cho đồng hồ). `timeMinutes` có thể derive. Cập nhật `exam-math.ts` web dùng `timeSeconds`.

`pickTask(recentTypes: WritingTaskType[]): TaskSpec` — bỏ `level`. Rotate unused types.

Sửa `pick-task.test.ts`, `task-catalog.test.ts`, `generate-prompt` callers.

`landing-copy.ts` dùng `email-request` / `express-opinion`.

Commit: `Replace writing catalog with TOEIC picture, email, and opinion tasks.`

---

### Task 5: Speaking catalog + scenes

Thay `SpeakingCueCard` bằng:

```ts
export type SpeakingTaskType =
  | "read-aloud"
  | "describe-picture"
  | "respond-question"
  | "respond-with-info"
  | "express-opinion";

export interface SpeakingTaskSpec {
  type: SpeakingTaskType;
  label: string;
  prepSeconds: number;
  speakSeconds: number;
  infoSeconds?: number; // 45 đọc info trước Q8–10
  maxRaw: 3 | 5;
}
```

`SPEAKING_TASKS`: 5 spec (respond-question default speak 15; respond-with-info default 30; opinion 60; read-aloud 45/45; picture 45/30).

`TOEIC_SCENES`: ≥8 `{ id, imageUrl: "/toeic/....jpg", wordA, wordB, alt }`.

`pickSpeakingSpec(type)` + seed passages/questions in catalog arrays (≥3 mỗi type) để generate có seed giống hiện tại.

`pickSpeakingTask(type, recentKeys)` trả seed.

Ảnh: đặt 8 file jpeg vào `apps/web/public/toeic/` (ảnh workplace/daily, không cần stock đắt — ảnh tự chụp/desk hiện có crop cũng được nếu rõ nội dung). API chỉ lưu path.

Commit: `Add TOEIC speaking task specs and picture-scene catalog.`

Cập nhật `packages/practice` test catalog cũ (level A2 cards) — **xóa** Part 2 cards.

---

## Milestone 2 — Prisma + API writing

### Task 6: Migration

`PracticeAttempt` thêm:

```
scale           String  @default("toeic")
rawRating       Int?
estimatedScaled Int?
cefrEstimate    String?
taskPayload     Json?
```

`SpeakingAttempt` thêm cùng `scale`, `rawRating`, `estimatedScaled`, `cefrEstimate`, `taskType String?` (nếu chưa có — cueCard sẽ chứa type; cột `taskType` để list/filter).

Default `scale` = `toeic` cho hàng mới. Migration SQL: `scale` DEFAULT `'ielts'` cho **hàng cũ** rồi đổi default Prisma thành toeic — hoặc: `UPDATE ... SET scale='ielts' WHERE band IS NOT NULL` sau khi add column default ielts, rồi đổi default app sang toeic cho create mới.

Chọn: cột `scale TEXT NOT NULL DEFAULT 'ielts'` để hàng cũ an toàn; `create()` luôn ghi `scale: "toeic"`.

`pnpm exec prisma migrate dev --name toeic_practice_scores` (DB down thì viết SQL tay như migration speaking aids).

Commit: `Add TOEIC score columns on writing and speaking attempts.`

---

### Task 7: Generate + grade writing prompts

`CreateAttemptDto`: `@IsIn(WRITING_TYPES) taskType` bắt buộc; **xóa** `level`.

`buildGeneratePrompt(task)`: workplace/daily; picture-sentence: server pick scene, prompt = two words + instruction (không nhờ model bịa ảnh). email-request: invent email + 2–3 requests. opinion-essay: one issue. Vẫn ideas + vocabulary; **Do not write a sample essay**.

`buildGradePrompt`: **không** “IELTS examiner”. Theo `task.type`:

- picture-sentence: rawRating 0–3; feedback grammar + relevance.
- email-request: 0–4; sentenceVariety, vocabulary, organization.
- opinion-essay: 0–5; opinionSupport, grammar, vocabulary, organization; if wordCount < 300 lower rating.

Schema: `{ rawRating, feedback: { ...keys for type, overview, nextFocus, improvements } }`.

`create()`: `data.level` ghi `"TOEIC"` (cột cũ NOT? — hiện `level String` bắt buộc; ghi `"TOEIC"`). `taskType`, `scale: "toeic"`, `taskPayload` (imageUrl/words nếu picture).

`submit()`: `rawRating` từ AI, `estimatedScaled = practiceScaled(raw, task.maxRaw)`, `cefrEstimate = cefrFromScaled(..., "writing")`, **`band: null`**.

Sửa `practice.service.spec.ts` toàn bộ create `{ level: "A2", taskType: "email" }` → `{ taskType: "email-request" }`. Grade mock `{ rawRating: 4, feedback: {...} }` không còn scores 6/6/6/5. Expect `estimatedScaled: 200` khi 4/4.

Revision grade: cùng schema toeic, prompt không IELTS.

Commit: `Grade writing attempts on TOEIC raw ratings and practice scaled scores.`

---

## Milestone 3 — API speaking

### Task 8: Generate + grade speaking

`CreateSpeakingAttemptDto`: `taskType` bắt buộc, optional `speakSeconds` 15|30 cho 2 dạng có hai mốc.

`cueCard` JSON:

```ts
{ type, prepSeconds, speakSeconds, maxRaw, passage?, imageUrl?, question?, info? }
```

Generate: seed từ catalog; invent passage/question/info; picture: pick scene. `maxTokens` đủ. Vẫn structure 5 + vocab (learner aids). Không sample answer.

Grade: audio như hiện tại. Prompt ETS criteria theo type. Schema `rawRating` + feedback keys + transcript + marks. Server `practiceScaled` + `cefrFromScaled(..., "speaking")`. Không `overallBand`.

`asCueCard` đổi: require `type` + `speakSeconds`.

`submit` duration tối thiểu: 10s quá dài cho câu 15s — **hạ sàn xuống 5s** cho speaking TOEIC (spec không nói; 15s turn không thể yêu cầu 10s minimum một cách thoải mái — dùng `min(10_000, speakSeconds*1000 * 0.3)` hoặc 3s). Chốt: `durationMs < 3_000` → 400.

Sửa e2e mock `speaking_cue_card` payload mới; create `{ taskType: "express-opinion" }`.

Commit: `Grade speaking on TOEIC task types with official timers.`

---

## Milestone 4 — Web

### Task 9: API client + stamp + criteria

`PracticeAttemptDetail` / `SpeakingAttemptDetail`: `scale`, `rawRating`, `estimatedScaled`, `cefrEstimate`, `taskPayload`; `band` nullable.

`ScoreStamp`: số `estimatedScaled`, dòng `Practice score`, `raw x/max`, optional CEFR. Bài `scale==="ielts"` giữ `BandStamp`.

`CriteriaBars`: nhận `entries: { label, comment }[]` — không chia /9. IELTS bars chỉ khi scale ielts.

`createAttempt({ taskType })`, `createSpeakingAttempt({ taskType })`.

---

### Task 10: Practice / Speaking list pages

FolioChoice task types, bỏ Level. Chart: `firstDraftChartPoints` đọc `estimatedScaled`, filter `scale==="toeic"`. Trục 0–200 (`band-chart.ts` domain). IELTS rows: badge Legacy + Band.

`level-up.ts`: dựa `cefrEstimate` / scaled cuts, không BAND_THRESHOLD 6.5.

---

### Task 11: Exam rooms

Writing: `spec.timeSeconds` (90 / 600 / 1800). Picture: `<img src=taskPayload.imageUrl>`. Word count: picture-sentence không hiện 300. Hints/structure copy TOEIC (spec §9).

Speaking: `PREP_SECONDS` từ cueCard.prepSeconds (3 hoặc 45). `useRecorder` nhận `maxMs = speakSeconds * 1000`. Read-aloud hiện passage. Picture hiện ảnh. Info hiện khối text 45s trước record (phase `info` nếu `infoSeconds`). Opinion 60s. Bỏ “Part 2”. Result: ScoreStamp + descriptor + SampleEssays.

Header copy English: `Practice score, not an official TOEIC score`.

`landing-copy.ts` + `no-vietnamese-display` vẫn English. Xóa IELTS/Part 2/Band trên UI học (test `Band 5.5` → `160` hoặc `/Practice score/`).

`MAX_RECORDING_MS` default 60_000; page truyền max.

---

### Task 12: Tests + typecheck

```bash
pnpm --filter @writing-helper/practice test
pnpm --filter @writing-helper/api exec jest --no-coverage
pnpm --filter @writing-helper/web test
pnpm --filter @writing-helper/api typecheck
pnpm --filter @writing-helper/web typecheck
```

E2E nếu Postgres chạy: create opinion-essay + express-opinion, body `scale=toeic`, `rawRating`, `estimatedScaled`.

Grep UI: không còn `IELTS`, `Part 2`, `Band ` trên pages học (trừ nhánh `scale==="ielts"`).

---

## Spec coverage

| Spec | Task |
|---|---|
| practiceScaled công thức | 1 |
| CEFR cuts ETS | 2 |
| Descriptors | 3 |
| 3 writing types, timer, ≥300 essay | 4, 7, 11 |
| 5 speaking types, 60s Q11 | 5, 8, 11 |
| scale ielts vs toeic, band null | 6, 10 |
| Không overallBand toeic | 7, 8 |
| Ảnh catalog | 5, 11 |
| Task picker, stamp, charts 0–200 | 9–11 |
| Learner aids nội dung TOEIC | 7, 8, 11 |
| Pha C | không làm |
