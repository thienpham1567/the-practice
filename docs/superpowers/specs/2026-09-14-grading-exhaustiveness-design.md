# Chấm bài một lượt biết hết lỗi — thiết kế

**Ngày:** 2026-09-14
**Trạng thái:** đã duyệt từng phần với người dùng, chờ viết plan triển khai
**Liên quan:** [2026-09-02-grading-variance-measurement.md](2026-09-02-grading-variance-measurement.md) (đo variance trước đó — kết luận "không gộp span chồng lấn" của tài liệu đó vẫn giữ nguyên, xem mục 3)

## 1. Vấn đề

Người dùng báo: chấm vòng 1 ra 5 lỗi, sửa hết, chấm lại (revision) thì lại lòi ra vài lỗi mới — và vẫn vậy ở vòng cuối (vòng 2, vòng revision tối đa). Kỳ vọng: một lượt chấm phải biết được hết lỗi ngay, cộng thêm gợi ý để bài viết tốt hơn (không chỉ sửa lỗi).

## 2. Bằng chứng thực nghiệm

Test trực tiếp qua API local (không qua UI, để đọc JSON thô chính xác), dùng bài B1 "email" 108 từ, cài sẵn 12 lỗi có kiểm chứng từng ký tự (script test lưu ở lịch sử phiên làm việc, không commit — có thể dựng lại nếu cần).

### Vòng 1 (bài gốc, 12 lỗi cài sẵn)

AI trả về 13 mark. Đối chiếu offset chính xác với 12 lỗi đã cài:

- **9 lỗi bắt đúng** (article, word-form, noun-number, subject-verb-agreement, preposition, spelling, register...).
- **3 lỗi cài sẵn hoàn toàn không bị bắt**:
  1. Occurrence thứ 2 của "you moving" (thiếu "are") trong "Could you tell me when exactly you moving?"
  2. Comma splice: "I have a car, I can carry heavy boxs..."
  3. Thiếu dấu phẩy sau "However" mở đầu câu.

### Vòng 2 (revision — sửa đúng 13 mark đã báo, không đụng 3 lỗi trên)

AI trả về 7 mark mới:
- **Cả 3 lỗi bị sót ở vòng 1 đều xuất hiện ở đây** — xác nhận đúng triệu chứng người dùng mô tả: không phải lỗi mới sinh ra, mà là lỗi cũ bị bỏ sót giờ mới lộ ra vì AI quét lại từ đầu, độc lập, không nhớ gì vòng trước.
- **Feedback tự mâu thuẫn**: vòng 1 khuyên "Best," → "Best regards," (trang trọng hơn); vòng 2 lại chê "Best regards," quá trang trọng với bạn bè, khuyên đổi sang "Warm regards,".

### Vòng 3 (revision cuối — sửa hết 7 mark của vòng 2)

- Band tăng lên 7.5, chỉ còn 2 gợi ý nhẹ (refinement).
- **`feedbackAudit` ảo giác**: mục "Grammatical Range" khẳng định lỗi "when exactly you moving" **còn tồn tại**, dù bài đã sửa đúng thành "you are moving" từ vòng 2 — AI diễn giải lại (không copy nguyên văn) nội dung audit và bịa thêm nhận định sai với bài thực tế.

### Bốn vấn đề gốc rễ xác định được

1. **Recall không đủ trong 1 lượt** — bản chất xác suất của một lần sinh duy nhất, không có bước tự kiểm tra lại.
2. **Feedback tự mâu thuẫn giữa các vòng** — revision-grade-prompt chỉ nhận 6 đoạn feedback tường thuật của vòng trước, không có "trí nhớ" cụ thể về từng khuyến nghị đã đưa (đặc biệt các khuyến nghị văn phong/word-choice).
3. **`feedbackAudit` ảo giác** — audit dựa trên AI tự thuật lại đoạn văn dài, dễ diễn giải sai so với bài thực tế hiện tại.
4. **Mark "gộp thừa"** — model đôi khi báo 2-3 mark atomic riêng biệt cho từng lỗi nhỏ, rồi báo THÊM một mark gộp cả cụm lại (span bao trùm, correction gộp) — không phải 2 lỗi thật trùng span (đã có khảo sát trước đó về loại chồng lấn này, xem mục 3), mà là model tự lặp lại nội dung đã báo dưới một span rộng hơn.

## 3. Quan hệ với khảo sát variance trước đó (2026-09-02)

