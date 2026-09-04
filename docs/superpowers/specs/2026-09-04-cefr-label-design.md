# Nhãn CEFR trên band stamp — Design

**Ngày:** 2026-09-04
**Trạng thái:** đã duyệt qua brainstorm

## 1. Vấn đề

`BandStamp` in ra `Band 7` và ngay dưới là `≈ C1`. Nhãn CEFR đó tính bằng
`bandToCefr(band)` — một hàm chỉ nhận band, **không biết đề thuộc mức nào**.

Prompt chấm bài (`grade-prompt.ts`) cũng không nhắc tới mức: nó chấm theo thang
IELTS 0–9 thuần. Nên một email B1 dài 80–120 từ viết tốt hoàn toàn có thể được
7.0, và stamp tuyên bố `≈ C1`.

Band đó không sai. Cái sai là phép quy đổi: **một đề B1 không có chỗ để chứng
minh C1**. Đề đó không đòi lập luận trừu tượng, không đòi câu phức nhiều tầng.
Được 7 ở đó nghĩa là "làm rất tốt một việc dễ".

Ba thang đang bị nhập làm một:

| Thang | Nói về | Bài đơn lẻ có bằng chứng không |
|---|---|---|
| Band 0–9 | Bài này tốt đến đâu | Có |
| CEFR A2–C1 | Trình độ người viết | **Không** |
| Mức đề | Độ khó việc đã làm | Có sẵn trong DB, đang không hiện |

Stamp suy từ thang 1 ra thang 2 mà bỏ qua thang 3 — trong khi chính thang 3
quyết định thang 1 có nói được gì về thang 2 hay không.

Trong `BandStamp.tsx` đã có sẵn tooltip *"Approximate CEFR level converted from
this IELTS band score — not the practice level you selected."* Tức là vấn đề
từng được nhận ra và vá bằng chú thích, nhưng chữ to vẫn cứ nói `C1`.

### Vấn đề phụ: hai bên làm khác nhau

Speaking **đã** hiện mức đúng chỗ — `Part 2 · B1` ở dòng danh sách
(`SpeakingPage.tsx`) và ở cả hai header màn kết quả (`SpeakingAttemptPage.tsx`).

Writing thì không hiện mức ở đâu cả: dòng danh sách chỉ có `Email` + ngày +
band, header phòng thi và màn kết quả cũng chỉ có `spec.label`. Nên một bài B1
được 7 nằm ngay trên một bài C1 được 6, và bài B1 trông giỏi hơn.

Đây là lý do chọn gắn mức vào **chính stamp** thay vì vá từng trang: stamp là
thứ đi kèm band ở mọi nơi, nên gắn vào đó thì band không bao giờ còn xuất hiện
mà thiếu mức — kể cả ở chỗ nào đó thêm sau này.

### Ngoài phạm vi

Prompt chấm bài — [tài liệu đo variance](2026-09-02-grading-variance-measurement.md)
kết luận không sửa prompt khi không có lý do đo được. `/progress` và
`levelUpVerdict`. Biểu đồ band theo thời gian (đã tô màu theo mức).

## 2. Các quyết định

| Quyết định | Chọn | Lý do |
|---|---|---|
| Nhãn dưới band | **Mức đề: `B1 task`** | Dữ kiện, không suy diễn. Không có gì để sai. |
| `bandToCefr` | **Xoá hẳn** — hàm, export, test, tooltip | Không còn ai gọi. Giữ lại chỉ để mời người sau dùng lại. |
| Vì sao không chặn trần theo mức đề | **Loại** | Vẫn là suy diễn, chỉ thận trọng hơn. Bài B1 được 7 hiện `B1` nói *người viết ở B1*, trong khi bằng chứng chỉ nói *làm tốt một đề B1*. Và nó câm về cái trần: người viết giỏi thấy `B1` mãi mà không hiểu tại sao. |
| Tuyên bố trình độ chuyển đi đâu | **`/progress`, giữ nguyên** | `levelUpVerdict` đã đòi 5 bài liên tiếp ≥ 6.5 **cùng một mức** — đó mới là bằng chứng đủ để nói về người viết. |
| Chữ dùng | **`B1 task`**, bỏ `≈` | Chữ "task" ngăn người đọc hiểu thành "bạn là B1". `≈` chính là dấu hiệu của phỏng đoán. |
| Dòng danh sách | **Hiện mức đề qua chính stamp** | Stamp nhỏ đã nằm sẵn ở đó; thêm mức vào nó là đủ, không cần thêm phần tử mới. |
| Speaking sẽ hiện mức hai lần | **Chấp nhận** | Dòng speaking thành `Part 2 · B1 … Band 5.5 / B1 task`. Thừa một chút, nhưng đổi lại stamp tự đủ nghĩa ở mọi chỗ. Phương án kia — sửa riêng từng trang writing cho giống speaking — để band và mức nằm rời nhau, đúng cái đang hỏng. |

