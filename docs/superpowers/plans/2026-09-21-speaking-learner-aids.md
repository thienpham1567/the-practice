# Speaking Learner Aids Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Part 2 có hint + vocab + bố cục lúc prep, và 2 transcript mẫu sau khi chấm — không hiện gợi ý lúc ghi âm.

**Architecture:** Sinh `structure` (5 nhịp) + `vocabulary` cùng cue card (một lần AI). Cửa `hintsOpened` chỉ Prep, PATCH một chiều. `sampleTalks` sinh on-demand sau chấm, endpoint riêng, dùng `AI_MODEL` (text), không `AI_MODEL_AUDIO`. Vocab đi sổ chung qua `VocabService`.

**Tech Stack:** NestJS + Prisma, React + Vitest, Jest unit + e2e hiện có.

**Spec:** `docs/superpowers/specs/2026-09-21-speaking-learner-aids-design.md`

---

## File map

| File | Việc |
|---|---|
| `apps/api/prisma/schema.prisma` + migration mới | `structure`, `vocabulary`, `hintsOpened`, `sampleTalks` |
| `apps/api/src/practice/vocab-tag.ts` (+ `.spec.ts`) | Helper `tagReviewVocabulary` dùng chung |
| `apps/api/src/practice/practice.service.ts` | Import helper, xóa hàm private cũ |
| `apps/api/src/speaking/speaking-generate-prompt.ts` (+ spec) | Schema + prompt structure/vocab/review |
| `apps/api/src/speaking/speaking-sample-prompt.ts` (+ spec) | 2 transcript mẫu |
| `apps/api/src/ai/ai.service.ts` (+ spec) | `speaking.samples` — **không** chọn audio model |
| `apps/api/src/speaking/speaking.service.ts` (+ spec) | create/update/revise/generateSamples |
| `apps/api/src/speaking/dto/speaking.dto.ts` | `UpdateSpeakingAttemptDto` |
| `apps/api/src/speaking/speaking.controller.ts` | PATCH + POST samples |
| `apps/api/src/speaking/speaking.module.ts` | `VocabService` provider |
| `apps/api/test/app.e2e-spec.ts` | Mock generate trả structure/vocab; PATCH + samples |
| `apps/web/src/api/speaking.ts` | Field + `updateSpeakingAttempt` + `generateSampleTalks` |
| `apps/web/src/pages/SpeakingAttemptPage.tsx` (+ test) | Prep hints, Result structure/vocab/samples |

Không tách `SpeakingAttemptPage.tsx` — file lớn theo nếp hiện tại, chỉ thêm khối Prep/Result.

---

### Task 1: Cột Prisma

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model `SpeakingAttempt`)
- Create: `apps/api/prisma/migrations/<timestamp>_speaking_attempt_learner_aids/migration.sql`

- [ ] **Step 1: Thêm field vào schema**

Trong `model SpeakingAttempt`, ngay sau `cueCard Json`, chèn:

```prisma
  /// string[] đúng 5 nhịp nói (mở → 3 bullet → đóng). null = bài trước feature.
  structure Json?
  /// { word, meaning, example, review?: true }[] — cụm nói được. null = bài cũ.
  vocabulary Json?
  /// Người học đã mở gợi ý lúc prep. Một chiều.
  hintsOpened Boolean @default(false)
  /// string[] đúng 2 transcript mẫu. null = chưa sinh.
  sampleTalks Json?
```

- [ ] **Step 2: Tạo migration**

Run:

```bash
cd apps/api && pnpm exec prisma migrate dev --name speaking_attempt_learner_aids --create-only
```

SQL phải là:

```sql
-- AlterTable
ALTER TABLE "SpeakingAttempt" ADD COLUMN     "structure" JSONB;
ALTER TABLE "SpeakingAttempt" ADD COLUMN     "vocabulary" JSONB;
ALTER TABLE "SpeakingAttempt" ADD COLUMN     "hintsOpened" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SpeakingAttempt" ADD COLUMN     "sampleTalks" JSONB;
```

Rồi:

```bash
cd apps/api && pnpm exec prisma migrate dev
```

Expected: migrate apply, `prisma generate` chạy.

- [ ] **Step 3: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations
git commit -m "$(cat <<'EOF'
Add speaking attempt columns for hints, vocab, and sample talks.

EOF
)"
```

---

### Task 2: `tagReviewVocabulary` dùng chung

**Files:**
- Create: `apps/api/src/practice/vocab-tag.ts`
- Create: `apps/api/src/practice/vocab-tag.spec.ts`
- Modify: `apps/api/src/practice/practice.service.ts` (xóa hàm cuối file, import helper)

- [ ] **Step 1: Viết test fail**

`apps/api/src/practice/vocab-tag.spec.ts`:

```ts
import { tagReviewVocabulary } from "./vocab-tag";

describe("tagReviewVocabulary", () => {
  it("returns the list unchanged when there are no candidates", () => {
    const vocabulary = [
      { word: "lively", meaning: "full of energy", example: "The crowd was lively." },
    ];
    expect(tagReviewVocabulary(vocabulary, [])).toEqual(vocabulary);
  });

  it("flags items whose normalized word matches a candidate", () => {
    const vocabulary = [
      { word: "lively", meaning: "full of energy", example: "The crowd was lively." },
      { word: "memorable", meaning: "worth remembering", example: "A memorable day." },
    ];
    const tagged = tagReviewVocabulary(vocabulary, [
      { word: "Lively", meaning: "full of energy", example: "The crowd was lively." },
    ]);
    expect(tagged).toEqual([
      { ...vocabulary[0], review: true },
      vocabulary[1],
    ]);
  });
});
```

- [ ] **Step 2: Chạy test — fail vì chưa có module**

```bash
pnpm --filter @writing-helper/api exec jest src/practice/vocab-tag.spec.ts --no-coverage
```

Expected: FAIL `Cannot find module './vocab-tag'`

- [ ] **Step 3: Implement**

`apps/api/src/practice/vocab-tag.ts`:

```ts
import { normalizeWord } from "./vocab-match";
import type { VocabSuggestItem } from "./vocab.service";

