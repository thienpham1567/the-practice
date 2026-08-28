# Luyện Speaking (IELTS Part 2) — Implementation Plan

**Ngày:** 2026-08-28
**Spec:** `docs/superpowers/specs/2026-08-28-speaking-practice-design.md`

Nguyên tắc như các plan trước: TDD từng bước, commit riêng từng bước; xong milestone chạy `pnpm test` + e2e + lint.

**Bất biến xuyên suốt:** marks và chỉ số trôi chảy là phần phụ — hỏng thì vẫn phải lưu được điểm và transcript. Và **không bao giờ làm mất bản ghi âm** của người dùng vì một lỗi phía sau.

---

## Milestone 1 — Spike và nền thuần

Bước 1.1 phải làm **trước mọi thứ khác**: nó là rủi ro lớn nhất của cả tính năng, và nếu sai thì toàn bộ thiết kế phải đổi.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 1.1 | **Spike định dạng audio.** Script tạm: sinh một WAV 16 kHz mono ~15 giây (đọc sẵn hoặc tone + giọng thật), base64, gọi thẳng OpenRouter `gemini-2.5-flash` với `input_audio`, in nguyên response | Nhận được transcript đúng. **Ghi vào plan:** định dạng được chấp nhận, số audio token thật, thời gian phản hồi, chi phí thật. Nếu `wav` bị từ chối → thử `mp3` và cập nhật spec trước khi đi tiếp |
| 1.2 | `apps/web/src/speaking/wav-encode.ts` (thuần, TDD): Float32 PCM → WAV 16 kHz mono 16-bit; downsample; ghép header 44 byte | Unit test: header đúng chuẩn (RIFF/fmt/data, sampleRate, bitsPerSample), độ dài khớp, buffer rỗng không nổ, stereo → mono |
| 1.3 | `apps/web/src/speaking/speaking-fluency.ts` (thuần, TDD): `{ wordsPerMinute, fillerCount }` từ transcript + `durationMs` | Unit test: WPM đúng; đếm filler (`um, uh, er, like, you know`) không bắt nhầm trong từ khác; `durationMs = 0` → WPM 0 chứ không NaN; transcript rỗng |
| 1.4 | `apps/api/src/speaking/locate-marks.ts` (thuần, TDD): `[{quote, kind, note}]` + transcript → `[{start, end, kind, note}]` | Unit test: định vị đúng; **quote không tìm thấy → loại bỏ, không ném**; quote trùng → lấy lần đầu; quote rỗng → loại |
| 1.5 | `SPEAKING_CATALOG` trong `packages/practice`: cue card theo level (topic + 3 bullets), kèm `pickSpeakingTask()` | Unit test theo nếp `task-catalog.test.ts`: mỗi level có ≥3 đề, cấu trúc đúng khuôn Part 2 |

### Ghi chú 1.1

*(điền sau khi chạy spike: định dạng, token, thời gian, chi phí)*

## Milestone 2 — Backend

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 2.1 | Prisma `SpeakingAttempt` + quan hệ tự tham chiếu `SpeakingRevisions` + 2 index + migration | `migrate dev` sạch; dữ liệu cũ không đụng |
| 2.2 | `CompleteOptions` thêm `audio?: { base64, format }`; dựng `input_audio` content part khi có | Unit test: có audio → body đúng shape; **không có audio → body byte-một như hiện tại** (test AI cũ vẫn xanh không sửa) |
| 2.3 | Nâng body limit riêng cho route submit (~8 MB), các route khác giữ nguyên | E2E: payload 6 MB qua được; route khác vẫn từ chối payload lớn |
| 2.4 | `speaking-generate-prompt.ts` + `create()`: sinh cue card theo level, 1 AI call text, gắn `usage: { endpoint: "speaking.generate" }` | Unit test prompt; e2e tạo attempt có cueCard đúng cấu trúc |
| 2.5 | `speaking-grade-prompt.ts` + schema: một call trả `transcript`, `marks[{quote,kind,note}]`, `scores` 4 tiêu chí, `feedback` | Unit test: schema hợp lệ; prompt yêu cầu **trích nguyên văn**, không yêu cầu chỉ số |
| 2.6 | `submit()`: chiếm grading lock **trước** khi gọi AI → gọi AI kèm audio → `locateMarks` → `speakingFluency` → band bằng `overallBand()` → một `update()` nguyên tử | Unit test: hai submit đồng thời chỉ một AI call; band tính server-side; **marks hỏng vẫn lưu điểm + transcript** |
| 2.7 | Chặn phía server: `durationMs < 10_000` hoặc thiếu audio → 400 **trước khi** gọi AI | Unit test + e2e: không có AI call nào được thực hiện |
| 2.8 | `list()` (chỉ bài gốc, cursor, tóm tắt chuỗi sửa) và `findOne()` (kèm `parentBand`) | Unit test + e2e: bản ghi âm lại không thành dòng riêng; chỉ thấy của mình |
| 2.9 | `revise()`: điều kiện như bài viết (đã chấm, `revisionRound < 2`, chưa có bản sửa) → tạo attempt mới copy `cueCard`, **không gọi AI, không quota** | Unit test đủ nhánh 404/409; e2e revise → 201, gọi lần hai → 409 |

