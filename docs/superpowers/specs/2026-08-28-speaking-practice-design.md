# Luyện Speaking (IELTS Part 2) — Design

**Ngày:** 2026-08-28
**Trạng thái:** đã duyệt qua brainstorm

## 1. Vấn đề

App hiện chỉ luyện viết. Người dùng muốn luyện nói nhưng **không có môi trường giao tiếp** — không ai để nói cùng, không ai sửa, không cách nào biết mình có tiến bộ không.

IELTS Speaking Part 2 (cue card, độc thoại 2 phút) hợp chính xác với hoàn cảnh đó: **không cần người đối thoại**, ép tự nghĩ và tự nói liên tục, và ánh xạ 1-1 vào khuôn đã có của app (một đề → một bài làm → một lần chấm → sửa lại).

### Ngoài phạm vi bản này

Part 1 và Part 3 (hỏi đáp nhiều lượt), hội thoại tự do với AI, AI trả lời bằng giọng nói (TTS), shadowing, bài mẫu band 8, lưu trữ giọng nói dài hạn, luyện nghe.

## 2. Ràng buộc kỹ thuật đã kiểm chứng

`google/gemini-2.5-flash` — **đúng model app đang dùng** — có `audio` trong `input_modalities` trên OpenRouter, giá audio $1/M token. Một bài 2 phút ≈ 3.800 audio token ≈ **$0.004/lần chấm**.

Nghĩa là: không thêm provider, không dịch vụ STT riêng, giữ nguyên nguyên tắc "OpenRouter là provider duy nhất". Và quan trọng hơn — AI **nghe** giọng thật nên chấm được phát âm và độ ngập ngừng, không chỉ đọc chữ.

## 3. Các quyết định

| Quyết định | Chọn | Lý do |
|---|---|---|
| Phần thi | **Part 2** (cue card 2 phút) | Không cần người đối thoại — đúng hoàn cảnh người dùng. Ánh xạ sạch vào model một-đề-một-bài. |
| Lưu audio | **Không lưu server**; giữ trong bộ nhớ trình duyệt, nghe lại được trong phiên | Không thêm S3/R2, không phình DB, không vấn đề riêng tư giọng nói. Vẫn giữ được "nghe lại chính mình" — cơ chế tự sửa mạnh nhất — gần như miễn phí. Đánh đổi: không so sánh giọng theo tháng bằng tai. |
| Bảng dữ liệu | **`SpeakingAttempt` riêng**, không nhồi vào `PracticeAttempt` | Chia khái niệm (level, band, 4 tiêu chí) nhưng không chia dữ liệu: không `content` Lexical, không `wordCount`; ngược lại có `durationMs`, `transcript`, `fluency`. Nhồi chung tạo bảng nửa số cột luôn NULL. |
| Định dạng audio | **WAV 16 kHz mono 16-bit**, tự ghép header trong trình duyệt | OpenRouter nhận `wav`/`mp3`; `MediaRecorder` cho ra WebM/MP4 — không dùng được. WAV chỉ là 44 byte header + PCM, không cần thư viện. 16 kHz đúng tần số Gemini xử lý nội bộ. |
| Vị trí mark | **Model trả đoạn trích nguyên văn, server tự định vị** | Model rất kém khi đếm chỉ số ký tự. Cùng cách `packages/analysis` đang làm. |
| Chỉ số trôi chảy | **Tính cục bộ**, không hỏi AI | WPM và filler suy được từ transcript + duration: tất định, miễn phí, test được. Chỉ hỏi AI thứ cần *tai*. |
| Thu lại | **Trước khi nộp: không giới hạn, miễn phí.** Sau khi chấm: tối đa 2 vòng | Khuyến khích tự nghe và tự sửa trước khi tốn tiền — đúng kỹ năng cần rèn khi không có người nghe. |

## 4. Data model

```prisma
model SpeakingAttempt {
  id       String @id @default(cuid())
  userId   String
  level    String            // A2 | B1 | B2 | C1
  /// { topic, bullets: string[] } — đúng khuôn Part 2, không có follow-up (Part 3 ngoài phạm vi).
  cueCard  Json

  durationMs Int?
  /// Transcript AI nghe được (text thuần).
  transcript String?
  /// [{ start, end, kind, note }] — offset ký tự do server định vị.
  marks      Json?
  /// { wordsPerMinute, fillerCount }
  fluency    Json?

  startedAt        DateTime  @default(now())
  /// Chiếm khoá trước khi gọi AI — chống double-submit tính tiền hai lần.
  gradingStartedAt DateTime?
  submittedAt      DateTime?

  band     Float?
  /// { fluencyCoherence, lexicalResource, grammaticalRange, pronunciation }
  scores   Json?
  feedback Json?

  parentAttemptId String?
  revisionRound   Int    @default(0)

  parent     SpeakingAttempt?  @relation("SpeakingRevisions", fields: [parentAttemptId], references: [id], onDelete: Cascade)
  revisions  SpeakingAttempt[] @relation("SpeakingRevisions")
  user       User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, submittedAt])
  @@index([parentAttemptId])
}
```

