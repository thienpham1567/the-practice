# Bài mẫu tham khảo sau khi chấm + đổi path /practice → /writing — thiết kế

**Ngày:** 2026-09-14
**Trạng thái:** đã duyệt từng phần với người dùng, chờ viết plan triển khai

## 1. Đổi path `/practice` → `/writing`

**Phạm vi đã chốt: chỉ URL frontend.** Không đụng API backend (`/practice/attempts`, `/practice/progress`, `/practice/vocab`, `/practice/mistakes` giữ nguyên) — API không phải thứ người dùng nhìn thấy, đổi thêm chỉ tăng rủi ro mà không có lợi ích UX. Cũng không đổi tên file/component (`PracticePage.tsx`, `PracticeAttemptPage.tsx`, `api/practice.ts`...).

Lưu ý đã xác nhận: `/write` (EditorPage — viết tự do) là route khác, tồn tại song song với `/writing` (route mới cho PracticePage/PracticeAttemptPage — bài thi có tính giờ). Hai path gần giống tên nhau nhưng không đụng nhau ở tầng router (react-router khớp chính xác từng route).

**Việc cần làm:** đổi `path="/practice"` và `path="/practice/:id"` trong `App.tsx`, cùng mọi `to="/practice"` / `navigate("/practice")` / `lockupTo="/practice"` rải rác ở các trang (đã liệt kê ở phần khám phá: `PracticeAttemptPage.tsx`, `EditorPage.tsx`, `ProgressPage.tsx`, `PracticePage.tsx`, `DocumentsPage.tsx`, `VocabPage.tsx`, `folio/after-auth-path.ts`, `folio/AttemptDeleteControl.tsx`, `folio/FolioNav.tsx`) sang `/writing`.

## 2. Tính năng: sinh 2 bài mẫu tham khảo sau khi chấm

### 2.1. Mục tiêu

Sau khi một bài (gốc hoặc revision) đã được chấm xong, người học có thể bấm một nút để AI sinh ra 2 bài viết hoàn chỉnh, đúng đề, đúng level, để đọc tham khảo — thấy được cách viết tốt trông như thế nào, không chỉ thấy lỗi của chính mình.

### 2.2. Data model

- `PracticeAttempt.sampleEssays Json?` — cột mới trên Prisma model, mirror pattern của `marks`/`enhancements`. `null` = chưa sinh; `string[]` (đúng 2 phần tử) khi đã sinh.
- **Lưu riêng theo từng attempt** (đã chốt) — không chia sẻ qua chuỗi revision dù chúng dùng chung prompt. Round 0 và round 1 có thể có 2 bộ bài mẫu riêng nếu người học bấm ở cả hai; đơn giản hoá data model, đổi lại là có thể tốn thêm 1 lượt AI nếu bấm ở nhiều round của cùng 1 chuỗi — chấp nhận được.
- **Sinh một lần** — nếu `sampleEssays` đã có, endpoint trả về luôn giá trị cũ, không gọi AI lại.

### 2.3. Backend

- **Prompt builder mới**: `apps/api/src/practice/sample-essay-prompt.ts`
  - Schema `SAMPLE_ESSAY_SCHEMA`: `{ essays: [{text}, {text}] }`, `minItems`/`maxItems` = 2.
  - `buildSampleEssayPrompt(task, promptText, level)`:
    > Write two complete, high-quality model answers for this English exam task, for a learner to study as reference.
    >
    > Task type: {label}
    > CEFR level: {level}
    > Instruction: {task.instruction}
    > Prompt given to the writer: {promptText}
    > Target length: {minWords}-{maxWords} words each.
    >
    > Write exactly two essays that both fully answer the prompt but take genuinely different approaches — different structure, angle, or tone — so the learner sees more than one way to do this well. Both must sit clearly within level {level}: natural and correct for a strong {level} writer, not one level above.
  - Bám theo level của task (đã chốt) — không phải luôn viết ở mức cao nhất, để không vượt quá tầm với người học A2/B1.
  - Văn bản thuần, không kèm chú thích (đã chốt) — 2 bài viết theo 2 hướng tiếp cận khác nhau đã đủ cho thấy "có nhiều cách viết đúng", không cần field ghi chú thêm.