export function tagReviewVocabulary<T extends { word: string }>(
  vocabulary: T[],
  candidates: VocabSuggestItem[],
): Array<T & { review?: true }> {
  if (candidates.length === 0) return vocabulary;

  const reviewWords = new Set(
    candidates.map((item) => normalizeWord(item.word)).filter(Boolean),
  );

  return vocabulary.map((item) => {
    if (reviewWords.has(normalizeWord(item.word))) {
      return { ...item, review: true as const };
    }
    return item;
  });
}
```

Trong `practice.service.ts`: thêm `import { tagReviewVocabulary } from "./vocab-tag";` và **xóa** hàm `tagReviewVocabulary` ở cuối file (khoảng dòng 574–591). Giữ nguyên chỗ gọi `tagReviewVocabulary(generated.vocabulary, reviewCandidates)`.

- [ ] **Step 4: Chạy test**

```bash
pnpm --filter @writing-helper/api exec jest src/practice/vocab-tag.spec.ts src/practice/practice.service.spec.ts --no-coverage
```

Expected: PASS (create vẫn tag `review: true`)

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/practice/vocab-tag.ts apps/api/src/practice/vocab-tag.spec.ts apps/api/src/practice/practice.service.ts
git commit -m "$(cat <<'EOF'
Share review-vocab tagging between writing and speaking.

EOF
)"
```

---

### Task 3: Prompt + schema generate cue card

**Files:**
- Modify: `apps/api/src/speaking/speaking-generate-prompt.ts`
- Modify: `apps/api/src/speaking/speaking-generate-prompt.spec.ts`

- [ ] **Step 1: Sửa spec trước**

Thay toàn bộ `speaking-generate-prompt.spec.ts`:

```ts
import { buildSpeakingGeneratePrompt, SPEAKING_GENERATE_SCHEMA } from "./speaking-generate-prompt";
import type { SpeakingCueCard } from "@writing-helper/practice";

const seed: SpeakingCueCard = {
  level: "B1",
  topic: "Describe a trip you took",
  bullets: ["where you went", "who you went with", "what you did and how you felt"],
};

describe("buildSpeakingGeneratePrompt", () => {
  it("embeds the seed topic and level, asks for an original Part 2 card", () => {
    const prompt = buildSpeakingGeneratePrompt(seed, "B1");

    expect(prompt).toContain("B1");
    expect(prompt).toContain(seed.topic);
    expect(prompt).toContain(seed.bullets[0]);
    expect(prompt.toLowerCase()).toMatch(/part 2|cue card/);
    expect(prompt.toLowerCase()).toMatch(/invent|original|different/);
    expect(prompt.toLowerCase()).toMatch(/three|3/);
  });

  it("tells the model not to write a sample answer", () => {
    const prompt = buildSpeakingGeneratePrompt(seed, "A2");
    expect(prompt.toLowerCase()).toMatch(/do not write a sample|not.*sample answer/);
  });

  it("asks for five glanceable talking beats and spoken vocabulary chunks", () => {
    const prompt = buildSpeakingGeneratePrompt(seed, "B1");
    expect(prompt.toLowerCase()).toMatch(/5|five/);
    expect(prompt.toLowerCase()).toMatch(/opening|open/);
    expect(prompt.toLowerCase()).toMatch(/close|closing/);
    expect(prompt.toLowerCase()).toMatch(/phrase|beat|glance/);
    expect(prompt.toLowerCase()).toMatch(/not a full sentence to read aloud/);
    expect(prompt).toMatch(/6–8|6-8/);
    expect(prompt.toLowerCase()).toMatch(/spoken|collocation|chunk/);
  });

  it("when reviewWords is omitted or empty, prompt is byte-identical to the base prompt", () => {
    const base = buildSpeakingGeneratePrompt(seed, "A2");
    expect(buildSpeakingGeneratePrompt(seed, "A2", undefined)).toBe(base);
    expect(buildSpeakingGeneratePrompt(seed, "A2", [])).toBe(base);
  });

  it("when reviewWords is non-empty, instructs topic-first then fit review words into vocabulary", () => {
    const prompt = buildSpeakingGeneratePrompt(seed, "A2", [
      { word: "commute", meaning: "travel to work", example: "I commute by bus." },
      { word: "lively", meaning: "full of energy", example: "The crowd was lively." },
    ]);

    expect(prompt).toContain(buildSpeakingGeneratePrompt(seed, "A2"));
    expect(prompt.toLowerCase()).toMatch(/topic.*first|decide.*topic|choose.*topic/i);
    expect(prompt).toContain("commute");
    expect(prompt).toContain("lively");
    expect(prompt).toContain("0–4");
    expect(prompt.toLowerCase()).toMatch(/fit|suitable|match/);
    expect(prompt.toLowerCase()).toMatch(/rest|remaining|new/);
  });
});

describe("SPEAKING_GENERATE_SCHEMA", () => {
  it("requires topic, bullets, structure, and vocabulary", () => {
    expect(SPEAKING_GENERATE_SCHEMA.schema.required).toEqual(
      expect.arrayContaining(["topic", "bullets", "structure", "vocabulary"]),
    );
  });

  it("requires exactly three bullets and five structure beats", () => {
    const properties = SPEAKING_GENERATE_SCHEMA.schema.properties as Record<
      string,
      { minItems?: number; maxItems?: number }
    >;
    expect(properties.bullets?.minItems).toBe(3);
    expect(properties.bullets?.maxItems).toBe(3);
    expect(properties.structure?.minItems).toBe(5);
    expect(properties.structure?.maxItems).toBe(5);
  });
});
```

- [ ] **Step 2: Chạy — fail**

```bash
pnpm --filter @writing-helper/api exec jest src/speaking/speaking-generate-prompt.spec.ts --no-coverage
```

Expected: FAIL (schema chưa có `structure`; hàm chưa nhận `reviewWords`)

- [ ] **Step 3: Implement prompt**

Thay `apps/api/src/speaking/speaking-generate-prompt.ts` bằng:

