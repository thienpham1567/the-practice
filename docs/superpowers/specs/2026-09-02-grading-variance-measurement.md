# Đo độ ổn định của chấm bài và bóc lỗi — kết quả

**Ngày:** 2026-09-02
**Trạng thái:** đã đo, dùng làm đầu vào cho các quyết định của Đợt 2
**Script:** `apps/api/scripts/spike-grading-variance.ts`

## 1. Vì sao đo

Sau khi đi hết flow writing trên UI, có hai nghi ngờ về độ tin:

- Band 6.5 cho một bài có "It have", "three activity", "it show" — có vẻ rộng tay.
- Một mark gắn sai nhãn ("street food" không đếm được → gắn `article` thay vì `noun-number`), và một mark là dương tính giả ("will come" bị gắn `verb-tense`).

[Spec sổ lỗi](2026-09-02-mistake-notebook-design.md) mục 11 cũng đã ghi sẵn rủi ro "model rẻ bóc lỗi không ổn định". Trước khi chỉnh prompt hay đổi model, cần biết **thực tế lệch bao nhiêu** — không có baseline thì không cách nào biết một thay đổi có tác dụng hay chỉ là nhiễu.

## 2. Cách đo

Một bài B1 cố định (96 từ, lỗi cố ý kiểu người Việt hay mắc), chấm **5 lần**. Script import thẳng `buildGradePrompt` / `buildMarkPrompt` và schema mà app đang dùng — không chép prompt ra, để đo đúng thứ đang chạy thật.

Model: `anthropic/claude-haiku-4.5` (mặc định hiện tại).

## 3. Kết quả

### Band ổn định hơn dự đoán

| | min | max | spread | mean |
|---|---|---|---|---|
| **Band tổng** | 6.5 | 7.0 | **0.5** | 6.70 |
| Task Response | 7.0 | 7.5 | 0.5 | 7.20 |
| Coherence & Cohesion | 6.5 | 7.0 | 0.5 | 6.70 |
| Lexical Resource | 6.0 | 6.5 | 0.5 | 6.20 |
| Grammatical Range | 5.5 | 6.0 | 0.5 | 5.90 |

Không tiêu chí nào lệch quá nửa band. Đây nằm trong khoảng lệch bình thường **giữa hai giám khảo người thật** của IELTS.

**Kết luận: biểu đồ band theo thời gian đang đo tín hiệu, không phải nhiễu.** Nghi ngờ ban đầu là sai.

### Bóc lỗi: nhớ chắc lỗi rõ ràng, lung lay ở phần rìa

Số mark mỗi lần: 7–8 (spread 1).

| Lần tìm thấy | Đoạn trích | Nhãn |
|---|---|---|
| 5/5 | "three activity" | `noun-number` |
| 5/5 | "It have" | `subject-verb-agreement` |
| 5/5 | "the local dish" | `noun-number` |
| 5/5 | "it show" | `subject-verb-agreement` |
| 5/5 | "in weekend" | `preposition` |
| 4/5 | "Do you prefer hotel or homestay?" | `article` |
| 3/5 | "very interesting" | `word-order` |
| 2/5 | "the museum near river" | `article` |
| 2/5 | "show the history of my city very interesting" | `word-form` / `sentence-structure` ← **lệch nhãn** |
| 1/5 | "visit the museum near river" | `article` |
| 1/5 | "hotel or homestay" | `article` |

**Năm lỗi rõ ràng được tìm thấy 5/5 lần, nhãn nhất quán tuyệt đối.** Đó là phần quan trọng nhất và nó chắc chắn.

Bất ổn nằm ở ba chỗ, theo thứ tự nghiêm trọng giảm dần:

1. **Ranh giới đoạn trích khác nhau cho cùng một lỗi.** "the museum near river" (2/5) và "visit the museum near river" (1/5) là cùng một lỗi thiếu mạo từ, trích khác nhau. Tương tự "Do you prefer hotel or homestay?" (4/5) với "hotel or homestay" (1/5). Người học nhìn thấy hai gạch chồng lấn cho cùng một chỗ sai.
2. **Mark chỉ xuất hiện một lần** (2/11 đoạn). Nhiễu thuần.
3. **Lệch nhãn: 1/11 đoạn.** Với hồ sơ tích luỹ qua 10 bài thì mức này tự triệt tiêu được.

## 4. Điều này đổi kết luận thế nào

Giả định vào cuộc là "chấm điểm không đáng tin, cần chỉnh prompt hoặc đổi model mạnh hơn". **Dữ liệu bác bỏ điều đó.**

| Việc từng định làm | Sau khi đo |
|---|---|
| Tách model mạnh riêng cho việc chấm | **Không cần.** Spread 0.5 không biện minh nổi chi phí. |
| Chỉnh prompt chấm cho chặt hơn | **Không cần**, và rủi ro: prompt hiện có test bảo vệ, sửa mà không có lý do đo được là đánh đổi mù. |
| Chống dương tính giả ở bóc lỗi | **Cần**, nhưng vấn đề thật không phải "sai nhãn" mà là **trùng span** — cùng một lỗi bị trích hai kiểu. |

Việc đáng làm duy nhất rút ra từ số liệu: **gộp các mark chồng lấn nhau**. `resolveWritingMarks` hiện chỉ bỏ mark trùng **span y hệt** (`start:end` giống nhau); hai span lồng nhau như `[a,b]` và `[a,c]` đều được giữ. Đó chính là hiện tượng quan sát được.

Ngoài ra: band ổn định nghĩa là **nhãn CEFR không bị nhiễu** — nên vấn đề "band 7 ở đề B1 hiện ≈ C1" đứng độc lập, phải xét trên lý lẽ riêng chứ không phải vì con số dao động.

## 5. Giới hạn của phép đo

Một bài, một mức, một model, 5 lần. Không nói được gì về bài ở ranh giới hai band (nơi lệch có thể lớn hơn), về mức C1, hay về bài quá ngắn. Nếu sau này nghi ngờ quay lại, chạy lại script với bài khác trước khi kết luận.
