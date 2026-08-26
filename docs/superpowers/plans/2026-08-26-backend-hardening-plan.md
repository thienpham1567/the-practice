# Backend Hardening — Plan

**Ngày:** 2026-08-26
**Phạm vi:** củng cố những tính năng đã có (auth, documents, practice, ai). Không thêm bề mặt sản phẩm mới.

Khác với các plan trước, tài liệu này **không có spec riêng**: đây là công việc sửa chữa, lý do của mỗi việc gắn chặt với chính việc đó, tách ra hai file sẽ làm rationale rời khỏi các bước. Bốn quyết định không hiển nhiên được ghi ngay bên dưới.

---

## Quyết định thiết kế

### 1. Chính sách retry cho AI

| | |
|---|---|
| **Retry** | lỗi mạng, timeout (`AbortError`), 429, 500, 502, 503, 504 |
| **Không retry** | 400, 401, 403, 404, 422 — lỗi của ta hoặc của cấu hình; gọi lại chỉ tốn thêm tiền và thời gian |
| **Số lần** | tối đa 3 lượt (1 + 2 retry) |
| **Backoff** | 500ms → 1500ms, **full jitter** để nhiều client không cùng dội lại một lúc |
| **`Retry-After`** | tôn trọng header này khi OpenRouter gửi kèm 429 |

**Timeout mỗi lượt không đủ — cần thêm deadline tổng.** `timeoutMs` 30s × 3 lượt + backoff = có thể treo gần 100 giây. Vì vậy `CompleteOptions` nhận **cả hai**: `timeoutMs` (mỗi lượt) và `deadlineMs` (tổng). Hết deadline thì dừng retry, kể cả còn lượt.

### 2. Khoá chấm bài — vấn đề thật là double-submit, không phải process chết

Đọc kỹ [practice.service.ts](apps/api/src/practice/practice.service.ts): `submit()` đã ghi mọi thứ trong **một `update()` nguyên tử**, nên rủi ro "AI xong rồi DB hỏng" nhỏ hơn mình nói lúc đầu.

Rủi ro thật là **chạy đua**: người dùng bấm Nộp, chờ 20 giây, sốt ruột reload và bấm lại. Hai request cùng vượt qua kiểm tra `submittedAt === null`, **cùng gọi AI (tính tiền hai lần)**, rồi cùng ghi.

Sửa bằng một cột `gradingStartedAt` và một câu update có điều kiện, chiếm khoá **trước khi** gọi AI:

```ts
updateMany({
  where: { id, userId, submittedAt: null, gradingStartedAt: null },
  data:  { gradingStartedAt: now },
})
// count === 0 → đang chấm hoặc đã nộp → 409
```

Chấm hỏng thì xoá `gradingStartedAt` để người dùng thử lại được. Khoá cũ hơn 2 phút coi là chết (phòng trường hợp tiến trình bị giết giữa chừng) và cho phép chiếm lại.

### 3. Health: tách `live` và `ready`

- `GET /health/live` — tiến trình còn sống, **không chạm DB**.
- `GET /health/ready` — `SELECT 1` với timeout 2s.
- `GET /health` giữ nguyên làm alias của `ready` (khỏi phải sửa `render.yaml` cùng lúc).

**Đánh đổi phải biết**: Render chỉ có một `healthCheckPath`, vừa dùng để định tuyến vừa để restart. Trỏ vào `ready` nghĩa là DB chập chờn có thể gây vòng lặp restart. Chấp nhận, vì DB chết thì app cũng vô dụng — và timeout 2s giữ cho việc kiểm tra không tự nó thành điểm nghẽn.

### 4. Quota theo ngày, đếm từ `AiUsage`

Throttle hiện tại (20 req/phút/user) chặn burst nhưng không chặn tổng — một người kiên nhẫn vẫn tạo được hàng trăm bài mỗi ngày.

Đếm từ bảng `AiUsage` chứ không từ `PracticeAttempt`: một bảng phủ mọi endpoint tốn tiền, và cũng chính là bảng đo chi phí. Ngày tính theo **UTC** cho đơn giản — ghi rõ trong thông báo lỗi khi nào quota reset.

Tiền lưu bằng `Decimal(10,6)`, không dùng `Float`.

---

## Milestone 1 — Vận hành

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 1.1 | `/health/live` và `/health/ready` (`SELECT 1`, timeout 2s); `/health` alias của `ready` | E2E: `ready` trả 200 khi DB sống. Tắt container Postgres → `ready` trả **503**, `live` vẫn 200 |
| 1.2 | `app.enableShutdownHooks()` trong `main.ts` | Gửi SIGTERM → log thấy `PrismaService.onModuleDestroy` chạy, tiến trình thoát sạch chứ không bị giết |
| 1.3 | Dọn `RefreshToken` đã hết hạn/thu hồi quá 30 ngày, theo cùng kiểu cleanup cơ hội của `NonceService` | Unit test: row cũ biến mất, row còn hạn và row vừa thu hồi **không** bị đụng |
| 1.4 | Cập nhật `render.yaml` trỏ `healthCheckPath` sang `/health/ready` | File đã đổi; ghi chú rủi ro restart loop ngay cạnh |

## Milestone 2 — Chống mất bài ⭐

