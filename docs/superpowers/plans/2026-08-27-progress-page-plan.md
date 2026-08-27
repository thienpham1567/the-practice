# Trang tiến bộ (/progress) — Implementation Plan

**Ngày:** 2026-08-27
**Spec:** `docs/superpowers/specs/2026-08-27-progress-page-design.md`

Nguyên tắc như các plan trước: TDD từng bước, commit riêng từng bước; xong milestone chạy `pnpm test` + e2e + lint. Tính năng chỉ-đọc, không AI call, không migration — plan ngắn nhất trong ba tính năng.

## Milestone 1 — Endpoint tổng hợp

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 1.1 | `ProgressService.summary(userId)`: query bài gốc + đã chấm + 90 ngày (dùng index `[userId, submittedAt]`), map thành `series` với `per100` quy đổi từ styleSnapshot; snapshot thiếu/hỏng → `per100: null`; tính `streak` từ `submittedDates` (tái dùng logic streak hiện có nếu tách được) | Unit test: lọc từng điều kiện; quy đổi đúng (2 passive / 250 từ → 0.8); snapshot hỏng không ném; user trống → mảng rỗng |
| 1.2 | `GET /practice/progress` (JwtAuthGuard, không throttle AI/quota — chỉ đọc) | E2E: shape đúng; chỉ thấy của mình; không đăng nhập → 401 |

## Milestone 2 — Luật level-up và các module thuần

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 2.1 | `apps/web/src/practice/level-up.ts` (TDD trước): `levelUpVerdict(series) → { suggest: Level; reason: string } \| null`; hằng số `WINDOW_SIZE = 5`, `BAND_THRESHOLD = 6.5`, `CRITERION_FLOOR = 6.0` đầu file | Unit test đủ nhánh: thiếu bài; đạt band dính tiêu chí thấp; C1; đổi level giữa chừng; đúng biên `≥` |
| 2.2 | `progress-series.ts` (thuần): nhóm series theo level cho chart nhiều đường; trung bình tiêu chí 30 ngày + "yếu nhất"; chuỗi per-100-từ bỏ qua điểm null | Unit test theo nếp `band-chart.test.ts` |
| 2.3 | `api/progress.ts` (web): type + `getProgress()` | Type-check qua |

## Milestone 3 — Trang /progress

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 3.1 | Khối 1: band theo thời gian tách level (tái dùng `chartDots`, mỗi level một màu mực + chú giải) | Component test: hai level → hai đường; một bài → một chấm |
| 3.2 | Khối 2: sparkline 4 tiêu chí + nhãn "yếu nhất 30 ngày" | Component test |
| 3.3 | Khối 3: xu hướng style per-100-từ, điểm null bị bỏ qua không đứt gãy trục thời gian | Component test có điểm null xen giữa |
| 3.4 | Khối 4: hộp level-up kiểu con dấu — chỉ render khi verdict khác null, kèm dòng reason; route `/progress` (RequireAuth) + link "Xem tiến bộ →" từ PracticePage | Component test hai trạng thái; test route |
| 3.5 | Trạng thái rỗng toàn trang (chưa có bài chấm nào): một dòng mời viết bài đầu, không render 4 khối trống | Component test |
| 3.6 | Xem thật trong browser với dữ liệu thật nhiều ngày; kiểm dark-mode/responsive theo nếp verify hiện có | **API smoke 2026-08-27:** `GET /practice/progress` với JWT trả `series` (8 điểm A2+B1, band/scores/per100) + `streak`; seed tại `/tmp/progress-smoke.json`. Browser screenshot còn lại. |
| 3.7 | Full suite + e2e + lint; cập nhật spec nếu lệch | Tất cả xanh |

## Rủi ro đã biết

- **`styleSnapshot` là Json tự do** — dữ liệu cũ có thể thiếu trường (`counts`/`stats`). Mọi đường đọc qua một hàm parse khoan dung duy nhất trong `ProgressService`; trả `per100: null` chứ không đoán.
- **Streak tính hai nơi** (PracticePage hiện có và endpoint mới) — bước 1.1 tách logic dùng chung nếu trùng, không copy công thức.
- **Phụ thuộc ngữ nghĩa "bài gốc"** — trước khi có vòng sửa bài (spec 2026-08-27) mọi bài đều `parentAttemptId = null` nên filter vô hại; sau khi có, filter là bắt buộc. Không có ràng buộc thứ tự triển khai giữa hai tính năng.
