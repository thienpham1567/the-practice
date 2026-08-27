# Sửa lỗi UI/UX sau audit — Plan

**Ngày:** 2026-08-27
**Nguồn:** audit trực tiếp trên app chạy local (API + web + Postgres thật, hai tài khoản: mới tạo và `progress-smoke` có 8 bài đã chấm).
**Phạm vi:** sửa những gì đã có sau khi A (vòng sửa bài), B (sổ từ vựng), C (trang tiến bộ) lên master. Không thêm tính năng mới.

Không có spec riêng — như plan backend-hardening, đây là công việc sửa chữa, lý do gắn chặt với từng việc. Sáu quyết định không hiển nhiên ghi ngay dưới.

---

## Quyết định thiết kế

### 1. Mobile: sidebar thành panel gấp được, không phải xếp chồng

Cả `/write` lẫn `/practice/:id` đều là `flex` ngang với sidebar cứng (`w-80` / `w-96` / `w-[22rem]` + `shrink-0`), không một breakpoint nào. Ở 375px, vùng soạn thảo còn ~50–100px và nội dung bài bị đẩy khuất ngoài viewport.

Xếp chồng dọc (sidebar nằm dưới editor) nghe đơn giản nhưng sai với việc viết: người dùng phải cuộn qua cả khối phân tích mới tới chỗ gõ. **Chọn: panel gấp được** — dưới `lg` sidebar ẩn mặc định, mở bằng một nút trong header, phủ lên (overlay) chứ không đẩy layout; từ `lg` trở lên giữ nguyên hai cột như hiện tại. Màn hình viết thuộc về người viết.

### 2. `NaN` — sửa ở một hàm chuẩn hoá, không rải guard

`StyleProfile` đã được "harden" ở commit `f080dac`, nhưng guard chỉ bắt trường hợp **thiếu cả object**:

```ts
const stats = snapshot.stats ?? { sentences: 0, words: 0 };
// snapshot.stats = { words: 200 }  →  stats.sentences === undefined
// undefined === 0 là false → 200 / undefined = NaN
```

Dữ liệu thật trong DB đúng là `{"stats": {"words": 200}, "counts": {...}}`. Phía API đã có `per100FromSnapshot()` khoan dung đúng kiểu này ([progress.service.ts:98](apps/api/src/practice/progress.service.ts:98)) — web cần bản tương đương. **Chọn:** module thuần `style-snapshot.ts` trả về shape đã chuẩn hoá với `average: number | null`; thiếu dữ liệu thì **không hiện dòng đó**, chứ không hiện số bịa.

### 3. Đề lặp: server sở hữu câu instruction, model chỉ nghĩ chủ đề

Hiện tại lặp vì làm cả hai đường: [generate-prompt.ts:59](apps/api/src/practice/generate-prompt.ts:59) bảo model tự chèn instruction vào `prompt`, rồi [practice.service.ts:135](apps/api/src/practice/practice.service.ts:135) nối thêm lần nữa. Model thỉnh thoảng chèn hai lần → tổng cộng ba.

**Chọn:** bỏ yêu cầu chèn khỏi prompt sinh đề, giữ việc nối ở server. Deterministic, và đúng nguyên tắc đã ghi sẵn trong comment của chính file đó ("The catalog instruction is the fixed exam frame"). **Không backfill** dữ liệu cũ — vài bài lịch sử không đáng một migration.

### 4. Ngôn ngữ: UI tiếng Anh, comment tiếng Việt

Comment tiếng Việt là quy ước của repo, giữ nguyên. Nhưng **chuỗi hiển thị** phải tiếng Anh — hiện 10 chỗ trong A/B/C lệch khỏi phần còn lại của app. Không thêm thư viện i18n (app một ngôn ngữ, YAGNI): dịch thẳng, và thêm một test quét ngăn tái diễn.

Lưu ý: các test hiện có tìm phần tử **bằng chính chuỗi tiếng Việt** (`getByRole("button", { name: "Sửa lại bài này" })`) — phải sửa cùng lúc, nếu không suite đỏ.

### 5. Catalog thiếu: chặn lúc viết, không chặn lúc xem

[PracticeAttemptPage.tsx:47](apps/web/src/pages/PracticeAttemptPage.tsx:47) chặn **toàn bộ** trang khi `taskType` không còn trong catalog — mất luôn band, feedback, bài đã viết dù dữ liệu còn nguyên trong DB.