Tài liệu cũ đã đo và kết luận: **không nên gộp mark theo span chồng lấn ở tầng code**, vì phần lớn overlap quan sát được là hai lỗi thật khác nhau tình cờ share một từ (ví dụ "excite→excited" chồng "you visiting→you are visiting") — gộp sẽ xoá mất một lỗi đúng. `resolveWritingMarks` cố tình chỉ bỏ mark trùng **span y hệt**, không đụng tới overlap một phần.

Đối chiếu lại data ở mục 2, overlap tôi gặp là **một dạng khác**: không phải 2 lỗi thật chồng nhau, mà là model báo 2 mark atomic ("you moving"→thiếu "are" ở span hẹp, "new apartment"→thiếu "a" ở span hẹp khác) RỒI báo thêm mark thứ 3 bao trùm cả hai với correction gộp cả hai fix vào một. Đây là lỗi "lặp lại nội dung đã nói", không phải "hai lỗi khác nhau trùng chữ".

**Quyết định:** giữ nguyên `resolveWritingMarks` như hiện tại (không thêm dedupe theo overlap ở tầng code — tránh lặp lại rủi ro đã được khảo sát và bác bỏ). Xử lý vấn đề mark-gộp-thừa hoàn toàn ở tầng prompt (mục 4.1).

## 4. Thiết kế

### 4.1. Trích lỗi 2 lượt: extract → verify

Thay `buildMarkPrompt` gọi 1 lần bằng 2 lệnh gọi AI nối tiếp trong cùng một lần submit:

- **Lượt extract**: viết lại prompt để ép quét **có hệ thống theo từng nhóm** trong 13 category hiện có (article, verb-tense, subject-verb-agreement, noun-number, preposition, word-order, word-form, spelling, punctuation, sentence-structure, pronoun, word-choice, register) thay vì yêu cầu chung chung "liệt kê mọi lỗi". Thêm chỉ dẫn mới: mỗi lỗi báo ở span **nhỏ nhất, atomic nhất**; **không được báo thêm một mark gộp bao trùm các mark atomic đã báo** (giải quyết mục 2.4).
- **Lượt verify**: gọi AI lần 2, đưa lại bài + JSON các mark vừa tìm được, yêu cầu rà lại toàn bài theo từng category một lần nữa và **chỉ trả về lỗi chưa có trong danh sách trên**. Gộp kết quả 2 lượt bằng cách nối mảng (không dedupe fuzzy — xem mục 3), qua `resolveWritingMarks` như cũ (vẫn bỏ trùng span y hệt).
- **Đường đi cho revision**: lượt extract của bài revision được cấp thêm danh sách mark của bài cha (quote + correction + category), yêu cầu: xác nhận từng mục đã sửa hay chưa (chỉ để model hiểu ngữ cảnh, KHÔNG dùng làm nguồn audit chính thức — audit chính thức là code, xem 4.3), đồng thời tiếp tục quét toàn bài tìm mọi lỗi kể cả lỗi hoàn toàn mới.
- Chi phí: +1 lệnh gọi AI mỗi lần submit (~vài giây độ trễ tăng thêm), đã được người dùng chấp nhận đổi lấy recall cao hơn.

### 4.2. Chặn feedback tự mâu thuẫn giữa các vòng

`buildRevisionGradePrompt` hiện chỉ nhận 6 đoạn feedback tường thuật của bài cha. Bổ sung: truyền thêm **danh sách mark cụ thể của bài cha** (đặc biệt các mark severity `refinement`: word-choice, register) vào prompt, kèm chỉ dẫn: "Đây là các khuyến nghị cụ thể đã đưa ở vòng trước và người học đã áp dụng — không được phủ định lại một khuyến nghị đã áp dụng trừ khi nó thực sự sai; tập trung feedback mới vào điểm chưa từng được nói tới."

### 4.3. Audit lai: code kiểm tra lỗi cụ thể, AI viết nhận xét tổng quan

Thay cơ chế `feedbackAudit` hiện tại (AI tự thuật + phán đoán trên 6 đoạn văn dài — dễ ảo giác, đã quan sát thấy ở mục 2) bằng cách tách hai việc:

- **Đối chiếu từng mark cụ thể của bài cha — làm bằng code, không qua AI**: với mỗi mark của bài cha (có `quote` chính xác), kiểm tra trực tiếp bằng string-match xem đoạn `quote` đó còn xuất hiện nguyên văn trong `plainText` mới hay không → suy ra `resolved` / `unresolved` một cách xác định, không thể ảo giác. (Trường hợp biên: sửa một phần / diễn đạt lại cả câu khiến quote gốc không còn nhưng lỗi bản chất đã hết — chấp nhận đây là giới hạn của phép kiểm tra chuỗi, coi là `resolved` nếu quote gốc biến mất, vì mục tiêu là "lỗi cụ thể này còn tồn tại y nguyên hay không", không phải đánh giá lại toàn bộ câu.)
- **Nhận xét tổng quan cấp tiêu chí (task response, coherence...) — vẫn để AI làm**, nhưng chấm dựa trên bài **hiện tại**, không yêu cầu AI "nhớ lại" xem lỗi cũ còn hay không (việc đó giờ do code đảm nhiệm).
- Response shape mới: `feedbackAudit` giữ cấu trúc cũ cho phần tường thuật cấp tiêu chí (AI sinh), cộng thêm mảng mới `marksResolution: [{ quote, category, resolved: boolean }]` sinh hoàn toàn bằng code từ bước so khớp chuỗi ở trên.

### 4.4. Gợi ý nâng cao bài viết (enhancements)

Hai phần, sinh cùng lượt gọi AI với `marks` (không tốn thêm lệnh gọi riêng, không qua bước verify ở 4.1 vì đây là gợi ý chủ quan, không phải lỗi khách quan cần bắt hết):

- **`enhancements` — mark tại chỗ, cột JSON mới trên `PracticeAttempt`** (mirror `marks`): mỗi item `{ quote, occurrence, suggestion, note }` — chỗ nào ĐÚNG ngữ pháp nhưng có thể viết hay/tự nhiên hơn. Hiển thị UI thành mục riêng ("Có thể viết hay hơn"), **không tính vào đếm "To fix"**, không trộn với `marks`.
- **`feedback.improvements: string[]`** — 2-3 gợi ý tổng thể (ý tưởng, cấu trúc, từ vựng nên dùng) nằm trong object `feedback` JSON đã có sẵn — không cần migration.

## 5. Thay đổi dữ liệu (migration)

- `PracticeAttempt.enhancements Json?` — cột mới, mirror `marks Json?` (null khi bóc thất bại, `[]` khi không có gợi ý).
- `PracticeAttempt.feedbackAudit` giữ nguyên cột, chỉ đổi shape JSON bên trong (thêm `marksResolution`, xem 4.3) — không cần migration schema vì đã là `Json?`.

## 6. Phạm vi file bị ảnh hưởng

- `apps/api/src/practice/mark-prompt.ts` — viết lại prompt (systematic scan, cấm mark gộp thừa, thêm `enhancements` vào schema), thêm biến thể verify + biến thể revision-aware.
- `apps/api/src/practice/grade-prompt.ts` — thêm `feedback.improvements` vào schema.
- `apps/api/src/practice/revision-grade-prompt.ts` — nhận thêm parent marks, chỉ dẫn chống tự mâu thuẫn; audit tường thuật giữ nguyên nhưng bớt trách nhiệm (không audit đúng/sai lỗi cụ thể nữa).
- `apps/api/src/practice/practice.service.ts` — orchestrate lượt extract+verify, gọi hàm code-audit mới, ghép `marksResolution` vào `feedbackAudit`, lưu `enhancements`.
- `apps/api/prisma/schema.prisma` + migration mới — cột `enhancements`.
- `packages/practice` — type cho `enhancements`/`Enhancement`, có thể thêm `improvements` vào type `GradeFeedback` nếu đang định nghĩa tường minh ở đây.
- `apps/web/src/practice/*` (RevisionChecklist, FixTheseFirst, hoặc component mới) — hiển thị `enhancements` tách biệt khỏi `marks`; hiển thị `feedback.improvements`.
- `apps/web/src/api/practice.ts` — type `PracticeAttemptDetail` thêm field mới.

## 7. Kiểm thử

- Tái sử dụng đúng kịch bản test đã chạy (essay B1 12-lỗi-cài-sẵn, 3 vòng) làm test case hồi quy — có thể viết thành script giống `apps/api/scripts/spike-grading-variance.ts` đã có, chạy lại sau khi sửa để so sánh recall trước/sau.
- Unit test cho hàm code-audit mới (`marksResolution`): quote còn nguyên văn → `unresolved`; quote biến mất → `resolved`.
- Không cam kết recall 100% tuyệt đối (AI vẫn có xác suất sót) — mục tiêu là **giảm rõ rệt** tần suất "lỗi cũ mới lộ ra ở vòng sau", đo bằng cách so sánh số lỗi-sót giữa vòng 1 và vòng 2 trên cùng bộ test trước/sau khi sửa.