Dùng lại từ `packages/practice`: `Level`, `overallBand()`, `bandToCefr()`, `computeStreak()` — đều thuần, không dính gì tới viết. `TASK_CATALOG` thì không: thêm `SPEAKING_CATALOG` (danh mục cue card) trong cùng package.

## 5. API

| Route | Việc |
|---|---|
| `POST /speaking/attempts` | Sinh cue card theo level (1 AI call, text). Có `DailyAiQuotaGuard`. |
| `GET /speaking/attempts` | Danh sách bài gốc, cursor pagination, kèm tóm tắt chuỗi sửa |
| `GET /speaking/attempts/:id` | Chi tiết, gồm `parentBand` để vẽ delta |
| `POST /speaking/attempts/:id/submit` | Nhận WAV base64 → 1 AI call → transcript + marks + scores → lưu |
| `POST /speaking/attempts/:id/revise` | Tạo bản ghi âm lại (không gọi AI, không tốn quota) |

**Bản ghi âm lại chấm độc lập, không đối chiếu feedback cũ** — khác bài viết (vốn có `feedbackAudit`). Lý do: bài nói là lần trình bày mới hoàn toàn, không phải bản sửa trên cùng văn bản; so từng góp ý cũ với một lần nói khác sẽ khập khiễng. Chỉ hiện delta band.

`CompleteOptions` thêm một trường tuỳ chọn, không đụng caller cũ:

```ts
audio?: { base64: string; format: "wav" | "mp3" };
```

Submit dùng `PRACTICE_TIMEOUT_MS`/`PRACTICE_DEADLINE_MS`, grading lock và quota y như bài viết. Band do server tính bằng `overallBand()` — AI không tự cho band.

**Body limit:** Nest mặc định 100 KB; payload base64 ~5.1 MB. Phải nâng limit riêng cho route submit.

## 6. UI

`/speaking` — song song `/practice`: chọn level, "Start speaking", streak, band chart, danh sách bài cũ.

`/speaking/:id` qua 4 pha:

| Pha | Nội dung |
|---|---|
| **Prep** | Cue card + bullets, đếm ngược 1 phút, bỏ qua sớm được |
| **Record** | Đồng hồ, mức âm thanh trực quan, **tự dừng ở 2:00** |
| **Review** | Nghe lại, thu lại bao nhiêu lần cũng được (chưa tốn AI call) |
| **Result** | Band stamp, 4 tiêu chí, transcript tô màu, chỉ số trôi chảy |

Transcript tô màu dùng lại **CSS Custom Highlight API** và 4 trong 6 màu mark có sẵn trong `index.css`: phát âm, ngập ngừng, ngữ pháp, filler.

## 7. Xử lý lỗi

- **Không gọi AI khi không có gì để chấm:** dưới 10 giây, hoặc im lặng — đo bằng RMS biên độ trên chính PCM **trong trình duyệt** trước khi gửi (không tốn round trip, không tốn token) → cảnh báo, chặn nộp.
- **Chấm hỏng không được làm mất bản ghi:** audio còn trong bộ nhớ trình duyệt, nộp lại ngay được mà không phải nói lại — cùng tinh thần `draft-stash.ts`.
- **Mic bị từ chối / trình duyệt không hỗ trợ:** feature-detect trước pha Record, thông báo rõ, không crash.
- **Mark định vị không được:** bỏ mark đó, giữ nguyên điểm và transcript, log warning. Marks là phần phụ.

## 8. Testing

Ba module thuần — phần lớn logic nằm ở đây, test **không cần micro**:

- `wav-encode.ts` — header đúng chuẩn, downsample 16 kHz, mono hoá, biên (buffer rỗng)
- `speaking-fluency.ts` — WPM, đếm filler, biên (duration 0, transcript rỗng)
- `locate-marks.ts` — quote → offset; không tìm thấy → loại; quote trùng → lấy lần đầu

Còn lại: service (grading lock, chuỗi revision ≤ 2, band tính server-side, khoan dung marks); e2e với AI mock (gồm nhánh audio quá ngắn → 400); component test từng pha với `getUserMedia` mock; và **chạy thật bằng micro thật + OpenRouter thật** — rủi ro lớn nhất nằm ở định dạng audio và body limit, chỉ lộ ra khi chạy thật.
