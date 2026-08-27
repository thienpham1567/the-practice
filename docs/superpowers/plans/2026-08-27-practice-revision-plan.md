# Vòng sửa bài (Revise → Regrade) — Implementation Plan

**Ngày:** 2026-08-27
**Spec:** `docs/superpowers/specs/2026-08-27-practice-revision-design.md`

Nguyên tắc chung như các plan trước: TDD từng bước, mỗi bước xong chạy test liên quan và commit riêng; xong milestone chạy `pnpm test` + e2e + lint. Milestone 3 xong phải đi hết một vòng thật trong browser (tạo bài → chấm → sửa → chấm lại) chứ không chỉ tin test.

## Milestone 1 — Schema và endpoint revise

Backend thuần, chưa đụng chấm bài.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 1.1 | Prisma: thêm `parentAttemptId String?`, `revisionRound Int @default(0)`, `feedbackAudit Json?`, quan hệ tự tham chiếu `"Revisions"` với `onDelete: Cascade`, index `[parentAttemptId]` + migration | `migrate dev` sạch; dữ liệu cũ nguyên vẹn (`revisionRound` = 0 toàn bộ) |
| 1.2 | `PracticeService.revise(userId, id)`: transaction kiểm điều kiện — thuộc user, đã có điểm, `revisionRound < 2`, chưa có bản sửa trỏ về — rồi tạo attempt mới copy `level/taskType/prompt/ideas/vocabulary/hintsOpened`, nạp `content/plainText/wordCount` từ bản đã nộp, `revisionRound = cha + 1` | Unit test đủ nhánh: 404 không tồn tại/khác chủ; 409 chưa chấm; 409 đã có bản sửa; 409 round = 2; happy path copy đúng từng trường và **không có AI call** |
| 1.3 | `POST /practice/attempts/:id/revise` trong controller — có `JwtAuthGuard` + `Throttle`, **không** `DailyAiQuotaGuard` (tạo bản sửa miễn phí) | Unit test controller wiring; e2e: revise trả 201 với attempt mới, gọi lần hai trả 409 |
| 1.4 | `findOne` trả thêm `parentAttemptId/revisionRound/feedbackAudit/parentBand` (band cha lấy trong cùng query bằng `include` chọn lọc) | Unit test: bản sửa có `parentBand`; bài gốc có `parentBand: null` |

## Milestone 2 — Chấm đối chiếu ⭐

Phần lõi giá trị. Audit là phần phụ của lần chấm — mọi bước phải giữ bất biến: **audit hỏng không được làm hỏng điểm**.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 2.1 | `revision-grade-prompt.ts`: `buildRevisionGradePrompt(task, level, essay, parentFeedback, parentBand)` + `REVISION_GRADE_SCHEMA` = schema chấm cũ cộng mảng `feedbackAudit[{point, status}]`. Không gửi bài văn cũ | Unit test: prompt chứa từng góp ý cũ nguyên văn, chứa band cũ, **không** chứa bài cũ; schema hợp lệ |
| 2.2 | `submit()` rẽ nhánh theo `parentAttemptId`: bản sửa dùng prompt/schema đối chiếu; parse audit và lưu vào `feedbackAudit` trong cùng câu `update()` nguyên tử hiện có | Unit test: submit bản sửa gọi đúng prompt đối chiếu; submit bài gốc không đổi hành vi; audit lưu đúng |
| 2.3 | Khoan dung audit: AI trả audit thiếu/hỏng cấu trúc → validate, gán `feedbackAudit = null`, log warning, vẫn lưu điểm + feedback đầy đủ | Unit test: response thiếu mảng audit và response audit sai kiểu — cả hai vẫn ra điểm, `feedbackAudit` null, có warning |
| 2.4 | Grading lock + quota hoạt động nguyên trạng cho bản sửa (không sửa code, chỉ chốt bằng test) | Unit test: hai submit đồng thời trên bản sửa → một AI call; e2e: submit bản sửa tính vào quota ngày |

## Milestone 3 — Web: vòng sửa

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 3.1 | `apps/web/src/practice/revise-availability.ts` (module thuần): `canRevise(attempt)` — có điểm, `revisionRound < 2`, chưa có bản sửa; kèm format delta `formatBandDelta(5.5, 6.5)` | Unit test từng nhánh, theo nếp `exam-math.ts` |
| 3.2 | `api/practice.ts`: type mới (`parentAttemptId/revisionRound/feedbackAudit/parentBand`) + `reviseAttempt(id)` | Type-check qua; không cần test riêng cho fetch wrapper (nếp hiện tại) |
| 3.3 | Trang kết quả: nút "Sửa lại bài này" khi `canRevise` → gọi revise → navigate `/practice/:newId` | Component test: nút hiện/ẩn đúng; bấm điều hướng đúng |
| 3.4 | Trang viết bản sửa: ẩn đồng hồ đếm ngược, nhãn "Bản sửa 1/2"; sidebar ghim danh sách feedback của cha | Component test: bản sửa không render countdown, có nhãn và feedback cha |
| 3.5 | Kết quả bản sửa: delta `5.5 → 6.5` cạnh `BandStamp`; danh sách audit ✓/±/✗ (✗ màu vermilion); `feedbackAudit` null → chỉ hiện delta, không hiện audit | Component test ba trạng thái status + trạng thái null |
| 3.6 | Đi hết vòng thật trong browser với API + OpenRouter thật: tạo → viết → chấm → sửa → chấm lại → thấy delta và audit | **Đã chạy 2026-08-27:** API smoke với OpenRouter — create ~3.7s, grade gốc ~3.9s (band 3.5), revise tức thì, grade bản sửa ~5.6s (band 2 + audit 6 điểm). Second revise → 409. Browser: login → list (roots-only sau 4.1) → trang kết quả bản sửa hiện delta `3.5 → 2.0` + audit. |

## Milestone 4 — Danh sách và biểu đồ

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 4.1 | `list()` lọc `parentAttemptId: null`, mỗi dòng kèm tóm tắt chuỗi (số vòng, band mới nhất) qua `include` chọn lọc trên `revisions` | Unit test: bản sửa không xuất hiện thành dòng riêng; tóm tắt đúng band mới nhất; pagination không vỡ |
| 4.2 | `PracticePage`: dòng có chuỗi hiện `5.5 → 6.5 · 2 lần sửa` | Component test |
| 4.3 | Chốt ngữ nghĩa biểu đồ: `BandChart`/`StreakStrip` nhận list gốc — kiểm rằng band vẽ là band lần viết đầu (hành vi tự nhiên sau 4.1, chốt bằng test cho khỏi trượt về sau) | Unit test band-chart với dữ liệu có chuỗi sửa |
| 4.4 | Full suite + e2e + lint; cập nhật spec nếu có sai lệch phát hiện khi làm | Tất cả xanh |

## Rủi ro đã biết

- **Schema chấm đối chiếu là structured output mới** — model từng phá schema (vụ gemini-3.7-flash). Bước 2.3 (khoan dung audit) chính là lưới đỡ; 3.6 kiểm bằng model thật đang dùng (`google/gemini-2.5-flash`).
- **`findOne`/`list` thêm `include`** động vào query đang chạy — làm ở bước riêng, có test snapshot response shape trước/sau.
- **UI PracticeAttemptPage đã 10.4K** — bước 3.4/3.5 dễ phình file. Nếu vượt ~13K, tách phần kết quả thành component riêng ngay trong bước đó, không để dồn.