**Chọn** tách theo nhu cầu thật: `ExamRoom` **vẫn chặn** (cần `minWords`/`maxWords`/`timeMinutes` để đếm giờ và đếm từ); `ResultView` **không bao giờ chặn** (mọi thứ nó cần đã nằm trong bản ghi attempt, catalog chỉ dùng để lấy nhãn → fallback `attempt.taskType`).

### 6. Bản sửa mồ côi: cho quay lại, không tạo endpoint mới

Bấm "revise" rồi rời trang khi chưa nộp → bản ghi tồn tại (`submittedAt: null`) nhưng không có đường nào vào lại: Papers chỉ liệt kê bài gốc, còn nút revise trên bài gốc đã ẩn vì "đã có bản sửa". Xác nhận trong DB: `cmtb9853p000fmghe2ta9okre`.

**Chọn:** dùng dữ liệu sẵn có — khi bài gốc có bản sửa **chưa nộp**, nút đổi thành "Resume revision" và điều hướng thẳng vào đó. Không endpoint mới, không xoá dữ liệu người dùng.

---

## Milestone 1 — Lỗi khách quan ⭐

Hai lỗi hiện sai ra màn hình. Nhỏ, không tranh luận thẩm mỹ, làm trước.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 1.1 | `apps/web/src/practice/style-snapshot.ts` (thuần, TDD trước): `readStyleSnapshot(raw)` → `{ passives, adverbs, average: number \| null }`; thiếu `stats.sentences` hoặc `stats.words`, `sentences === 0`, object thiếu, `null` → `average: null` | Unit test từng nhánh, đặc biệt case thật `{stats:{words:200}, counts:{...}}` |
| 1.2 | `StyleProfile` dùng module trên; `average === null` → **không render dòng sentence-length** thay vì in số | Component test: snapshot khuyết → không có chữ "NaN", không có dòng đó; snapshot đủ → hiện như cũ |
| 1.3 | Bỏ yêu cầu chèn instruction khỏi `buildGeneratePrompt`; giữ việc nối ở `practice.service.ts` | Unit test: prompt sinh đề **không** còn câu "must include … the fixed instruction"; test cũ của generate-prompt cập nhật theo |
| 1.4 | Chạy thật: tạo một bài practice mới, đọc kỹ đề | Instruction xuất hiện **đúng một lần**; screenshot kèm vào plan |

## Milestone 2 — Mobile ⭐

Phần lớn nhất. Hai màn hình cùng một bệnh, sửa theo cùng một khuôn.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 2.1 | `apps/web/src/SidePanel.tsx`: khung panel dùng chung — `lg:` hiện cố định trong luồng; dưới `lg` là overlay có backdrop, đóng bằng Esc và bằng click nền, khoá scroll nền khi mở | Component test: dưới `lg` mặc định đóng; Esc đóng; focus trả về nút mở |
| 2.2 | `/write`: sidebar phân tích vào `SidePanel`; header thêm nút mở (hiện số lượng vấn đề để còn lý do bấm) | 375px: editor chiếm trọn bề ngang, toolbar không tràn; 1280px: giống hệt hiện tại |
| 2.3 | `/practice/:id` — `ExamRoom`: cột đề bài + hints vào `SidePanel`; đồng hồ và đếm từ **luôn thấy** trong header | 375px: vùng gõ trọn bề ngang; đồng hồ không bị đẩy khuất |
| 2.4 | `/practice/:id` — `ResultView`: cột điểm + feedback vào `SidePanel`; mặc định **mở** trên mobile (vừa chấm xong thì điểm mới là thứ cần đọc) | 375px: đọc được cả điểm lẫn bài, không có cột nào tràn ngoài viewport |
| 2.5 | Header của cả hai màn: cho phép xuống dòng / rút gọn nhãn ở màn hẹp | 375px: không có chữ nào bị cắt hoặc chồng |
| 2.6 | Rà các trang còn lại ở 375px (`/practice`, `/vocab`, `/progress`, `/docs`, `/login`, landing) | Không trang nào cuộn ngang; bảng Vocabulary cuộn trong khung riêng |
| 2.7 | Kiểm thật ở 375 / 768 / 1280 | Screenshot ba cỡ cho `/write` và `/practice/:id` |