```ts
import type { Level, SpeakingCueCard } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";
import type { VocabSuggestItem } from "../practice/vocab.service";

export const SPEAKING_GENERATE_SCHEMA: JsonSchemaSpec = {
  name: "speaking_cue_card",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["topic", "bullets", "structure", "vocabulary"],
    properties: {
      topic: { type: "string" },
      bullets: {
        type: "array",
        items: { type: "string" },
        minItems: 3,
        maxItems: 3,
      },
      structure: {
        type: "array",
        items: { type: "string" },
        minItems: 5,
        maxItems: 5,
      },
      vocabulary: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["word", "meaning", "example"],
          properties: {
            word: { type: "string" },
            meaning: { type: "string" },
            example: { type: "string" },
          },
        },
      },
    },
  },
};

export interface GeneratedCueCard {
  topic: string;
  bullets: [string, string, string] | string[];
  structure: string[];
  vocabulary: { word: string; meaning: string; example: string }[];
}

export type ReviewWord = VocabSuggestItem;

/**
 * Catalog card is a seed only. The model invents a fresh Part 2 cue card at
 * the same level — topic + three bullets + prep notes. Never a sample talk.
 */
export function buildSpeakingGeneratePrompt(
  seed: SpeakingCueCard,
  level: Level,
  reviewWords?: ReviewWord[],
): string {
  const base =
    `You write IELTS Speaking Part 2 cue cards for CEFR level ${level}.\n\n` +
    `Seed (inspiration only — invent a different original topic):\n` +
    `Topic: ${seed.topic}\n` +
    `Bullets:\n` +
    seed.bullets.map((b) => `- ${b}`).join("\n") +
    `\n\n` +
    `Invent a specific, original Part 2 topic suitable for ${level}. ` +
    `Give exactly three short bullet prompts the candidate should cover ` +
    `(who/what/where/when/why style), ending so the speaker can talk for up to 2 minutes.\n` +
    `Give exactly 5 short talking beats the candidate can glance at during prep: ` +
    `(1) a one-line opening, (2–4) one beat per cue bullet, (5) a one-line close. ` +
    `Each beat is a phrase, not a full sentence to read aloud.\n` +
    `Give 6–8 useful spoken chunks (collocations or short phrases a candidate would actually say) ` +
    `with meaning and a short example sentence they could speak.\n` +
    `Write everything in English. Do not write a sample answer.`;

  if (!reviewWords || reviewWords.length === 0) {
    return base;
  }

  const list = reviewWords
    .map((item) => `- ${item.word}: ${item.meaning} (e.g. ${item.example})`)
    .join("\n");

  return (
    base +
    `\n\nReview vocabulary (optional reuse):\n${list}\n` +
    `Decide the topic FIRST. Then include 0–4 of these review words in the vocabulary ` +
    `list only when they fit the topic; generate the rest as new words.`
  );
}
```

- [ ] **Step 4: Chạy test**

```bash
pnpm --filter @writing-helper/api exec jest src/speaking/speaking-generate-prompt.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/speaking/speaking-generate-prompt.ts apps/api/src/speaking/speaking-generate-prompt.spec.ts
git commit -m "$(cat <<'EOF'
Ask speaking generate for structure beats and spoken vocab.

EOF
)"
```

---

### Task 4: Prompt bài nói mẫu

**Files:**
- Create: `apps/api/src/speaking/speaking-sample-prompt.ts`
- Create: `apps/api/src/speaking/speaking-sample-prompt.spec.ts`

- [ ] **Step 1: Viết test fail**

`speaking-sample-prompt.spec.ts`:

```ts
import { SPEAKING_SAMPLE_SCHEMA, buildSpeakingSamplePrompt } from "./speaking-sample-prompt";

const cue = {
  topic: "Describe a festival you enjoyed",
  bullets: ["what the festival was", "who you went with", "why you enjoyed it"],
};

describe("buildSpeakingSamplePrompt", () => {
  it("includes level, topic, and all cue bullets", () => {
    const prompt = buildSpeakingSamplePrompt(cue, "B1");
    expect(prompt).toContain("B1");
    expect(prompt).toContain(cue.topic);
    expect(prompt).toContain(cue.bullets[0]);
    expect(prompt).toContain(cue.bullets[2]);
  });

  it("asks for two spoken transcripts at the learner's level, not essays", () => {
    const prompt = buildSpeakingSamplePrompt(cue, "A2");
    expect(prompt).toMatch(/two|2/);
    expect(prompt).toMatch(/150-250|150–250/);
    expect(prompt.toLowerCase()).toMatch(/transcript|spoken|speak/);
    expect(prompt.toLowerCase()).toMatch(/not .+ essay|not an essay|not essay/);
    expect(prompt).toContain("within level A2");
    expect(prompt.toLowerCase()).toMatch(/different approaches/);
    expect(prompt.toLowerCase()).not.toMatch(/stage direction/);
  });
});

describe("SPEAKING_SAMPLE_SCHEMA", () => {
  it("requires exactly two talk items with text only", () => {
    const schema = SPEAKING_SAMPLE_SCHEMA.schema as {
      properties: {
        talks: {
          minItems: number;
          maxItems: number;
          items: { required: string[]; additionalProperties: boolean };
        };
      };
    };
    expect(schema.properties.talks.minItems).toBe(2);
    expect(schema.properties.talks.maxItems).toBe(2);
    expect(schema.properties.talks.items.required).toEqual(["text"]);
    expect(schema.properties.talks.items.additionalProperties).toBe(false);
  });
});
```

- [ ] **Step 2: Chạy — fail**

```bash
pnpm --filter @writing-helper/api exec jest src/speaking/speaking-sample-prompt.spec.ts --no-coverage
```

Expected: FAIL `Cannot find module`

- [ ] **Step 3: Implement**

