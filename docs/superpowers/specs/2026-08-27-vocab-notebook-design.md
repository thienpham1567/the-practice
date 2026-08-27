# Sổ tay từ vựng (Vocab Notebook) — Design

**Ngày:** 2026-08-27
**Trạng thái:** đã duyệt qua brainstorm

## 1. Vấn đề

Mỗi đề practice AI sinh 6–8 từ vựng kèm nghĩa và ví dụ — rồi vứt. Bài sau không biết bài trước đã dạy gì, người học không biết mình đã *thực sự dùng* từ nào. Từ vựng chỉ thành của mình khi được dùng lại trong bài viết; app hiện không đo và không tạo cơ hội cho việc đó.

Bản sửa bài (spec vòng sửa) không đi qua `create()` nên không sinh từ mới; nộp bản sửa vẫn quét sổ như thường — dùng từ trong lúc sửa cũng là dùng thật.

Đây là nửa đầu của hướng "bộ nhớ tích luỹ". Nửa còn lại — **sổ lỗi tái diễn** — để spec riêng, làm sau khi `feedbackAudit` (spec vòng sửa bài 2026-08-27) tích đủ dữ liệu thật về loại lỗi thường gặp.

### Ngoài phạm vi bản này

Sổ lỗi tái diễn; flashcard/spaced-repetition đúng nghĩa (SM-2…); người dùng tự thêm từ; phát âm; dịch nghĩa tiếng Việt; đồng bộ từ tính năng rewrite của editor thường.

## 2. Các quyết định

| Quyết định | Chọn | Lý do |
|---|---|---|
| Cách thu từ | **Tự động** — mọi từ AI gợi ý vào sổ, không cần bấm gì | Công cụ cá nhân, ma sát bằng không. |
| Ép dùng lại | **Gợi lại có đánh dấu**: trộn tối đa 4 từ cũ-chưa-dùng vào đề mới, chip "ôn lại"; không bắt buộc, không ảnh hưởng điểm | Thuận tự nhiên. Tính vào điểm sẽ làm band lệch chuẩn IELTS, không so được giữa các bài. |
| Phát hiện "đã dùng" | **String match** nguyên từ, không phân hoa thường, chấp nhận biến tố `-s/-es/-ed/-ing/-d`, hỗ trợ cụm từ | Heuristic đủ tốt, không tốn AI call. Giới hạn đã biết: biến tố bất quy tắc (`go→went`) không bắt được — chấp nhận. |
| Phạm vi quét khi nộp | **Toàn bộ sổ** của user, không chỉ từ của đề này | Tự dùng từ cũ không được gợi ý vẫn được ghi nhận. Vài trăm entry — một findMany + match bộ nhớ. |
| Mô hình dữ liệu | **Bảng `VocabEntry`** unique `[userId, word]` | Danh tính từ xuyên suốt các bài — đúng nghĩa tích luỹ. Suy từ JSON attempt lúc đọc là O(số bài) mỗi lần và chống lại chính ý tưởng. |

## 3. Data model

```prisma
model VocabEntry {
  id              String    @id @default(cuid())
  userId          String
  /// Khoá danh tính: lowercase + trim. "Commute" và "commute" là một entry.
  word            String
  meaning         String
  example         String
  /// Level tại lần gợi ý đầu — lọc ứng viên ôn lại cùng trình độ.
  level           String
  suggestedCount  Int       @default(1)
  usedCount       Int       @default(0)
  lastSuggestedAt DateTime  @default(now())
  firstUsedAt     DateTime?
  createdAt       DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, word])
  @@index([userId, usedCount, lastSuggestedAt])
}
```

`meaning/example` giữ bản của lần gợi ý **đầu tiên** — entry ổn định, không bị mỗi đề ghi đè.

## 4. Luồng sinh đề (`create()`)

1. Query ứng viên ôn lại: `usedCount = 0`, cùng level, **không nằm trong vocabulary của bài liền trước** — bài liền trước = attempt mới nhất của user theo `startedAt`, bất kể level (giãn cách tối thiểu), sắp `lastSuggestedAt` cũ nhất trước, lấy 4.
2. Tiêm vào prompt sinh đề: sau khi model đã chọn chủ đề, đưa vào danh sách từ vựng những từ trong review list **hợp với chủ đề** (0–4 từ), phần còn lại sinh mới. Chủ đề quyết trước — không bóp méo đề để nhét từ.
3. Server đối chiếu vocabulary AI trả về với ứng viên → gắn `review: true` vào từng item trong JSON `vocabulary` của attempt (thêm field trong Json sẵn có, không đổi schema attempt).
4. Upsert mọi từ trả về vào `VocabEntry`: mới → tạo; đã có → `suggestedCount++`, cập nhật `lastSuggestedAt`.

Không thêm AI call. **Upsert lỗi → log warning, không làm hỏng việc tạo đề** — cùng triết lý ghi `AiUsage`.

## 5. Luồng nộp bài (`submit()`)

Sau khi chấm thành công: quét `plainText` với toàn bộ `VocabEntry` của user. Match → `usedCount++`, `firstUsedAt` set nếu null. Logic match tách module thuần `vocab-match.ts`:

- match theo ranh giới từ, không phân hoa thường;
- biến tố đơn giản: `word` + `s | es | ed | ing | d` (kể cả dạng bỏ `e`: `commute → commuting`);
- cụm nhiều từ match theo chuỗi từ liên tiếp.

Đánh dấu lỗi → log warning, không làm hỏng kết quả chấm.

## 6. API + UI

- `GET /practice/vocab` (JwtAuthGuard): sổ của chính mình; chưa-dùng xếp trước, trong nhóm sắp theo `lastSuggestedAt` giảm dần; cursor pagination theo nếp chung.
- Trang **`/vocab`** (RequireAuth): bảng từ / nghĩa / ví dụ, badge `chưa dùng` / `đã dùng ×n`, filter trạng thái. Link từ trang Practice.
- `PracticeAttemptPage`: item có `review: true` mang chip **"ôn lại"** viền vermilion.

## 7. Testing

- **`vocab-match` (unit, thuần):** ranh giới từ (`use` không match `useful`), hoa thường, từng biến tố, dạng bỏ `e`, cụm từ, không match trong từ ghép.
- **Service (unit):** upsert tăng `suggestedCount` đúng, entry mới giữ meaning đầu; chính sách ứng viên (loại từ đã dùng, loại từ bài liền trước, thứ tự, trần 4, lọc level); đánh dấu đã-dùng qua nhiều entry; nhánh upsert/đánh dấu lỗi không phá luồng chính.
- **`create()` (unit):** prompt chứa review list; cờ `review` gắn đúng vào item trùng ứng viên.
- **E2E:** sinh đề → sổ có từ; nộp bài chứa một từ (có biến tố) → thành đã-dùng; sinh đề tiếp → có từ ôn lại được gắn cờ; `GET /practice/vocab` không thấy sổ người khác.
- **Web (component):** trang sổ tay ba trạng thái (rỗng / có từ / lỗi); chip "ôn lại" hiện đúng item.
