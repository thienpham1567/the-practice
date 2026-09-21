# Gợi ý luyện nói (hint / vocab / bố cục / sample) — thiết kế

**Ngày:** 2026-09-21
**Trạng thái:** đã chọn hướng B với người dùng, chờ duyệt spec trước khi viết plan

## 1. Mục tiêu

Người học Part 2 được cùng bốn loại trợ giúp như trang writing — gợi ý, từ vựng, bố cục, bài mẫu — nhưng **không biến lượt nói 2 phút thành đọc to**.

Writing: ideas + vocab nằm sau cửa `Show hints` suốt giờ làm bài; 2 bài mẫu chỉ sau khi chấm. Speaking: cửa hints chỉ lúc **chuẩn bị 60 giây**; lúc ghi âm chỉ còn cue card; 2 bài nói mẫu (transcript) sau khi chấm, bấm mới sinh, một lần.

## 2. Ngoài phạm vi

- Audio / TTS cho bài mẫu (giữ nguyên quyết định 2026-08-28: không TTS).
- Hiện hints lúc Record hoặc Review (nghe lại trước khi nộp).
- Part 1 / Part 3, kịch bản đọc thành lời, hiện bullets lúc record (giữ UI record hiện tại: topic + đồng hồ).
- Đổi `VocabService.reviewCandidates` để đọc thêm `SpeakingAttempt` — sổ `/vocab` dùng chung, nguồn ứng viên review vẫn như writing.

## 3. Mapping

| Writing | Speaking |
|---|---|
| `ideas` (4–6) sau `Show hints` | `structure` đúng 5 nhịp: mở → 3 bullet cue → đóng. Cụm để liếc, không phải câu đầy đủ. |
| `vocabulary` 6–8, tag `review` | Cùng shape. Nội dung là **cụm nói được** (collocation / cụm ngắn), nghĩa + câu ví dụ để *nói*. Field JSON vẫn `word` để khớp `VocabEntry`. |
| `hintsOpened` | Cùng cửa một chiều. Chỉ hiện và chỉ mở được ở pha **Prep**. |
| `sampleEssays` sau chấm | `sampleTalks`: 2 transcript ~150–250 từ, đúng CEFR của attempt, hai hướng khác nhau. Không audio. |

Sinh `structure` + `vocabulary` **cùng** lượt tạo cue card (một lần AI, như writing sinh prompt + ideas + vocab). Sample là lượt AI riêng sau khi đã chấm.

## 4. Data model

Thêm trên `SpeakingAttempt` (Prisma + migration):

```
structure    Json?     // string[] đúng 5 phần tử sau khi generate; null = bài cũ trước migration
vocabulary   Json?     // { word, meaning, example, review?: true }[]
hintsOpened  Boolean   @default(false)
sampleTalks  Json?     // null = chưa sinh; string[] đúng 2 khi đã sinh
```

- `null` trên `structure` / `vocabulary`: attempt tạo trước feature — UI **không** hiện nút `Show hints`.
- `sampleTalks` lưu **theo từng attempt**, không chia sẻ chuỗi revision (giống `sampleEssays`). Round 0 và round 1 có thể có hai bộ mẫu riêng nếu người học bấm ở cả hai.
- Revision copy `structure`, `vocabulary`, `hintsOpened` từ parent. **Không** copy `sampleTalks`.

## 5. Backend

### 5.1 Generate cue card

Mở rộng `SPEAKING_GENERATE_SCHEMA` / `GeneratedCueCard`:

- `required`: `topic`, `bullets`, `structure`, `vocabulary`
- `structure`: array string, `minItems`/`maxItems` = 5
- `vocabulary`: array object `{ word, meaning, example }` — cùng shape writing. Prompt yêu cầu 6–8; schema **không** gắn min/max (giống writing), tránh generate fail vì lệch 1 item.

`buildSpeakingGeneratePrompt(seed, level, reviewWords?)`:

- Giữ: invent topic gốc, đúng 3 bullet, English, **Do not write a sample answer**.
- Thêm: đúng 5 talking beats (opening; một beat cho mỗi bullet; close). Mỗi beat là cụm ngắn, không phải câu để đọc thành lời.
- Thêm: 6–8 spoken chunks + meaning + short spoken example.
- Khi có `reviewWords`: cùng quy tắc writing — quyết định topic trước, rồi nhét 0–4 từ review vào vocabulary nếu khớp; phần còn lại từ mới.

`create()`:

- `maxTokens` tăng 800 → 1500 (thêm structure + vocab).
- Gọi `VocabService.reviewCandidates` / `recordSuggested` giống writing, `try/catch` + warn, **vẫn tạo attempt** nếu vocab fail.
- Tag `review: true` bằng cùng logic `tagReviewVocabulary` — chuyển helper ra chỗ dùng chung (`vocab.service` hoặc file thuần cạnh nó) để writing và speaking không lệch.
- Lưu `structure` (trim, slice 5) và `vocabulary` đã tag.

`SpeakingModule` thêm `VocabService` vào `providers` (cùng class, Prisma singleton). Không import cả `PracticeModule`.

### 5.2 PATCH hints

Hiện speaking không có update. Thêm:

- `PATCH /speaking/attempts/:id`
- Body: `{ hintsOpened?: boolean }`
- Không gọi AI, không quota.
- Chỉ ghi `hintsOpened: true` khi DTO truthy (một chiều, giống writing). Không cho tắt.
- 409 nếu đã `submittedAt`. 404 nếu không thuộc user.

### 5.3 Sample talks

File mới `speaking-sample-prompt.ts`:

- Schema `{ talks: [{ text }, { text }] }`, đúng 2.
- Prompt: two complete spoken model answers as transcripts the learner can study; CEFR = level của attempt (không band 9 cho A2); ~150–250 words each (~90–120 giây nói); cover cả 3 bullet; giọng nói tự nhiên (contraction, discourse marker), không văn essay; hai hướng khác nhau; không stage direction, không chú thích.

Endpoint: `POST /speaking/attempts/:id/samples`

- Guards: `UserThrottlerGuard`, `DailyAiQuotaGuard` — tính quota như mọi lượt AI.
- 409 `"Speaking attempt has not been graded yet"` nếu chưa `submittedAt` / chưa có `band`.
- Nếu `sampleTalks != null`: trả attempt hiện tại, **không** gọi AI.
- Ngược lại: `AiService.complete`, `usage.endpoint: "speaking.samples"` (thêm vào union `AiEndpoint`), `maxTokens` 2500, timeout/deadline practice; lưu `sampleTalks` là `string[]` 2 phần tử.

### 5.4 Revision

`revise()` copy thêm `structure`, `vocabulary`, `hintsOpened`. Cue card vốn đã copy.

## 6. Frontend

Copy UI English (sản phẩm đang English).

### Prep

Dưới 3 bullet, trên `Skip prep`:

- Nếu `structure` và `vocabulary` đều thiếu/rỗng: không hiện cửa hints.
- Không thì nút `Show hints` / `Hints` (cùng pattern writing). Mở → hiện hai khối `Structure` (list 5) và `Vocabulary` (word · meaning, example italic, badge `review`).
- Mở lần đầu: `PATCH` `{ hintsOpened: true }`. State local mở ngay cả khi PATCH chậm/fail.
- Reload giữa giờ prep: `hintsOpened === true` thì cửa đã mở.

### Record / Review

Không hints, không structure, không vocab.

### Result

Sidebar Scores, **sau** khối Next time:

1. `Structure` + `Vocabulary` — hiện thẳng (không cửa). Attempt cũ không có data thì bỏ cả hai khối.
2. Tái dùng `SampleEssays` (nút `See model answers` / heading `Model answers`) với `sampleTalks`. Không abstract thêm component trừ khi copy lệch.

API client: thêm field trên `SpeakingAttemptDetail`; `updateSpeakingAttempt`; `generateSampleTalks`.

## 7. Lỗi và bài cũ

- Generate hỏng: không tạo attempt (như hiện tại) — không lưu cue không có structure.
- `recordSuggested` fail: attempt vẫn tạo, log warn.
- Sample fail: không ghi `sampleTalks`; UI giữ nút, người học bấm lại.
- Attempt trước migration: cue vẫn dùng được; không hints; không structure/vocab trên result; sample vẫn sinh được (chỉ cần topic + bullets + level).

## 8. Kiểm thử

- `speaking-generate-prompt.spec.ts`: schema 5 structure + vocab; prompt cấm sample; nhánh review words (byte-identical khi không có list, giống writing).
- `speaking-sample-prompt.spec.ts`: schema đúng 2 talks; prompt có level, topic, bullets, độ dài, spoken not essay.
- `speaking.service.spec.ts`: create lưu structure/vocab, tag review, recordSuggested; recordSuggested throw vẫn create; PATCH hintsOpened; PATCH sau submit → 409; revise copy structure/vocab/hintsOpened, không copy sampleTalks; generateSamples 409 / idempotent / gọi AI một lần.
- `SpeakingAttemptPage.test.tsx`: prep hiện `Show hints`; bấm thì PATCH; skip prep → không còn hints; result hiện structure/vocab và nút model answers.

Không thêm E2E OpenRouter cho nhánh này.