```ts
import type { Level } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";

export const SPEAKING_SAMPLE_SCHEMA: JsonSchemaSpec = {
  name: "speaking_sample_talks",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["talks"],
    properties: {
      talks: {
        type: "array",
        minItems: 2,
        maxItems: 2,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text"],
          properties: {
            text: { type: "string" },
          },
        },
      },
    },
  },
};

export interface SpeakingSampleResult {
  talks: { text: string }[];
}

export function buildSpeakingSamplePrompt(
  cue: { topic: string; bullets: string[] },
  level: Level,
): string {
  return (
    `Write two complete spoken model answers as transcripts for this IELTS Speaking Part 2 cue card, ` +
    `for a learner to study as reference.\n\n` +
    `CEFR level: ${level}\n` +
    `Topic: ${cue.topic}\n` +
    `You should say:\n` +
    cue.bullets.map((b) => `- ${b}`).join("\n") +
    `\n\n` +
    `Target length: 150–250 words each (about 90–120 seconds of speech).\n\n` +
    `Write exactly two talks that both fully cover the three bullets but take genuinely ` +
    `different approaches — different structure, angle, or tone — so the learner sees ` +
    `there is more than one way to do this well. Both must sit clearly within level ` +
    `${level}: natural and correct for a strong ${level} speaker, not one level above.\n` +
    `Write as speech, not an essay: contractions and discourse markers are fine. ` +
    `No stage directions and no commentary.`
  );
}
```

Nếu test `not .+ essay` fail vì câu "not an essay" — chỉnh regex trong test cho khớp chuỗi thật `not an essay`.

- [ ] **Step 4: Chạy test**

```bash
pnpm --filter @writing-helper/api exec jest src/speaking/speaking-sample-prompt.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/speaking/speaking-sample-prompt.ts apps/api/src/speaking/speaking-sample-prompt.spec.ts
git commit -m "$(cat <<'EOF'
Add spoken model-answer prompt for graded speaking attempts.

EOF
)"
```

---

### Task 5: `speaking.samples` dùng model text

**Files:**
- Modify: `apps/api/src/ai/ai.service.ts` (union `AiEndpoint`)
- Modify: `apps/api/src/ai/ai.service.spec.ts`

`resolveModel` chỉ gắn audio model khi `options.audio` hoặc endpoint `speaking.generate` / `speaking.grade`. **Không** thêm `speaking.samples`.

- [ ] **Step 1: Thêm test**

Trong `describe` model resolution của `ai.service.spec.ts`, cạnh test `speaking.generate`:

```ts
    it("dùng AI_MODEL cho speaking.samples, không dùng AI_MODEL_AUDIO", async () => {
      const fetchSpy = jest
        .spyOn(global, "fetch")
        .mockResolvedValue(jsonResponse({ choices: [{ message: { content: "ok" } }] }));

      const { service } = makeService({
        OPENROUTER_API_KEY: "key",
        AI_MODEL: "anthropic/claude-haiku-4.5",
        AI_MODEL_AUDIO: "google/gemini-2.5-flash",
      });

      await service.complete({
        prompt: "x",
        maxTokens: 10,
        usage: { userId: "user-1", endpoint: "speaking.samples" },
      });

      const [, init] = fetchSpy.mock.calls[0]!;
      const body = JSON.parse(init!.body as string) as { model: string };
      expect(body.model).toBe("anthropic/claude-haiku-4.5");
    });
```

- [ ] **Step 2: Chạy — fail type `speaking.samples`**

```bash
pnpm --filter @writing-helper/api exec jest src/ai/ai.service.spec.ts --no-coverage
```

Expected: TS/Jest fail vì `AiEndpoint` chưa có `"speaking.samples"`

- [ ] **Step 3: Thêm vào union**

```ts
export type AiEndpoint =
  | "rewrite"
  | "practice.generate"
  | "practice.grade"
  | "practice.marks"
  | "practice.samples"
  | "speaking.generate"
  | "speaking.grade"
  | "speaking.samples";
```

Không đổi `resolveModel`.

- [ ] **Step 4: Chạy test**

```bash
pnpm --filter @writing-helper/api exec jest src/ai/ai.service.spec.ts --no-coverage
```

Expected: PASS; test generate vẫn dùng audio model.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ai/ai.service.ts apps/api/src/ai/ai.service.spec.ts
git commit -m "$(cat <<'EOF'
Track speaking.samples usage on the text model.

EOF
)"
```

---

### Task 6: Service — create + PATCH + revise + samples

**Files:**
- Modify: `apps/api/src/speaking/speaking.service.ts`
- Modify: `apps/api/src/speaking/speaking.service.spec.ts`
- Modify: `apps/api/src/speaking/dto/speaking.dto.ts`
- Modify: `apps/api/src/speaking/speaking.controller.ts`
- Modify: `apps/api/src/speaking/speaking.module.ts`

Constructor đổi thành `(prisma, ai, vocab)`. Mọi `new SpeakingService` trong spec phải truyền vocab mock.

- [ ] **Step 1: Cập nhật harness + test create/update/revise/samples (viết trước, sẽ fail)**

Đổi `generatedCue` giữ **chỉ** `{ topic, bullets }` cho `cueCard`. Thêm payload AI đầy đủ:

```ts
const generatedCue = {
  topic: "Describe a festival you enjoyed",
  bullets: ["what the festival was", "who you went with", "why you enjoyed it"],
};

const generatedStructure = [
  "Name the festival in one breath",
  "What it was and when",
  "Who you went with",
  "Why you enjoyed it",
  "Close with how you feel now",
];

const generatedVocabulary = [
  { word: "packed", meaning: "very crowded", example: "The square was packed." },
];

