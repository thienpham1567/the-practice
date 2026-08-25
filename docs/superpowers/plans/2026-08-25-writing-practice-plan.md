# Writing Practice — Implementation Plan

**Spec:** [../specs/2026-08-25-writing-practice-design.md](../specs/2026-08-25-writing-practice-design.md)
**Nguyên tắc:** mỗi bước nhỏ, kiểm chứng được, commit riêng. `packages/practice` làm theo TDD. Mọi thứ chạm tới UI phải verify thật trên trình duyệt, không chỉ qua test.

## Milestone 1 — `packages/practice`

Toàn bộ TDD: test trước, code sau. Không phụ thuộc gì ngoài TypeScript.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 1.1 | Scaffold package: `package.json`, `tsconfig`, `vitest.config`, `src/index.ts` | `pnpm --filter @writing-helper/practice test` chạy được |
| 1.2 | `types.ts`: `Level`, `TaskType`, `TaskSpec`, `CriterionScores`, `Feedback` | Typecheck sạch |
| 1.3 | `task-catalog.ts`: 8 dạng bài theo bảng trong spec + `tasksForLevel()` | Mỗi mức có ≥ 2 dạng; A2 không dính dạng 250+ từ; mọi `TaskSpec` có `instruction` khác rỗng |
| 1.4 | `pickTask(level, recentTypes)`: xoay vòng, tránh dạng vừa làm | Không trả dạng nằm trong `recentTypes` khi còn lựa chọn khác; vẫn trả về được khi mọi dạng đều vừa làm |
| 1.5 | `overallBand(scores)`: trung bình 4 tiêu chí, làm tròn bội số 0.5 | 6+6+6+5 → 5.5; 7+7+6+6 → 6.5; kiểm tra làm tròn ở cả hai chiều |
| 1.6 | `bandToCefr(band)` theo bảng quy đổi | Biên: 3.5→A2, 4.0→B1, 5.0→B1, 5.5→B2, 6.5→B2, 7.0→C1 |
| 1.7 | `computeStreak(dates)`: chuỗi ngày liên tiếp hiện tại + dài nhất | Nộp hôm nay + hôm qua → current 2; đứt hôm qua → current 0; nhiều bài cùng ngày chỉ tính 1; mảng rỗng → 0/0 |

## Milestone 2 — Backend: tách seam AiService

Refactor trước, tính năng sau. Test cũ của rewrite phải xanh nguyên trong suốt milestone này.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 2.1 | Tách `AiService.complete<T>({ prompt, schema?, maxTokens })` làm cổng OpenRouter duy nhất: giữ nguyên timeout 15s, `AbortController`, ánh xạ lỗi | Unit test mới cho `complete()`; **19 test cũ của ai module vẫn xanh** |
| 2.2 | Viết lại `rewrite()` dựa trên `complete()` | Không sửa test rewrite nào mà vẫn xanh; e2e `/ai/rewrite` vẫn pass |
| 2.3 | Hỗ trợ `response_format: json_schema` trong `complete()` khi có `schema` | Test với mock: body request chứa đúng schema; parse JSON trả về đúng kiểu |
| 2.4 | `practice/generate-prompt.ts`: dựng prompt sinh đề + JSON schema | Prompt chứa `instruction` của TaskSpec và ngưỡng số từ; schema đòi đủ `prompt`/`ideas`/`vocabulary` |
| 2.5 | `practice/grade-prompt.ts`: dựng prompt chấm + JSON schema | Prompt chứa đề bài, số từ thực tế, ngưỡng tối thiểu, và yêu cầu trừ điểm khi thiếu độ dài |

## Milestone 3 — Backend: PracticeModule

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 3.1 | Prisma: model `PracticeAttempt` + quan hệ với `User` + migration | `prisma migrate dev` tạo bảng; `migrate status` sạch |
| 3.2 | `PracticeService.create()`: chọn task (dùng `pickTask` + lịch sử gần đây), gọi AI sinh đề, lưu attempt | Unit test với AI mock: task không lặp dạng vừa làm; đề bài lưu đủ ideas + vocabulary |
| 3.3 | `list()` / `findOne()` / `update()` — mọi query filter theo `userId`, list bỏ `content` | E2E: user B nhận 404 với mọi route trên bài của user A |
| 3.4 | `submit()`: gọi AI chấm, **server tự tính band** bằng `overallBand()`, lưu scores + feedback + styleSnapshot | Unit test: band tính từ 4 tiêu chí chứ không lấy từ AI; nộp lại bài đã nộp → 409 |
| 3.5 | Controller + `JwtAuthGuard` + `UserThrottlerGuard` cho 2 route tốn tiền | E2E: chưa đăng nhập → 401; validate DTO sai → 400 |
| 3.6 | E2E đầy đủ luồng: tạo → autosave → nộp → xem lại | Toàn bộ e2e cũ (23 test) vẫn xanh |

