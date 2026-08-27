# Vòng sửa bài (Revise → Regrade) — Design

**Ngày:** 2026-08-27
**Trạng thái:** đã duyệt qua brainstorm

## 1. Vấn đề

Vòng luyện hiện tại dừng ở lúc nhận điểm: nộp bài → band + feedback → hết. Người học tiến bộ khi **sửa bài theo góp ý**, không phải khi đọc góp ý rồi mở đề mới. App chưa có đường nào quay lại bài vừa chấm để sửa và được chấm lại.

Design cũ (2026-08-25) từng ghi "chấm lại bài cũ" là ngoài phạm vi. Bản này **đổi quyết định đó có chủ đích**: đây là công cụ cá nhân luyện mỗi ngày, và điểm đau lớn nhất người dùng nêu là "không biết sửa thế nào".

### Ngoài phạm vi bản này

So sánh hai bản sửa cạnh nhau (diff view), sửa bài documents thường (chỉ áp dụng cho practice), nhiều nhánh sửa từ một bài (chuỗi là đường thẳng), tự động gợi ý câu sửa sẵn (người học phải tự sửa).

## 2. Các quyết định

| Quyết định | Chọn | Lý do |
|---|---|---|
| Điểm xuất phát khi sửa | **Nạp sẵn bài đã nộp**, sửa trực tiếp | Đúng nghĩa revision như lớp dạy viết: giữ cái được, sửa cái bị chê. Viết lại từ trang trắng là bài tập khác. |
| Cách chấm bản sửa | **Chấm có đối chiếu** feedback cũ | Kết quả gồm band mới VÀ từng góp ý cũ được đánh dấu đã-sửa/chưa. Đây là cái làm vòng sửa khác việc nộp bài mới. |
| Số vòng | **Tối đa 2** | Sau 1–2 vòng là micro-edit đuổi điểm, không còn học. Cũng chặn chi phí AI. |
| Đồng hồ | **Không đếm ngược** ở bản sửa | Sửa bài là việc thợ, không phải mô phỏng thi. Vẫn ghi `elapsedSeconds` âm thầm. |
| Mô hình dữ liệu | **Attempt tự tham chiếu** (`parentAttemptId`) | Bản sửa *là* một attempt nên tái dùng nguyên vẹn autosave, grading lock, quota, styleSnapshot. Không xây pipeline thứ hai. |

## 3. Data model

Ba cột mới trên `PracticeAttempt`, không bảng mới:

```prisma
/// Bản sửa trỏ về bài nó sửa. null = bài gốc.
parentAttemptId String?
/// 0 = gốc, 1–2 = vòng sửa. Lưu thẳng để kiểm tra trần bằng một phép so sánh.
revisionRound   Int     @default(0)
/// Kết quả đối chiếu khi chấm bản sửa: mỗi góp ý cũ → resolved | partial | unresolved.
feedbackAudit   Json?

parent    PracticeAttempt?  @relation("Revisions", fields: [parentAttemptId], references: [id], onDelete: Cascade)
revisions PracticeAttempt[] @relation("Revisions")

@@index([parentAttemptId])
```

`onDelete: Cascade`: xoá bài gốc kéo theo chuỗi sửa — đúng trực giác người dùng.

## 4. API

Một endpoint mới, còn lại tái dùng nguyên trạng:

### `POST /practice/attempts/:id/revise`

Điều kiện (kiểm trong transaction): attempt thuộc user; **đã có điểm** (`submittedAt != null` và `band != null`); `revisionRound < 2`; **chưa có bản sửa nào** trỏ về nó (chuỗi thẳng, không phân nhánh). Vi phạm → 409, không tồn tại → 404.

Hành vi: tạo attempt mới — copy `level/taskType/prompt/ideas/vocabulary/hintsOpened` từ cha; `content/plainText/wordCount` nạp từ bản đã nộp của cha; `revisionRound = cha + 1`. **Không gọi AI, không gắn `DailyAiQuotaGuard`** — tạo bản sửa miễn phí, chỉ lần nộp mới tốn quota.

Sau đó người dùng đi đúng luồng cũ: `PATCH` autosave → `POST :id/submit`. Grading lock, quota, throttle hoạt động sẵn vì bản sửa là một attempt.

### Thay đổi response

`GET /practice/attempts/:id` trả thêm `parentAttemptId`, `revisionRound`, `feedbackAudit`, và `parentBand` (band của cha — UI vẽ delta không phải fetch hai lần).

`GET /practice/attempts` (list) chỉ trả **bài gốc** (`parentAttemptId: null`), mỗi dòng kèm tóm tắt chuỗi: số vòng sửa và band mới nhất.

**Hệ quả có chủ đích cho biểu đồ:** `BandChart`/`StreakStrip` đọc từ list nên sẽ vẽ band của *lần viết đầu* mỗi bài. Đây là so sánh công bằng giữa các ngày (bài đã sửa 2 vòng không được đứng cạnh bài viết một lần); band sau sửa hiện ở tóm tắt chuỗi, không vào biểu đồ.

## 5. Chấm đối chiếu

`submit()` nhìn `parentAttemptId`: bản sửa → `buildRevisionGradePrompt`, nhận thêm **feedback + band của cha**. *Không* gửi bài văn cũ: để phán "góp ý X đã sửa chưa" chỉ cần góp ý cũ và bài mới; bài mới phải được chấm bằng chính nó, không phải bằng phép so văn bản. Tiết kiệm ~300 từ token mỗi lần chấm.

Schema output = schema chấm hiện tại cộng:

```
feedbackAudit: [{ point: string, status: "resolved" | "partial" | "unresolved" }]
```

Band vẫn do server tính từ `overallBand(scores)` — AI không tự cho band, giữ nguyên tắc cũ.

**Audit là phần phụ:** AI trả audit hỏng/thiếu → vẫn lưu điểm và feedback, `feedbackAudit = null`, log warning. Không để phần đối chiếu làm hỏng lần chấm người dùng đã chờ 20 giây.

## 6. UI

- **Trang kết quả:** nút **"Sửa lại bài này"** khi `revisionRound < 2` và chưa có bản sửa → gọi revise → điều hướng sang attempt mới.
- **Trang viết bản sửa:** không đồng hồ; nhãn "Bản sửa 1/2"; feedback của cha ghim trong sidebar thành danh sách từng ý.
- **Kết quả bản sửa:** delta band `5.5 → 6.5` trên `BandStamp`; danh sách audit ✓ (mực) / ± / ✗ (vermilion).
- **Danh sách practice:** chỉ bài gốc; dòng có chuỗi hiện `5.5 → 6.5 · 2 lần sửa`.

## 7. Testing

- **Service (unit):** revise — các nhánh 404/409 (chưa chấm, quá 2 vòng, đã có bản sửa, không phải chủ); copy đúng trường; không có AI call. Submit bản sửa — dùng prompt đối chiếu, lưu audit; nhánh audit hỏng vẫn lưu điểm.
- **Prompt (unit):** builder chứa từng góp ý cũ; schema hợp lệ.
- **E2E:** gốc → revise → sửa → nộp → delta có mặt; revise vòng 3 → 409; revise bài chưa chấm → 409.
- **Web:** logic thuần tách module nhỏ có test (`revise-availability`, format delta) theo nếp `exam-math.ts`.