const generatedFull = {
  ...generatedCue,
  structure: generatedStructure,
  vocabulary: generatedVocabulary,
};
```

Trong `serviceWith`, thêm vocab mock giống `practice.service.spec.ts` (`reviewCandidates`, `recordSuggested`, `reviewCandidatesError`, `recordSuggestedError`). Constructor:

```ts
const service = new SpeakingService(
  prisma as unknown as PrismaService,
  ai,
  vocab as never,
);
```

`complete` default `mockResolvedValue(generatedFull)`.

Return `{ service, prisma, complete, vocab }`.

Thay test create hiện tại và thêm:

```ts
    it("picks a seed, calls speaking.generate, and stores cue card plus prep notes", async () => {
      const { service, prisma, complete } = serviceWith({
        recentTopics: ["Describe a place you like to visit"],
        created: { id: "s1", level: "A2", cueCard: generatedCue },
      });

      await service.create("user-1", { level: "A2" });

      expect(complete).toHaveBeenCalledWith(
        expect.objectContaining({
          schema: SPEAKING_GENERATE_SCHEMA,
          maxTokens: 1500,
          usage: { userId: "user-1", endpoint: "speaking.generate" },
          prompt: expect.stringContaining("A2"),
        }),
      );
      expect(prisma.speakingAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: "user-1",
            level: "A2",
            cueCard: generatedCue,
            structure: generatedStructure,
            vocabulary: generatedVocabulary,
          }),
        }),
      );
    });

    it("flags matching vocabulary items with review: true and records all suggested", async () => {
      const candidates = [
        { word: "Packed", meaning: "very crowded", example: "The square was packed." },
      ];
      const { service, prisma, complete, vocab } = serviceWith();
      complete.mockResolvedValueOnce({
        ...generatedFull,
        vocabulary: generatedVocabulary,
      });
      vocab.reviewCandidates.mockResolvedValueOnce(candidates);

      await service.create("user-1", { level: "A2" });

      expect(prisma.speakingAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            vocabulary: [{ ...generatedVocabulary[0], review: true }],
          }),
        }),
      );
      expect(vocab.recordSuggested).toHaveBeenCalledWith(
        "user-1",
        "A2",
        generatedVocabulary,
      );
    });

    it("still creates the attempt when recordSuggested throws", async () => {
      jest.spyOn(Logger.prototype, "warn").mockImplementation();
      const { service, prisma } = serviceWith({
        recordSuggestedError: new Error("upsert failed"),
      });

      await expect(service.create("user-1", { level: "A2" })).resolves.toEqual(
        expect.objectContaining({ id: "s1" }),
      );
      expect(prisma.speakingAttempt.create).toHaveBeenCalled();
      expect(Logger.prototype.warn).toHaveBeenCalled();
      jest.restoreAllMocks();
    });
```

Thêm `describe("update")`:

```ts
  describe("update", () => {
    const open = {
      id: "s1",
      userId: "user-1",
      submittedAt: null,
      parent: null,
      revisions: [] as { id: string; submittedAt: Date | null }[],
    };

    it("sets hintsOpened to true", async () => {
      const { service, prisma } = serviceWith({
        attempt: open,
        updated: { id: "s1", hintsOpened: true },
      });

      await service.update("user-1", "s1", { hintsOpened: true });

      expect(prisma.speakingAttempt.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: { hintsOpened: true },
      });
    });

    it("409 when already submitted", async () => {
      const { service, prisma } = serviceWith({
        attempt: { ...open, submittedAt: new Date() },
      });
      await expect(
        service.update("user-1", "s1", { hintsOpened: true }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.speakingAttempt.update).not.toHaveBeenCalled();
    });
  });
```

Sửa test revise `"copies cueCard without calling AI"` — expect thêm:

```ts
            structure: generatedStructure,
            vocabulary: generatedVocabulary,
            hintsOpened: true,
```

Parent trong test đó phải có `structure`, `vocabulary`, `hintsOpened: true`. **Không** có `sampleTalks` trên `data`.

Thêm `describe("generateSamples")` copy pattern writing (`SAMPLE` → `SPEAKING_SAMPLE_SCHEMA`, field `sampleTalks`, endpoint `"speaking.samples"`, 409 message speaking). `complete` mock `{ talks: [{ text: "Talk one." }, { text: "Talk two." }] }`.

Import `SPEAKING_SAMPLE_SCHEMA` từ `./speaking-sample-prompt`.

- [ ] **Step 2: Chạy — fail constructor / methods missing**

```bash
pnpm --filter @writing-helper/api exec jest src/speaking/speaking.service.spec.ts --no-coverage
```

Expected: FAIL (constructor 2 args; `update`/`generateSamples` chưa có)

- [ ] **Step 3: Implement service + DTO + controller + module**

`dto/speaking.dto.ts` thêm:

```ts
import { IsBoolean, IsOptional } from "class-validator";

export class UpdateSpeakingAttemptDto {
  @IsOptional()
  @IsBoolean()
  hintsOpened?: boolean;
}
```

(Giữ import `class-validator` gộp một lần.)

`speaking.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { AiModule } from "../ai/ai.module";
import { AuthModule } from "../auth/auth.module";
import { VocabService } from "../practice/vocab.service";
import { SpeakingController } from "./speaking.controller";
import { SpeakingService } from "./speaking.service";

@Module({
  imports: [AuthModule, AiModule],
  controllers: [SpeakingController],
  providers: [SpeakingService, VocabService],
})
export class SpeakingModule {}
```

Controller: import `Patch`, `UpdateSpeakingAttemptDto`. Thêm:

```ts
  @Patch(":id")
  update(
    @CurrentUserId() userId: string,
    @Param("id") id: string,
    @Body() dto: UpdateSpeakingAttemptDto,
  ) {
    return this.speaking.update(userId, id, dto);
  }

  @Post(":id/samples")
  @UseGuards(UserThrottlerGuard, DailyAiQuotaGuard)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  generateSamples(@CurrentUserId() userId: string, @Param("id") id: string) {
    return this.speaking.generateSamples(userId, id);
  }
```

`speaking.service.ts` — import `VocabService`, `tagReviewVocabulary`, `UpdateSpeakingAttemptDto`, sample prompt types, `Level`.

Constructor:

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly vocab: VocabService,
  ) {}
```

`create()`: `maxTokens: 1500`. Trước `complete`, lấy review candidates (try/catch warn). `buildSpeakingGeneratePrompt(seed, dto.level as Level, reviewCandidates)`. Sau generated:

```ts
    const cueCard = {
      topic: generated.topic.trim(),
      bullets: generated.bullets.map((b) => b.trim()).slice(0, 3),
    };
    const structure = generated.structure.map((beat) => beat.trim()).slice(0, 5);
    const vocabulary = tagReviewVocabulary(generated.vocabulary, reviewCandidates);

    const attempt = await this.prisma.speakingAttempt.create({
      data: {
        userId,
        level: dto.level,
        cueCard: cueCard as Prisma.InputJsonValue,
        structure: structure as Prisma.InputJsonValue,
        vocabulary: vocabulary as Prisma.InputJsonValue,
      },
    });

    try {
      await this.vocab.recordSuggested(userId, dto.level, generated.vocabulary);
    } catch (error: unknown) {
      this.logger.warn(
        `event=vocab_record_suggested_failed userId=${userId} ${error instanceof Error ? error.message : "unknown"}`,
      );
    }

    return attempt;
```