## Milestone 3 — Web: ghi âm và 4 pha ⭐

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 3.1 | `useRecorder.ts`: `getUserMedia` → Web Audio → gom Float32 PCM; feature-detect trước; trạng thái `idle/recording/done`; tự dừng ở 2:00 | Component test với `getUserMedia` mock: dừng đúng mốc; mic bị từ chối → trạng thái lỗi rõ, không crash |
| 3.2 | Kiểm im lặng bằng RMS trên PCM ngay trong trình duyệt; dưới ngưỡng hoặc dưới 10s → chặn nộp kèm thông báo | Unit test thuần cho hàm RMS: im lặng, có tiếng, biên |
| 3.3 | Trang `/speaking`: chọn level, "Start speaking", streak, band chart, danh sách bài cũ (dùng lại `StreakStrip`, `BandChart`, `BandStamp`) | Component test ba trạng thái: rỗng / có bài / lỗi |
| 3.4 | `/speaking/:id` — pha **Prep** (cue card, đếm ngược 1 phút, bỏ qua được) và **Record** (đồng hồ, mức âm thanh, tự dừng) | Component test từng pha |
| 3.5 | Pha **Review**: nghe lại bằng blob URL, **thu lại không giới hạn**, nút Submit | Component test: thu lại lần hai thay bản ghi cũ; chưa gọi API nào |
| 3.6 | Pha **Result**: band stamp, 4 tiêu chí, transcript **tô màu bằng CSS Custom Highlight API** (4 kind → 4 màu mark có sẵn), chỉ số trôi chảy | Component test: mark render đúng vị trí; `marks` rỗng/null → transcript vẫn hiện bình thường |
| 3.7 | **Chấm hỏng không mất bản ghi:** giữ audio trong bộ nhớ, cho nộp lại ngay mà không phải nói lại | Component test: submit lỗi → vẫn ở pha Review, vẫn nghe lại được, nút Submit dùng lại được |
| 3.8 | Nút "Record again" ở Result (≤2 vòng) + delta band; thêm `/speaking` vào nav | Component test hai trạng thái |

## Milestone 4 — Tích hợp và chạy thật

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 4.1 | `/progress`: thêm **mục riêng** cho speaking (band theo thời gian, WPM theo thời gian). **Không gộp** vào biểu đồ band bài viết | Component test; quyết định ghi rõ trong code comment: nói và viết là hai kỹ năng, gộp một đường sẽ đánh lừa |
| 4.2 | Chạy thật đầu-cuối bằng **micro thật + OpenRouter thật**: tạo đề → nói 2 phút → nộp → transcript + marks + band → ghi âm lại → delta | Screenshot; ghi lại chi phí thật và thời gian chấm vào plan |
| 4.3 | Kiểm mobile 375px cả 4 pha (dùng `SidePanel` nếu cần cột phụ) | Không trang nào cuộn ngang; nút ghi âm đủ lớn để bấm bằng ngón tay |
| 4.4 | Full suite + e2e + lint; cập nhật spec nếu phát hiện lệch | Tất cả xanh |

---

## Rủi ro đã biết

- **Định dạng audio là rủi ro số một.** Nếu OpenRouter từ chối WAV thô thì phải đổi sang MP3 (cần thư viện encode trong trình duyệt) — đó là lý do 1.1 đứng trước mọi bước khác, trước cả migration.
- **Payload ~5 MB.** Body limit là một; timeout upload trên mạng chậm là hai. Nếu 4.2 cho thấy quá chậm, cân nhắc hạ xuống 12 kHz — nhưng chỉ sau khi có số liệu thật, không đoán trước.
- **Model có thể trả `quote` không khớp nguyên văn transcript** (tự sửa chính tả khi trích). 1.4 phải khoan dung; nếu tỉ lệ mất mark cao ở 4.2 thì cân nhắc so khớp bỏ qua hoa thường và dấu câu.
- **`gemini-2.5-flash` chấm phát âm có đáng tin không** thì chưa ai kiểm. 4.2 nên thử cố tình phát âm sai vài từ xem AI có bắt được không — nếu không, tiêu chí Pronunciation chỉ là trang trí và phải nói thật điều đó trong UI.
- **Quyền micro trên Safari/iOS** khắt khe hơn Chrome desktop; 4.3 kiểm trên thiết bị thật nếu có.

## Ghi chú chung

- Mỗi bước xong: chạy test liên quan, commit riêng.
- Sau mỗi milestone: `pnpm test` + e2e đầy đủ, lint sạch.
- Milestone 3 xong **phải** chạy thật một bài bằng micro thật, không chỉ dựa vào mock.