## Milestone 4 — Web: bảng điều khiển `/practice`

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 4.1 | `api/practice.ts`: client cho 5 endpoint | Typecheck; gọi thật được qua proxy |
| 4.2 | Route `/practice`, chọn mức + nút bắt đầu → tạo attempt → điều hướng sang `/practice/:id` | Chạy tay: chọn A2 tạo được bài, chuyển màn đúng |
| 4.3 | Dải streak 14 ngày kiểu vạch đếm bản thảo | Test `computeStreak` đã có ở M1; kiểm tra bằng mắt trên browser |
| 4.4 | Biểu đồ band theo thời gian — SVG inline vẽ tay, nét mảnh (**đọc skill `dataviz` trước khi viết**) | Hiển thị đúng với 1 điểm, nhiều điểm, và khi chưa có bài nào |
| 4.5 | Danh sách bài đã làm: ngày, dạng bài, band | Bấm vào mở lại được bài cũ |

## Milestone 5 — Web: phòng thi `/practice/:id`

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 5.1 | Layout + thẻ đề bài (dạng bài, yêu cầu, mục tiêu từ, thời gian) | Hiển thị đúng dữ liệu từ server |
| 5.2 | Panel gợi ý thu gọn mặc định; mở ra thì PATCH `hintsOpened = true` | Mở gợi ý → reload → vẫn ghi nhận đã mở |
| 5.3 | Đồng hồ đếm ngược tính từ `startedAt` của server | F5 giữa chừng không reset đồng hồ; hết giờ chỉ cảnh báo, không tự nộp |
| 5.4 | Bộ đếm từ so với ngưỡng, đổi màu khi dưới tối thiểu | Gõ dưới/đủ ngưỡng đổi màu đúng |
| 5.5 | Editor ở **Write mode**, tắt sạch highlight, autosave 2s | Không có highlight nào trong lúc làm bài; nội dung lưu vào DB |
| 5.6 | Nút Nộp bài: chạy `analyze()` lấy `styleSnapshot`, gọi submit, chuyển sang kết quả | Chạy tay end-to-end với AI thật |

## Milestone 6 — Web: màn kết quả

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 6.1 | `BandStamp` — dùng lại thẩm mỹ `GradeStamp`, thêm nhãn CEFR quy đổi | Band 6.5 hiện đúng "B2" |
| 6.2 | 4 thanh tiêu chí IELTS + nhận xét từng tiêu chí | Hiển thị đủ 4, không vỡ layout với nhận xét dài |
| 6.3 | Ô "việc cần làm tốt hơn lần sau" | Nổi bật hơn phần nhận xét chung |
| 6.4 | Hồ sơ văn phong **trung tính**: passive/trạng từ giữ cảnh báo, độ phức tạp câu ghi trung tính kèm mức CEFR tương ứng | Không có chữ đỏ nào cho độ dài câu |
| 6.5 | Bài viết hiện lại kèm highlight (bật lại Edit mode) | Highlight khớp đúng với `styleSnapshot` đã lưu |

## Rủi ro đã biết

- **Structured output**: chưa dùng `json_schema` với OpenRouter trong dự án này. Nếu model được chọn không hỗ trợ, phải fallback sang parse JSON thủ công có dọn dẹp. Kiểm tra sớm ở bước 2.3 bằng một lần gọi thật.
- **Chi phí AI**: mỗi bài tốn 2 lần gọi (sinh đề + chấm), lần chấm tốn token hơn hẳn rewrite vì phải đọc cả bài. Đo chi phí thật ở bước 3.4 trước khi làm tiếp UI.
- **Gemini 2.5 Flash chấm bài**: model rẻ có thể chấm không ổn định giữa các lần. Nếu lệch nhiều, cân nhắc dùng model mạnh hơn **chỉ cho việc chấm**, giữ Flash cho sinh đề — `AI_MODEL` hiện là một biến duy nhất, có thể cần tách thành hai.

## Ghi chú chung

- Mỗi bước xong: chạy test liên quan, commit riêng với message mô tả.
- Sau mỗi milestone: chạy toàn bộ `pnpm test` + e2e, lint sạch, và verify trên trình duyệt nếu có phần UI.
- `.env.example` cập nhật ngay khi thêm biến mới.