`reviewCandidates` khởi tạo `[]` nếu throw (giống writing).

`update()`:

```ts
  async update(userId: string, id: string, dto: UpdateSpeakingAttemptDto) {
    const attempt = await this.findOne(userId, id);
    if (attempt.submittedAt) {
      throw new ConflictException("Submitted speaking cannot be edited");
    }
    return this.prisma.speakingAttempt.update({
      where: { id },
      data: {
        ...(dto.hintsOpened ? { hintsOpened: true } : {}),
      },
    });
  }
```

`revise()` create data thêm:

```ts
          structure: parent.structure as Prisma.InputJsonValue,
          vocabulary: parent.vocabulary as Prisma.InputJsonValue,
          hintsOpened: parent.hintsOpened,
```

(`structure`/`vocabulary` có thể null trên bài cũ — Prisma chấp nhận.)

`generateSamples()` mirror `PracticeService.generateSamples`: 409 `"Speaking attempt has not been graded yet"`; nếu `sampleTalks != null` return attempt; `asCueCard(attempt.cueCard)`; `complete` `SPEAKING_SAMPLE_SCHEMA`, `maxTokens: 2500`, `endpoint: "speaking.samples"`; lưu `generated.talks.map((t) => t.text)`.

- [ ] **Step 4: Chạy unit**

```bash
pnpm --filter @writing-helper/api exec jest src/speaking/speaking.service.spec.ts --no-coverage
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/speaking apps/api/src/practice/vocab-tag.ts
git commit -m "$(cat <<'EOF'
Store speaking prep notes and generate sample talks after grading.

EOF
)"
```

(Không add lại vocab-tag nếu đã commit Task 2.)

---

### Task 7: E2E mock generate + PATCH/samples

**Files:**
- Modify: `apps/api/test/app.e2e-spec.ts` (`describe("speaking")`)

- [ ] **Step 1: Mở rộng `generatedCue` trong e2e**

```ts
    const generatedCue = {
      topic: "Describe a festival you enjoyed",
      bullets: ["what the festival was", "who you went with", "why you enjoyed it"],
    };
    const generatedPrep = {
      ...generatedCue,
      structure: [
        "Name the festival in one breath",
        "What it was and when",
        "Who you went with",
        "Why you enjoyed it",
        "Close with how you feel now",
      ],
      vocabulary: [
        { word: "packed", meaning: "very crowded", example: "The square was packed." },
      ],
    };
```

Trong `mockSpeakingAi`:

- `schemaName === "speaking_grade"` → `graded`
- `schemaName === "speaking_sample_talks"` → `{ talks: [{ text: "Talk one." }, { text: "Talk two." }] }`
- else → `generatedPrep`

Assertion tạo attempt:

```ts
      expect(created.body.cueCard).toEqual(generatedCue);
      expect(created.body.structure).toHaveLength(5);
      expect(created.body.vocabulary[0].word).toBe("packed");
      expect(created.body.hintsOpened).toBe(false);
      expect(created.body.sampleTalks).toBeNull();
```

Revise vẫn `cueCard === generatedCue`; thêm `expect(revised.body.structure).toHaveLength(5)`.

Thêm test:

```ts
    it("PATCH hintsOpened rồi 409 sau khi nộp; samples sau chấm, bấm lại không gọi AI", async () => {
      const fetchSpy = mockSpeakingAi();
      const { accessToken } = await registerUser("speaking-aids@example.com");
      const auth = { Authorization: `Bearer ${accessToken}` };

      const created = await server()
        .post("/speaking/attempts")
        .set(auth)
        .send({ level: "B1" })
        .expect(201);
      const id = created.body.id as string;
      const afterGenerate = fetchSpy.mock.calls.length;

      const hinted = await server()
        .patch(`/speaking/attempts/${id}`)
        .set(auth)
        .send({ hintsOpened: true })
        .expect(200);
      expect(hinted.body.hintsOpened).toBe(true);
      expect(fetchSpy.mock.calls.length).toBe(afterGenerate);

      await server()
        .post(`/speaking/attempts/${id}/submit`)
        .set(auth)
        .send({ audioBase64: "QUFBQUFB", format: "wav", durationMs: 15_000 })
        .expect(201);

      await server()
        .patch(`/speaking/attempts/${id}`)
        .set(auth)
        .send({ hintsOpened: true })
        .expect(409);

      const afterGrade = fetchSpy.mock.calls.length;
      const samples = await server()
        .post(`/speaking/attempts/${id}/samples`)
        .set(auth)
        .expect(201);
      expect(samples.body.sampleTalks).toEqual(["Talk one.", "Talk two."]);
      expect(fetchSpy.mock.calls.length).toBe(afterGrade + 1);

      await server().post(`/speaking/attempts/${id}/samples`).set(auth).expect(201);
      expect(fetchSpy.mock.calls.length).toBe(afterGrade + 1);
    });
```

(Nếu create trả 201 vs 200, khớp status test create hiện tại — đang `expect(201)`.)

- [ ] **Step 2: Chạy e2e speaking**

```bash
pnpm --filter @writing-helper/api exec jest --config ./test/jest-e2e.json --runInBand -t speaking
```

Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/api/test/app.e2e-spec.ts
git commit -m "$(cat <<'EOF'
Cover speaking hints and sample talks in e2e.

EOF
)"
```

---

### Task 8: API client web

**Files:**
- Modify: `apps/web/src/api/speaking.ts`
- Modify: `apps/web/src/pages/SpeakingAttemptPage.test.tsx` (fixture cho compile)

- [ ] **Step 1: Thêm type + hàm**

Trên `SpeakingAttemptDetail`:

```ts
  structure: string[] | null;
  vocabulary: { word: string; meaning: string; example: string; review?: boolean }[] | null;
  hintsOpened: boolean;
  sampleTalks: string[] | null;
