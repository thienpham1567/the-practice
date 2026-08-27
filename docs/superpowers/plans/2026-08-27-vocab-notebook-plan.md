# Sổ tay từ vựng (Vocab Notebook) — Implementation Plan

**Ngày:** 2026-08-27
**Spec:** `docs/superpowers/specs/2026-08-27-vocab-notebook-design.md`

Nguyên tắc như các plan trước: TDD từng bước, mỗi bước xong chạy test liên quan và commit riêng; xong milestone chạy `pnpm test` + e2e + lint. Bất biến xuyên suốt: **sổ tay là phần phụ — upsert hay quét lỗi không bao giờ làm hỏng việc tạo đề hay lần chấm.**

## Milestone 1 — Nền: match thuần và bảng VocabEntry

Chưa đụng luồng nào đang chạy.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 1.1 | `apps/api/src/practice/vocab-match.ts` (module thuần, TDD trước): `matchVocab(plainText, words) → Set<word>` — ranh giới từ, không phân hoa thường, biến tố `-s/-es/-ed/-ing/-d` kể cả dạng bỏ `e` (`commute → commuting`), cụm nhiều từ | Unit test: `use` không match `useful`; hoa thường; từng biến tố; cụm từ; không match trong từ ghép |
| 1.2 | Prisma: model `VocabEntry` + unique `[userId, word]` + index `[userId, usedCount, lastSuggestedAt]` + migration | `migrate dev` sạch |
| 1.3 | `VocabService.recordSuggested(userId, level, items)`: chuẩn hoá word (lowercase/trim), upsert — mới tạo, cũ `suggestedCount++` và cập nhật `lastSuggestedAt`, giữ meaning/example đầu | Unit test: entry mới; gợi ý lặp tăng đếm không đổi meaning; hai casing là một entry |
| 1.4 | `VocabService.reviewCandidates(userId, level)`: `usedCount = 0`, cùng level, loại từ trong vocabulary của attempt mới nhất theo `startedAt`, sắp `lastSuggestedAt` cũ nhất, trần 4 | Unit test từng điều kiện lọc + thứ tự + trần |
| 1.5 | `VocabService.markUsed(userId, plainText)`: quét toàn sổ bằng `matchVocab`, match → `usedCount++`, `firstUsedAt` nếu null | Unit test: nhiều entry một lần quét; từ đã dùng vẫn tăng đếm; `firstUsedAt` không bị ghi đè |

## Milestone 2 — Nối vào luồng sinh đề và nộp bài ⭐

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 2.1 | `buildGeneratePrompt` nhận thêm `reviewWords` — chỉ dẫn: chủ đề quyết trước, đưa vào vocabulary những từ review hợp chủ đề (0–4), còn lại sinh mới; rỗng thì prompt y như cũ | Unit test: prompt chứa review list; rỗng → prompt byte-một như hiện tại (**test generate cũ vẫn xanh không sửa**) |
| 2.2 | `create()`: lấy `reviewCandidates` → truyền vào prompt → đối chiếu vocabulary AI trả về, gắn `review: true` vào item trùng ứng viên (so trên dạng chuẩn hoá) → `recordSuggested` toàn bộ | Unit test: cờ gắn đúng; item không trùng không có cờ; upsert được gọi với đủ item |
| 2.3 | Khoan dung: `reviewCandidates`/`recordSuggested` ném lỗi → log warning, tạo đề vẫn thành công như không có sổ | Unit test hai nhánh lỗi |
| 2.4 | `submit()`: sau khi chấm thành công gọi `markUsed`; lỗi → log warning, kết quả chấm nguyên vẹn | Unit test: bài chứa từ có biến tố → đánh dấu; markUsed ném lỗi → điểm vẫn lưu |
| 2.5 | E2E vòng đầy đủ (AI mock theo nếp e2e hiện tại): sinh đề → sổ có từ; nộp bài chứa từ → đã-dùng; sinh đề tiếp → item mang cờ review | E2E xanh; kiểm cả nộp bản sửa (không sinh từ mới, vẫn quét sổ) |

## Milestone 3 — API sổ tay và web

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 3.1 | `GET /practice/vocab` (JwtAuthGuard, cursor pagination theo nếp chung): chưa-dùng trước, trong nhóm `lastSuggestedAt` giảm dần | E2E: thứ tự đúng; không thấy sổ người khác; trang 1/2 không trùng |
| 3.2 | `api/vocab.ts` (web) + trang `/vocab` (RequireAuth): bảng từ/nghĩa/ví dụ, badge `chưa dùng`/`đã dùng ×n`, filter trạng thái; link từ trang Practice | Component test ba trạng thái (rỗng/có từ/lỗi) |
| 3.3 | `PracticeAttemptPage`: chip "ôn lại" viền vermilion cho item `review: true` | Component test: chip hiện đúng item, item thường không có |
| 3.4 | Đi hết vòng thật trong browser với OpenRouter thật: hai đề liên tiếp — đề sau phải có từ ôn lại; nộp bài dùng 2 từ → sổ cập nhật | Screenshot trang `/vocab` trước/sau |
| 3.5 | Full suite + e2e + lint; cập nhật spec nếu phát hiện sai lệch | Tất cả xanh |

## Rủi ro đã biết

- **Model có thể phớt lờ review list** (không nhét từ nào dù hợp chủ đề) — chấp nhận: cơ chế là "gợi", không "ép". Bước 3.4 quan sát bằng model thật; nếu tỉ lệ nhét quá thấp mới cân nhắc siết chỉ dẫn prompt.
- **Đổi `buildGeneratePrompt`** động vào prompt đang chạy tốt — 2.1 giữ bất biến "rỗng → byte-một như cũ" bằng test để chắc chắn hành vi hiện tại không đổi.
- **`matchVocab` heuristic** — biến tố bất quy tắc (`go → went`) không bắt được, đã ghi trong spec là chấp nhận. Không bao giờ *giảm* `usedCount`; false negative vô hại, false positive (match trong từ ghép) bị chặn bằng ranh giới từ.
- **Unique `[userId, word]` với dữ liệu chuẩn hoá** — mọi đường ghi phải đi qua một hàm chuẩn hoá duy nhất, đặt trong `vocab-match.ts` để service và test dùng chung.