Đây là phần bảo vệ 40 phút viết bài của người dùng. Làm TDD.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 2.1 | Tách `timeoutMs` và `deadlineMs` vào `CompleteOptions`; giá trị mặc định khác nhau cho rewrite và chấm bài | Unit test: rewrite giữ 15s; chấm bài dùng deadline rộng hơn. **19 test AI cũ vẫn xanh** |
| 2.2 | Retry theo bảng ở mục 1: chỉ lỗi thoáng qua, backoff + full jitter | Unit test: 503 → thử lại và thành công ở lượt 2; **400 → không retry lần nào**; hết 3 lượt → ném lỗi cuối |
| 2.3 | Tôn trọng `Retry-After` khi có | Unit test với header giả: chờ đúng khoảng đó thay vì backoff mặc định |
| 2.4 | Dừng retry khi vượt `deadlineMs`, kể cả còn lượt | Unit test dùng fake timer: tổng thời gian không vượt deadline |
| 2.5 | Prisma: thêm `gradingStartedAt DateTime?` vào `PracticeAttempt` + migration | `migrate dev` sạch; dữ liệu cũ nguyên vẹn |
| 2.6 | Chiếm khoá bằng `updateMany` có điều kiện **trước khi** gọi AI; `count === 0` → 409 | Unit test: hai lần gọi `submit()` đồng thời chỉ có **một lần gọi AI** |
| 2.7 | Chấm hỏng → xoá `gradingStartedAt`; khoá quá 2 phút coi là chết, cho chiếm lại | Unit test cho cả hai nhánh |
| 2.8 | Đo thời gian chấm thật để chỉnh timeout cho đúng | Chạy thật vài bài 250–300 từ, ghi lại thời gian trong plan |

### Ghi chú 2.8 (2026-08-26)

Đặt tạm `PRACTICE_TIMEOUT_MS = 30_000` và `PRACTICE_DEADLINE_MS = 90_000` (đủ cho 1 lượt + 2 retry + backoff). **Chưa đo production** trong session này — cần chạy vài bài 250–300 từ trên staging/prod với `OPENROUTER_API_KEY` thật rồi cập nhật lại hai hằng số nếu p95 vượt ~25s/lượt.

## Milestone 3 — Chi phí

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 3.1 | Prisma: model `AiUsage(userId, endpoint, model, promptTokens, completionTokens, costUsd Decimal(10,6), createdAt)` + index `[userId, createdAt]` và `[createdAt]` | `migrate dev` sạch |
| 3.2 | `complete()` nhận context `{ userId, endpoint }` và ghi `AiUsage` từ `usage` trong response OpenRouter | Unit test: token và cost lưu đúng; **ghi log lỗi chứ không làm hỏng request** khi việc lưu usage thất bại |
| 3.3 | Gắn context vào cả 3 chỗ gọi: rewrite, practice.generate, practice.grade | Kiểm tra DB sau khi chạy thật: đủ ba loại `endpoint` |
| 3.4 | Quota ngày (UTC) cho 2 route tốn tiền, ngưỡng lấy từ env | E2E: vượt ngưỡng → **429** kèm thời điểm reset; dưới ngưỡng vẫn chạy |
| 3.5 | `GET /ai/usage` — tổng token và chi phí của chính mình trong 30 ngày | E2E: chỉ thấy usage của mình, không thấy của người khác |

## Milestone 4 — Sạch sẽ

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 4.1 | Bỏ `prompt` khỏi `LIST_FIELDS` của `practice.list()` — đúng cái sai mà `documents.list()` đã tránh khi bỏ `content` | Payload danh sách nhỏ đi rõ rệt; UI danh sách không dùng tới `prompt` |
| 4.2 | Pagination cho `documents.list()` và `practice.list()` (cursor theo `id`, mặc định 20) | E2E: trang 1 và trang 2 không trùng bản ghi; không truyền cursor vẫn chạy như cũ |
| 4.3 | `helmet` trong `main.ts` | Response có `X-Content-Type-Options`, `X-Frame-Options`; **web vẫn tải được script GIS** |
| 4.4 | Request ID (`x-request-id`, sinh nếu client không gửi) đưa vào mọi dòng log | Một request lỗi → grep ra được toàn bộ log của đúng request đó |

---

## Rủi ro đã biết

- **`helmet` có thể chặn Google Identity Services.** Chính sách mặc định của helmet đặt CSP; script GIS tải từ `accounts.google.com`. Bước 4.3 phải kiểm nút Google còn hoạt động, không chỉ kiểm header có mặt.
- **Retry làm tăng chi phí khi OpenRouter trục trặc kéo dài.** Giới hạn 3 lượt và deadline tổng là để chặn đúng chuyện này. Sau Milestone 3 sẽ nhìn được số liệu thật.
- **Trỏ `healthCheckPath` vào `ready`** có thể gây restart loop khi DB bảo trì — đã cân nhắc ở quyết định 3.
- **Đổi `CompleteOptions`** động vào code AI đang chạy tốt. Bước 2.1 làm riêng, chạy full test trước khi thêm retry.

## Ghi chú chung

- Mỗi bước xong: chạy test liên quan, commit riêng.
- Sau mỗi milestone: `pnpm test` + e2e đầy đủ, lint sạch.
- Milestone 2 xong phải chạy thật một bài practice từ đầu tới lúc có điểm, không chỉ dựa vào test.
