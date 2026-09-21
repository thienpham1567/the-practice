# TOEIC Speaking & Writing — luyện từng dạng (pha B) — thiết kế

**Ngày:** 2026-09-21  
**Trạng thái:** đã chốt với người dùng: **B rồi C**. Spec này chỉ pha B. Full mock 11+8 (pha C) ngoài phạm vi.  
**Nguồn ETS:** [About S&W](https://www.ets.org/toeic/about/speaking-writing.html), [Examinee Handbook](https://www.ets.org/pdfs/toeic/toeic-speaking-writing-examinee-handbook.pdf), [Score User Guide](https://www.ets.org/pdfs/toeic/toeic-speaking-writing-score-user-guide.pdf)

## 1. Mục tiêu

Người học luyện **đúng dạng bài TOEIC Speaking & Writing** (không IELTS), thấy **rating thô theo thang ETS của dạng đó** và một **practice score 0–200** có nhãn rõ là ước lượng — để nhắm dải 180–200 (C1 ETS: Speaking ≥180, Writing ≥180).

App giữ vòng hiện tại: chọn **một dạng** → làm có giờ → nộp → chấm. Không làm đủ 19 câu một phiên (đó là C).

## 2. Ngoài phạm vi (pha C và khác)

- Mock đủ 11 speaking + 8 writing, cộng rating → scaled official.
- TOEIC Listening & Reading (990).
- Nhân band IELTS cũ ra điểm TOEIC.
- TTS / đọc giúp read-aloud.
- Đổi sổ vocab/mistakes trừ chỗ copy IELTS.

## 3. Quyết định đã chốt

| Việc | Chọn | Lý do |
|---|---|---|
| Chọn đề | **Task type**, không còn A2–C1 làm khung đề | TOEIC một format cho mọi trình độ; điểm mới nói trình độ |
| Điểm hiện | `rawRating` (thang ETS của dạng) + `estimatedScaled` 0–200 bước 10 | Một câu không phải điểm official; UI phải ghi *Practice score, not an official TOEIC score* |
| Công thức 0–200 | `round((raw / maxRaw) * 20) * 10` | 3/3 và 5/5 → 200; 2/3 → 130; 4/5 → 160. Minh bạch, không giả bảng ETS |
| CEFR | Chỉ **suy từ** `estimatedScaled` bằng cắt ETS (guideline) | Speaking 50/90/120/160/180; Writing 30/70/120/150/180 |
| Ảnh | Catalog ảnh sẵn trong repo, không sinh AI mỗi lần | Q1–5 writing và Q3–4 speaking cần picture |
| Bài IELTS cũ | Giữ nguyên; `scale: "ielts"` | Không rewrite lịch sử; chart mới chỉ vẽ `scale: "toeic"` |
| Learner aids | Giữ cửa hints + sample sau chấm | Đổi *nội dung* cho đúng dạng TOEIC |
| Revision | Vẫn tối đa 2 vòng | Cùng đề, chấm độc lập |

## 4. Catalog writing (thay `TASK_CATALOG`)

Ba loại — đúng ETS Writing:

| `type` | ETS | Timer luyện 1 câu | Độ dài | Prompt frame |
|---|---|---|---|---|
| `picture-sentence` | Q1–5 | **90 giây** (8 phút / 5, làm từng câu) | 1 câu; bắt buộc dùng 2 từ cho sẵn (đổi form được) | Ảnh + hai từ/cụm |
| `email-request` | Q6–7 | **10 phút** | Email trả lời request | Email gốc + 2–3 việc phải trả |
| `opinion-essay` | Q8 | **30 phút** | **≥300 từ** (ETS: typically minimum 300) | Câu hỏi opinion workplace/daily |

Bỏ: `describe-experience`, `letter`, `review`, `discussion-essay`, `problem-solution`, `report`. `email` cũ (80–120 từ, 20 phút) **thay** bằng `email-request`.

`create` nhận `{ taskType }` bắt buộc, không nhận `level`.

## 5. Catalog speaking (thay `SPEAKING_CATALOG` / cue card Part 2)

Năm loại — đúng ETS Speaking:

| `type` | ETS | Prep | Nói | Rating max | Payload đề |
|---|---|---|---|---|---|
| `read-aloud` | Q1–2 | 45s | 45s | 3 | Đoạn ~40–60 từ trên màn |
| `describe-picture` | Q3–4 | 45s | 30s | 3 | Ảnh |
| `respond-question` | Q5–7 | 3s | **15s** (luyện Q5–6) hoặc **30s** (Q7) — catalog ghi `speakSeconds` | 3 | Câu hỏi (workplace/daily) |
| `respond-with-info` | Q8–10 | 45s đọc bảng/info + 3s | 15s hoặc 30s | 3 | Khối thông tin + câu hỏi |
| `express-opinion` | Q11 | 45s | **60s** (thay 120s Part 2) | 5 | Câu hỏi opinion |

`create` nhận `{ taskType }` (+ optional `speakSeconds` chỉ khi type có hai mốc 15/30 — mặc định 15 cho respond-question, 30 cho respond-with-info Q10-style).

`useRecorder` `MAX_RECORDING_MS` theo `speakSeconds` của attempt, không hard-code 120s.

## 6. Chấm điểm

### 6.1 Schema lưu

Trên `PracticeAttempt` và `SpeakingAttempt`:

```
scale             String   @default("toeic")  // "ielts" = bài cũ
taskType          String                      // writing: 3 loại; speaking: 5 loại
rawRating         Int?                        // 0…maxRaw của dạng
estimatedScaled   Int?                        // 0–200, bước 10
cefrEstimate      String?                     // A1|A2|B1|B2|C1|null (dưới A1)
scores            Json?                       // nhận xét theo tiêu chí ETS, không phải 4 số IELTS
band              Float?                      // chỉ bài ielts cũ; attempt toeic để null
```

Speaking: `cueCard` Json generic `{ taskType, ...payload }` — không còn bắt `{ topic, bullets[3] }`.

Writing: `level` cột cũ — attempt toeic ghi `"TOEIC"` hoặc bỏ dùng ở UI. Migration: `level` vẫn String; writing mới ghi `taskType` vào cột `taskType` sẵn có.

### 6.2 AI chấm — holistic, không `overallBand()`

Prompt **không** còn “IELTS examiner” / 4 tiêu chí band 0–9.

Mỗi dạng: model trả `rawRating` nguyên trong thang ETS + `feedback` theo đúng tiêu chí handbook:

- Read-aloud: pronunciation, intonationStress (comment); `rawRating` 0–3 overall intelligibility.
- Describe-picture / questions / info: taskAppropriateness, delivery, languageUse; `rawRating` 0–3 (Q11: 0–5).
- Picture-sentence: grammar, relevance; `rawRating` 0–3.
- Email: sentenceVariety, vocabulary, organization; `rawRating` 0–4.
- Opinion essay: opinionSupport, grammar, vocabulary, organization; `rawRating` 0–5. Bài &lt;300 từ: hạ `opinionSupport` / `rawRating` (nêu trong prompt, giống ETS phạt essay thiếu).

Server: `estimatedScaled = practiceScaled(rawRating, maxRaw)`. **Không** trung bình 4 số.

`practiceScaled(raw, max)`: `raw <= 0` → 0; không thì `Math.round((raw / max) * 20) * 10`, clamp 0–200.

### 6.3 Descriptor

Bảng dải ETS (Speaking 8 dải, Writing 9 dải) nằm `packages/practice` — UI hiện đoạn descriptor khớp `estimatedScaled`. Không bịa descriptor.

CEFR estimate: so `estimatedScaled` với cắt ETS (lower bound). Dưới A1 → `null`.

## 7. UI

- Chọn dạng (FolioChoice), nút Start. Bỏ hàng Level A2–C1.
- Exam header: tên dạng + đồng hồ đúng timer mục 4–5. Speaking: “Q11 · Express an opinion”, không “Part 2”.
- Kết quả: con dấu **160** (số lớn) + dòng `Practice score` + `raw 4/5` + CEFR estimate nếu có. Không “Band 6.5”.
- Thanh tiêu chí: nhãn ETS của dạng đang mở, comment text, **không** vẽ 0–9.
- Progress: trục Y 0–200; chỉ attempt `scale=toeic"`. `level-up` theo CEFR từ scaled (cắt ETS), không còn ngưỡng band 6.5.
- Copy landing / Folio: TOEIC Speaking & Writing, workplace English. Xóa IELTS / Part 2 / Band.
- Bài `scale=ielts` trong list: nhãn “Legacy” + stamp Band cũ, không trộn vào chart TOEIC.

Read-aloud: hiện passage suốt prep + record (thí sinh được nhìn text). Describe-picture: ảnh lớn, không bullets IELTS.

## 8. Ảnh

`packages/practice` (hoặc `apps/web/src/assets/toeic/`) catalog ≥8 cảnh workplace/daily, mỗi item: `src`, `alt`, writing: `wordA`, `wordB`. Generate đề **pick** từ catalog (tránh trùng 10 lần gần), không gọi image model.

## 9. Learner aids

Như spec 2026-09-21 speaking-learner-aids, nhưng:

- Writing ideas/structure: khung TOEIC (email: greeting → answer each request → close; essay: position → reasons → example → close). Không “IELTS Task 2 paragraphing”.
- Speaking structure: nhịp đúng dạng (picture: overall → people → place → close; opinion: stance → reason → example → close).
- Sample sau chấm: model TOEIC (1 câu / 1 email / 1 essay ≥300 từ / transcript đúng thời lượng nói).

## 10. Prompt generate

- Không “Do not write a sample essay” kiểu IELTS task frame Cambridge.
- Invent topic workplace/daily ETS-style. Picture: pick catalog. Email: viết email gốc + bullets việc phải làm. Opinion: một issue.

## 11. File lõi (pha B)

- `packages/practice`: types, catalogs, `practiceScaled`, descriptor tables, CEFR cuts, tests `overall-band` → thay/retire.
- API: `grade-prompt`, `revision-grade-prompt`, `speaking-grade-prompt`, generate prompts, services create/submit, Prisma migration.
- Web: BandStamp → ScoreStamp (hoặc prop mode), charts, PracticePage, SpeakingPage, attempt pages, recorder max, landing-copy, FolioNav copy, tests.

## 12. Kiểm thử

- `practiceScaled` biên 0, max, giữa.
- Grade prompt mỗi writing type chứa đúng tiêu chí ETS, không chứa “IELTS”.
- Speaking timer: opinion 60s auto-stop; read-aloud 45s.
- Create writing không nhận level; 400 nếu taskType lạ.
- Chart bỏ attempt ielts.
- E2E: tạo opinion-essay, nộp, body có `rawRating`, `estimatedScaled`, `scale: "toeic"`.

## 13. Pha C (không làm trong spec này)

Một phiên tuần tự đủ câu, cộng raw, quy đổi scaled bằng bảng (khi có). Tách spec riêng sau khi B chạy ổn.