```

Thêm:

```ts
export const updateSpeakingAttempt = (id: string, input: { hintsOpened?: boolean }) =>
  apiJson<SpeakingAttemptDetail>(`/speaking/attempts/${id}`, "PATCH", input);

export const generateSampleTalks = (id: string) =>
  apiJson<SpeakingAttemptDetail>(`/speaking/attempts/${id}/samples`, "POST", {});
```

Trong `SpeakingAttemptPage.test.tsx`, `openAttempt` thêm:

```ts
  structure: [
    "Name the journey",
    "Where you went",
    "Who you went with",
    "Why it was memorable",
    "Close with how you feel now",
  ],
  vocabulary: [
    { word: "scenic", meaning: "beautiful to look at", example: "We took a scenic route." },
  ],
  hintsOpened: false,
  sampleTalks: null,
```

Mock thêm `updateSpeakingAttempt`, `generateSampleTalks` trong `vi.mock("../api/speaking")` và `beforeEach` `mockReset`. Import hai hàm.

Chưa viết assertion hints — chỉ để typecheck/test cũ compile.

- [ ] **Step 2: Chạy test page hiện tại**

```bash
pnpm --filter @writing-helper/web test src/pages/SpeakingAttemptPage.test.tsx
```

Expected: PASS (prep/record/result cũ vẫn chạy; `Show hints` có thể đã hiện vì fixture có structure — test prep hiện tại không assert vắng nút, nên vẫn PASS)

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/api/speaking.ts apps/web/src/pages/SpeakingAttemptPage.test.tsx
git commit -m "$(cat <<'EOF'
Expose speaking hint and sample-talk API on the client.

EOF
)"
```

---

### Task 9: UI Prep — Show hints

**Files:**
- Modify: `apps/web/src/pages/SpeakingAttemptPage.tsx`
- Modify: `apps/web/src/pages/SpeakingAttemptPage.test.tsx`

- [ ] **Step 1: Test fail**

Thêm describe (cùng file):

```ts
describe("SpeakingAttemptPage prep hints", () => {
  beforeEach(() => {
    vi.mocked(getSpeakingAttempt).mockReset();
    vi.mocked(updateSpeakingAttempt).mockReset();
    vi.mocked(updateSpeakingAttempt).mockImplementation(async (_id, input) => ({
      ...openAttempt,
      ...input,
      hintsOpened: input.hintsOpened ?? openAttempt.hintsOpened,
    }));
  });

  afterEach(() => {
    cleanup();
  });

  it("shows Show hints on prep and PATCHes hintsOpened", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue(openAttempt);
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "Show hints" }));

    expect(await screen.findByText("Structure")).toBeTruthy();
    expect(screen.getByText("Name the journey")).toBeTruthy();
    expect(screen.getByText("scenic")).toBeTruthy();
    expect(updateSpeakingAttempt).toHaveBeenCalledWith("s1", { hintsOpened: true });
  });

  it("hides hints after skipping prep", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue(openAttempt);
    renderPage();
    fireEvent.click(await screen.findByRole("button", { name: "Show hints" }));
    expect(await screen.findByText("Structure")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Skip prep/i }));

    expect(await screen.findByRole("button", { name: /Stop recording/i })).toBeTruthy();
    expect(screen.queryByText("Structure")).toBeNull();
    expect(screen.queryByRole("button", { name: "Show hints" })).toBeNull();
  });

  it("does not show the hints door when structure and vocabulary are missing", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue({
      ...openAttempt,
      structure: null,
      vocabulary: null,
    });
    renderPage();
    await screen.findByText("Describe a memorable journey");
    expect(screen.queryByRole("button", { name: "Show hints" })).toBeNull();
  });
});
```

- [ ] **Step 2: Chạy — fail không có nút**

```bash
pnpm --filter @writing-helper/web test src/pages/SpeakingAttemptPage.test.tsx
```

Expected: FAIL `Unable to find role="button" name="Show hints"`

- [ ] **Step 3: Implement Prep**

Trong `SpeakingSession`:

```ts
  const [hintsOpen, setHintsOpen] = useState(attempt.hintsOpened);
  const saveHints = useMutation({
    mutationFn: () => updateSpeakingAttempt(attempt.id, { hintsOpened: true }),
  });

  const openHints = () => {
    setHintsOpen(true);
    if (!attempt.hintsOpened) {
      saveHints.mutate();
    }
  };
```

Import `updateSpeakingAttempt`.

`hasLearnerAids`:

```ts
function hasLearnerAids(attempt: SpeakingAttemptDetail): boolean {
  return (attempt.structure?.length ?? 0) > 0 || (attempt.vocabulary?.length ?? 0) > 0;
}
```

Truyền vào `PrepPhase`: `attempt`, `hintsOpen`, `onOpenHints`.

`PrepPhase` — dưới list bullets, trên Skip prep, copy markup writing (`Show hints` / `Hints`, khối Structure list-disc, Vocabulary word · meaning + example italic + badge `review`). Chỉ render cửa nếu `hasLearnerAids(attempt)`.

Không đổi `RecordPhase` / `ReviewPhase`.

- [ ] **Step 4: Chạy test**

```bash
pnpm --filter @writing-helper/web test src/pages/SpeakingAttemptPage.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/SpeakingAttemptPage.tsx apps/web/src/pages/SpeakingAttemptPage.test.tsx
git commit -m "$(cat <<'EOF'
Show speaking structure and vocab hints during prep only.

EOF
)"
```

---

### Task 10: UI Result — structure, vocab, model answers

**Files:**
- Modify: `apps/web/src/pages/SpeakingAttemptPage.tsx`
- Modify: `apps/web/src/pages/SpeakingAttemptPage.test.tsx`

- [ ] **Step 1: Test fail**