## 3. Thay đổi

### `BandStamp`

Thêm prop bắt buộc:

```ts
interface BandStampProps {
  band: number;
  level: Level;
  size?: "sm" | "lg";
}
```

Dòng dưới đổi từ `≈ ${bandToCefr(band)}` thành `${level} task`. Bỏ hằng
`CEFR_HINT` cùng hai thuộc tính `title` / `aria-label` gắn nó — dòng chữ mới
không cần giải thích.

Prop bắt buộc chứ không phải tuỳ chọn: cả 4 chỗ gọi đều có sẵn `level`, và một
band không kèm mức chính là thứ bản này đang sửa.

### Bốn chỗ gọi

| File | Dòng | Nguồn `level` |
|---|---|---|
| `pages/PracticeAttemptPage.tsx` | `<BandStamp band={attempt.band} />` | `attempt.level` |
| `pages/SpeakingAttemptPage.tsx` | `<BandStamp band={attempt.band} />` | `attempt.level` |
| `pages/PracticePage.tsx` | trong `PaperBandMeta` | thêm prop `level` cho `PaperBandMeta`, truyền `attempt.level` |
| `pages/SpeakingPage.tsx` | trong `TalkBandMeta` | thêm prop `level`, truyền `attempt.level` |

`PracticeAttemptSummary` và `SpeakingAttemptSummary` đều đã có `level`, và
`LIST_FIELDS` phía API đã trả nó. **Không đổi API, không migration.**

Lưu ý ở hai component danh sách: cả `PaperBandMeta` lẫn `TalkBandMeta` đều trả
về `formatChainSummary(...)` trước khi tới `<BandStamp>` khi bài có bản sửa —
nhánh đó là chuỗi dạng `5.5 → 6.5`, không phải stamp, nên **không** đụng tới.

### Xoá

- `packages/practice/src/band-to-cefr.ts`
- `packages/practice/src/band-to-cefr.test.ts`
- dòng export trong `packages/practice/src/index.ts`

Xác nhận không còn tham chiếu nào bằng `grep -rn "bandToCefr"` trước khi xoá.

## 4. Ràng buộc module

- `packages/analysis` không đổi.
- `/progress`, `levelUpVerdict`, `BandChart` không đổi.
- Prompt chấm bài không đổi.
- Chuỗi hiển thị bằng tiếng Anh (repo có test chặn chuỗi tiếng Việt lọt vào UI).

## 5. Testing

| Phạm vi | Trọng tâm |
|---|---|
| `apps/web` | `BandStamp` hiện `Band 7` và `B1 task`; **không** hiện chuỗi nào khớp `/≈|C1/` khi mức là B1 — đây là chính cái regression cần chốt. Hai test cũ của `BandStamp` viết lại theo hợp đồng mới, không xoá. |
| `apps/web` | `PracticePage` / `SpeakingPage`: dòng bài đã chấm hiện mức đề của nó. |
| `packages/practice` | Sau khi xoá, bộ test còn lại vẫn xanh (chứng minh không ai phụ thuộc `bandToCefr`). |

## 6. Đánh đổi đã chấp nhận

Người học mất cảm giác "mình đang ở đâu trên thang quốc tế" sau mỗi bài. Đó là
thứ app chưa bao giờ có bằng chứng để nói cho một bài đơn lẻ — và nói sai còn
hại hơn im lặng, vì nó khiến người học ở lì đề dễ mà tưởng mình đã lên C1.
`/progress` giữ vai trò trả lời câu hỏi đó, với đủ dữ liệu để trả lời.