- **Endpoint mới**: `POST /practice/attempts/:id/samples`
  - Không nhận body (giống `revise`).
  - `@UseGuards(UserThrottlerGuard, DailyAiQuotaGuard)` — tính vào quota AI hàng ngày như mọi hành động gọi AI khác.
  - Validate: attempt tồn tại + thuộc user; `submittedAt` phải khác null (bài phải đã chấm xong) — nếu chưa, 409 Conflict, thông báo "Practice attempt has not been graded yet" (tái dùng câu chữ giống lỗi tương tự ở `revise()`).
  - Nếu `sampleEssays` đã có sẵn: trả về attempt hiện tại luôn, không gọi AI.
  - Ngược lại: gọi `AiService.complete()` với `usage.endpoint: "practice.samples"` (thêm giá trị mới vào union `AiEndpoint` trong `ai.service.ts`), lưu kết quả vào `sampleEssays`, trả về attempt đã cập nhật.

- **`PracticeService`**: thêm method `generateSamples(userId, id)` theo đúng pattern các method hiện có (`findOne` để load + kiểm tra quyền, rồi xử lý).

### 2.4. Frontend

- **API client** (`apps/web/src/api/practice.ts`): thêm `sampleEssays: string[] | null` vào `PracticeAttemptDetail`; thêm hàm `generateSampleEssays(id) => apiJson<PracticeAttemptDetail>(...)`.
- **Component mới** `apps/web/src/practice/SampleEssays.tsx`: nhận `{ sampleEssays: string[] | null, onGenerate: () => void, isPending: boolean }`.
  - Khi `sampleEssays === null`: hiện nút "See model answers" (style `bg-ink` giống nút Submit/Revise), disabled + text "Generating…" lúc `isPending`.
  - Khi đã có `sampleEssays`: ẩn nút, render 2 bài viết đầy đủ (heading "Model answer 1" / "Model answer 2", giữ line break bằng `whitespace-pre-line` hoặc tách đoạn).
- **Vị trí trong `PracticeAttemptPage.tsx` (`ResultView`)**: section cuối cùng trong sidebar Scores, **sau** `StyleProfile` (đã chốt) — chỗ người học đọc xong toàn bộ phản hồi về bài của mình rồi mới tới phần "đọc thêm bài mẫu".
- Dùng `useMutation` (React Query) gọi `generateSampleEssays`, `onSuccess` cập nhật cache của `["practice-attempt", attempt.id]` giống cách `AttemptDeleteControl`/nút Revise đang làm.

## 3. Phạm vi file bị ảnh hưởng

**Đổi path:**
- `apps/web/src/App.tsx`
- `apps/web/src/pages/{PracticeAttemptPage,EditorPage,ProgressPage,PracticePage,DocumentsPage,VocabPage}.tsx`
- `apps/web/src/folio/{after-auth-path.ts,AttemptDeleteControl.tsx,FolioNav.tsx}`
- Test liên quan (`PracticePage.test.tsx`, `PracticeAttemptPage.test.tsx`, ...) nếu có assertion cứng vào `/practice`.

**Bài mẫu tham khảo:**
- `apps/api/prisma/schema.prisma` + migration mới (cột `sampleEssays`).
- `apps/api/src/practice/sample-essay-prompt.ts` (mới).
- `apps/api/src/practice/practice.controller.ts`, `practice.service.ts`.
- `apps/api/src/ai/ai.service.ts` (thêm `"practice.samples"` vào `AiEndpoint`).
- `apps/web/src/api/practice.ts`.
- `apps/web/src/practice/SampleEssays.tsx` (mới).
- `apps/web/src/pages/PracticeAttemptPage.tsx`.

## 4. Kiểm thử

- Unit test cho `buildSampleEssayPrompt`/schema (theo pattern `grade-prompt.spec.ts`).
- Unit test cho `PracticeService.generateSamples`: 409 khi chưa chấm, không gọi AI lần 2 khi đã có `sampleEssays`, lưu đúng usage.endpoint.
- Test component `SampleEssays` (render nút → loading → hiện 2 bài).
- Không cần test sống bằng AI thật cho tính năng này trừ khi có nghi ngờ cụ thể — đây là tính năng hiển thị nội dung tham khảo, không có yêu cầu độ chính xác nghiêm ngặt như phần chấm điểm.