```ts
describe("SpeakingAttemptPage result aids", () => {
  const graded = {
    ...openAttempt,
    submittedAt: "2026-08-28T10:05:00.000Z",
    band: 6,
    transcript: "I went to Paris um yesterday",
    marks: [{ start: 15, end: 17, kind: "filler" as const, note: "filler word" }],
    fluency: { wordsPerMinute: 110, fillerCount: 1 },
    scores: {
      fluencyCoherence: 6,
      lexicalResource: 6,
      grammaticalRange: 5.5,
      pronunciation: 6,
    },
    feedback: {
      fluencyCoherence: "Steady pace.",
      lexicalResource: "Adequate.",
      grammaticalRange: "Simple forms.",
      pronunciation: "Clear enough.",
      overview: "A fair talk.",
      nextFocus: "Cut fillers.",
    },
  };

  beforeEach(() => {
    vi.mocked(getSpeakingAttempt).mockReset();
    vi.mocked(generateSampleTalks).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows structure, vocabulary, and the model-answer button after grading", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue(graded);
    renderPage();

    expect(await screen.findByText("Structure")).toBeTruthy();
    expect(screen.getByText("Name the journey")).toBeTruthy();
    expect(screen.getByText("scenic")).toBeTruthy();
    expect(screen.getByRole("button", { name: "See model answers" })).toBeTruthy();
  });

  it("loads sample talks and hides the button", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue(graded);
    vi.mocked(generateSampleTalks).mockResolvedValue({
      ...graded,
      sampleTalks: ["First model talk.", "Second model talk."],
    });
    renderPage();

    fireEvent.click(await screen.findByRole("button", { name: "See model answers" }));

    expect(await screen.findByText("First model talk.")).toBeTruthy();
    expect(screen.getByText("Second model talk.")).toBeTruthy();
    expect(generateSampleTalks).toHaveBeenCalledWith("s1");
    expect(screen.queryByRole("button", { name: "See model answers" })).toBeNull();
  });

  it("omits structure and vocab blocks when the attempt has no prep notes", async () => {
    vi.mocked(getSpeakingAttempt).mockResolvedValue({
      ...graded,
      structure: null,
      vocabulary: null,
    });
    renderPage();

    await screen.findByText(/I went to Paris um yesterday/);
    expect(screen.queryByText("Structure")).toBeNull();
    expect(screen.getByRole("button", { name: "See model answers" })).toBeTruthy();
  });
});
```

- [ ] **Step 2: Chạy — fail**

```bash
pnpm --filter @writing-helper/web test src/pages/SpeakingAttemptPage.test.tsx
```

Expected: FAIL không thấy `See model answers` trên result

- [ ] **Step 3: Implement ResultView**

Import `generateSampleTalks`, `SampleEssays`, `useQueryClient`.

Trong `ResultView`: `const queryClient = useQueryClient();`

```ts
  const samples = useMutation({
    mutationFn: () => generateSampleTalks(attempt.id),
    onSuccess: (updated) => {
      queryClient.setQueryData(["speaking-attempt", attempt.id], updated);
    },
  });
```

Trong sidebar, **sau** section Next time (`attempt.feedback`), trước đóng `</div>` của panel:

```tsx
            {hasLearnerAids(attempt) && (
              <section className="mt-8 border-t border-rule pt-6 space-y-5 text-sm">
                {attempt.structure && attempt.structure.length > 0 && (
                  <div>
                    <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
                      Structure
                    </h2>
                    <ul className="mt-2 list-disc space-y-1 pl-4 text-ink-soft">
                      {attempt.structure.map((beat) => (
                        <li key={beat}>{beat}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {attempt.vocabulary && attempt.vocabulary.length > 0 && (
                  <div>
                    <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
                      Vocabulary
                    </h2>
                    <ul className="mt-2 space-y-2">
                      {attempt.vocabulary.map((item) => (
                        <li key={item.word}>
                          <span className="font-display">{item.word}</span>
                          {item.review && (
                            <span className="ml-2 inline-block border border-vermilion px-1.5 py-px font-mono text-[0.6rem] uppercase tracking-[0.12em] text-vermilion">
                              review
                            </span>
                          )}
                          <span className="text-ink-soft"> · {item.meaning}</span>
                          <span className="mt-0.5 block italic text-ink-faint">{item.example}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            <SampleEssays
              sampleEssays={attempt.sampleTalks}
              onGenerate={() => samples.mutate()}
              isPending={samples.isPending}
            />
```

Cửa hints **không** dùng ở result — hiện thẳng.

- [ ] **Step 4: Chạy web tests**

```bash
pnpm --filter @writing-helper/web test src/pages/SpeakingAttemptPage.test.tsx src/practice/SampleEssays.test.tsx
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/pages/SpeakingAttemptPage.tsx apps/web/src/pages/SpeakingAttemptPage.test.tsx
git commit -m "$(cat <<'EOF'
Show speaking structure, vocab, and model talks after grading.

EOF
)"
```

---

### Task 11: Kiểm cuối

- [ ] **Step 1: Unit API + web + e2e speaking**

```bash
pnpm --filter @writing-helper/api exec jest --no-coverage
pnpm --filter @writing-helper/web test
pnpm --filter @writing-helper/api exec jest --config ./test/jest-e2e.json --runInBand -t speaking
```

Expected: PASS

- [ ] **Step 2: Typecheck**

```bash
pnpm --filter @writing-helper/api typecheck
pnpm --filter @writing-helper/web typecheck
```

Expected: no errors

Nếu còn fixture `SpeakingAttemptDetail` thiếu field (SpeakingPage.test), bổ sung `structure: null`, `vocabulary: null`, `hintsOpened: false`, `sampleTalks: null`.

---

## Spec coverage

| Spec | Task |
|---|---|
| `structure` 5 + `vocabulary` + `hintsOpened` + `sampleTalks` | 1, 3, 6 |
| Generate cùng cue; không sample lúc generate | 3, 6 |
| Review words + `recordSuggested` + fail vẫn create | 2, 6 |
| PATCH hints một chiều, 409 submitted | 6, 7 |
| Samples sau chấm, idempotent, `speaking.samples` text model | 4, 5, 6, 7 |
| Revise copy structure/vocab/hintsOpened, không copy samples | 6 |
| Prep door; Record/Review không hints | 9 |
| Result hiện thẳng + SampleEssays | 10 |
| Bài cũ không cửa hints; samples vẫn sinh | 9, 10, 7 |
| E2E mock schema mới | 7 |
| Không TTS, không bullets lúc record, không đổi `reviewCandidates` | ngoài plan |