## Milestone 3 — Ngôn ngữ nhất quán

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 3.1 | Dịch 10 chuỗi hiển thị sang tiếng Anh, **kèm test tương ứng**: `PracticeAttemptPage.tsx` (145 `Bản sửa {n}/2`, 244 `Góp ý lần trước`, 285 `ôn lại`, 332 `Sửa lại bài này`), `PracticePage.tsx:54`, `VocabPage.tsx` (167, 173), `CriteriaSparklines.tsx:32`, `level-up.ts:69`, `revise-availability.ts:31` | `pnpm test` xanh; duyệt lại từng màn thấy toàn tiếng Anh |
| 3.2 | Test quét chặn tái diễn: fail khi có ký tự có dấu tiếng Việt trong chuỗi JSX/template hiển thị (bỏ qua comment và file test) | Test đỏ khi cố tình thêm một chuỗi tiếng Việt; xanh trên code đã dịch |

## Milestone 4 — Không mất đường vào dữ liệu

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 4.1 | `ResultView` không phụ thuộc catalog: nhãn fallback `attempt.taskType`, bỏ chặn ở dòng 47 cho nhánh đã nộp; `ExamRoom` giữ nguyên chặn | Mở `cmtb8qcpq0008biheinco2dlr` (taskType `essay`, ngoài catalog) → thấy đủ band, 4 tiêu chí, feedback, bài viết |
| 4.2 | `revise-availability.ts`: thêm `pendingRevisionId` — bài gốc có bản sửa **chưa nộp** thì nút là "Resume revision" trỏ vào đó | Unit test ba trạng thái: chưa có bản sửa / có bản chưa nộp / đã đủ 2 vòng |
| 4.3 | `findOne` (hoặc list) trả thông tin đủ để biết bản sửa chưa nộp | Unit test API; e2e: tạo revise → không nộp → bài gốc hiện "Resume revision" |
| 4.4 | Chạy thật với bản ghi mồ côi `cmtb9853p000fmghe2ta9okre` | Vào lại được, viết tiếp và nộp được |

## Milestone 5 — Rõ nghĩa thị giác

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 5.1 | `BandStamp`: nhãn CEFR ghi rõ là quy đổi (`≈ C1`) + `title`/`aria-label` giải thích, để không đọc nhầm thành level đang luyện | Component test nhãn; xem thật: stamp `≈ C1` cạnh style notes "a fit for B1" không còn mâu thuẫn |
| 5.2 | 4 sparkline tiêu chí: tiêu chí **yếu nhất** tô vermilion, ba cái còn lại giữ mực — nối tín hiệu màu với dòng chữ "weakest" | Component test: đúng một sparkline mang class vermilion, khớp `summary.weakest` |
| 5.3 | Band-over-time: 4 màu phân biệt được cho A2/B1/B2/C1 (thêm token vào `index.css`), chú giải dùng đúng màu đó | Xem thật với dữ liệu nhiều level; kiểm tương phản trên nền paper |
| 5.4 | Full suite + e2e + lint; duyệt lại toàn app ở desktop và mobile | Tất cả xanh; screenshot cuối |

---

## Rủi ro đã biết

- **Test hiện có bám vào chuỗi tiếng Việt.** Bước 3.1 phải sửa test cùng lúc với UI, nếu tách ra sẽ có commit đỏ ở giữa.
- **`SidePanel` động vào hai màn đang chạy tốt.** Làm 2.1 riêng, có test, rồi mới lắp vào từng màn ở bước riêng — không đổi cả hai trong một commit.
- **Bỏ instruction khỏi prompt sinh đề đổi hành vi model.** Bước 1.4 phải chạy thật vài lần (không chỉ tin unit test) để chắc model không tự bịa lại một frame khác.
- **Dữ liệu cũ vẫn còn đề lặp** — chấp nhận, đã ghi ở quyết định 3. Nếu thấy chướng khi xem lại bài cũ thì xử lý riêng, không nhét vào plan này.
- **`ResultView` bỏ chặn catalog** có thể lộ ra chỗ khác cũng đang giả định `spec` tồn tại. Bước 4.1 rà cả file trước khi sửa.

## Ghi chú chung

- Mỗi bước xong: chạy test liên quan, commit riêng.
- Sau mỗi milestone: `pnpm test` + e2e đầy đủ, lint sạch.
- Milestone 2 xong phải xem thật ở cả ba cỡ màn hình, không chỉ dựa vào component test.
