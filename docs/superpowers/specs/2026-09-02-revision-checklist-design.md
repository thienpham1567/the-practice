# Checklist lỗi trong phòng sửa bài — Design

**Ngày:** 2026-09-02
**Trạng thái:** đã duyệt qua brainstorm
**Xây trên:** [Sổ lỗi](2026-09-02-mistake-notebook-design.md) đã hoàn thành

## 1. Vấn đề

Phòng sửa bài nạp mark của bài gốc để người học biết phải sửa gì. Mark định vị bằng offset ký tự trên bài gốc, nên chỉ đúng khi chữ chưa đổi — gõ một phím là mọi offset phía sau lệch, và thẻ lỗi mở ra sẽ mô tả một đoạn không liên quan.

Bản hiện tại xử lý bằng cách **ẩn toàn bộ mark ngay khi chữ khác bài gốc**. Đúng về kỹ thuật, nhưng đi thử flow thật thì lộ ra vấn đề: **sửa lỗi thứ nhất là chín lỗi còn lại biến mất**. Mà lý do mang mark sang phòng sửa ngay từ đầu chính là để người học *khỏi phải nhớ* — nếu không thì họ phải lật qua lại giữa màn kết quả và phòng sửa, đúng kiểu ma sát khiến người ta bỏ cuộc.

Tính năng đang phục vụ việc **đọc**, không phục vụ việc **sửa**.

### Ngoài phạm vi bản này

Màn kết quả (ở đó bài đã đóng băng, offset luôn đúng, gạch chân đang hoạt động tốt). Tự động phát hiện lỗi đã sửa. Speaking. `Previous feedback`, hints, `Watch for` trong cùng panel — giữ nguyên.

## 2. Các quyết định

| Quyết định | Chọn | Lý do |
|---|---|---|
| Cách hiển thị | **Checklist ở panel**, bỏ gạch chân trên bài đang sửa | Nhu cầu thật khi ngồi sửa là "còn gì chưa xong" — đó là bản chất một danh sách việc, không phải chú thích tại chỗ. Và đây là hướng duy nhất **không thể hiển thị sai**: không có offset thì không có gì để lệch. |
| Vì sao không ánh xạ lại offset theo diff | **Loại** | Bài toán khó thật (chèn/xoá/dán đè), dễ lệch âm thầm. Hiển thị sai chỗ còn tệ hơn không hiển thị. |
| Vì sao không khoá theo từng đoạn văn | **Loại** | Vẫn còn cửa sai khi đoạn bị tách hoặc gộp, mà chỉ đổi lấy một phần lợi ích. |
| Đánh dấu đã xử lý | **Có, lưu vào DB** | Phòng sửa không có đồng hồ, người học hay sửa nhiều buổi. Trạng thái chỉ sống trong phiên sẽ mất khi F5. |
| Ai quyết định "đã sửa" | **Người học tự đánh dấu** | Muốn máy biết chắc thì phải bóc lỗi lại mỗi lần gõ — vừa đắt vừa chậm. Lần chấm lại mới là trọng tài thật. |
| Mỗi dòng hiện gì | **Trích + câu sửa luôn hiện; ghi chú bấm mới mở** | Đang sửa thì cần biết *sửa thành gì*; lý do để khi nào muốn hiểu mới đọc. Mười lăm dòng đủ ba phần thì panel dài tới mức phải cuộn liên tục trong lúc gõ. |
| Chỗ lưu trạng thái | **Trên bản sửa**, không phải bài gốc | Đây là tiến độ của lượt sửa này, không phải thuộc tính của bài đã nộp. |
| Khoá định danh mark | **`"start:end"`** | Đúng khoá `resolveWritingMarks` đang dùng để chống trùng span, nên duy nhất theo cách dựng. Mark của bài gốc không đổi sau khi nộp nên khoá ổn định. |

## 3. Bỏ gạch chân khỏi phòng sửa

`ExamRoom` không truyền `savedMarks` cho `Editor` nữa.

Kéo theo **xoá** ba thứ đã thêm vào chỉ để chống offset lệch:

- state `liveText` và việc cập nhật nó trong `handleChange`
- biến `carriedMarks` cùng phép so `liveText === parentPaper.plainText`
- prop `savedMarks` ở lời gọi `<Editor>` trong `ExamRoom`

Prop `savedMarks` của `Editor` **giữ nguyên** — màn kết quả vẫn dùng.

Đây là điểm đáng chú ý của hướng này: nó **xoá code mong manh** chứ không chồng thêm cơ chế lên trên.

## 4. Data model

Một cột trên `PracticeAttempt`:

```prisma
/// string[] khoá "start:end" của các mark thuộc bài gốc mà bản sửa này đã xử lý.
/// null hoặc vắng = chưa đánh dấu gì.
handledMarks Json?
```

Không bảng mới, không quan hệ mới.

## 5. Backend

Không thêm route. `PATCH /practice/attempts/:id` đã là chỗ autosave của phòng viết; thêm một trường vào đó:

```ts
export class UpdateAttemptDto {
  // ...các trường sẵn có...

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  handledMarks?: string[];
}
```

`update()` ghi nó như các trường khác:

```ts
...(dto.handledMarks !== undefined && {
  handledMarks: dto.handledMarks as unknown as Prisma.InputJsonValue,
}),
```

Ràng buộc sẵn có giữ nguyên: bài đã nộp thì `update()` trả 409.

`GET /practice/attempts/:id` trả `handledMarks` như mọi cột khác (dùng `include`, không phải danh sách trường chọn lọc). `GET /practice/attempts` (danh sách) **không** kèm — `LIST_FIELDS` là danh sách tường minh nên tự khắc không có.

## 6. Hàm thuần

Trong `packages/practice`, cạnh các hàm hiện có:

```ts
/** Khoá định danh một mark trong phạm vi một bài. */
markKey(mark: Pick<WritingMark, "start" | "end">): string   // `${start}:${end}`

/** Đếm đã xử lý / tổng, cho tiêu đề "To fix · 3/10". */
countHandled(marks: WritingMark[], handled: string[]): { handled: number; total: number }
```

Đặt ở đây vì cả web (render) lẫn api (không dùng ngay, nhưng khoá phải cùng một định nghĩa) đều thuộc miền practice, và vì chúng thuần nên test được độc lập.

## 7. Web

### Mục `To fix` trong panel đề bài

Vị trí: **ngay sau đề bài, trước `Previous feedback`** — nó cụ thể và hành động được hơn nhận xét theo tiêu chí, nên đứng trước.

Chỉ hiện khi đang sửa bản sửa **và** bài gốc có mark. Bài gốc không có mark (`null` do bóc lỗi hỏng, hoặc `[]` do bài sạch) thì ẩn hẳn mục.

Tiêu đề: `To fix · 3/10`.

Mỗi dòng:

| Phần | Luôn hiện | Nguồn |
|---|---|---|
| Ô đánh dấu | ✓ | `handledMarks` chứa `markKey(mark)` hay không |
| Đoạn trích gốc | ✓ | **`parent.plainText.slice(mark.start, mark.end)`** — gạch ngang khi đã xử lý |
| Câu sửa | ✓ | `mark.correction` |
| Nhãn lỗi | ✓ | `MARK_LABELS[mark.category]` |
| Ghi chú giải thích | — | `mark.note`, bấm vào dòng mới mở |

**`WritingMark` không lưu đoạn trích** — nó chỉ có `start`/`end`. Đoạn chữ gốc phải cắt từ `plainText` của **bài gốc**, thứ mà `ExamRoom` đã có sẵn qua query parent đang dùng cho `Previous feedback`. Không cần request mới, nhưng component checklist phải nhận cả `marks` lẫn `parentPlainText`, không thể chỉ nhận `marks`.

Dòng đã xử lý mờ đi và gạch ngang nhưng **giữ nguyên vị trí** — thứ tự theo offset trong bài chính là thứ giúp dò theo văn bản; đẩy xuống cuối sẽ phá mất điều đó.

### Lưu

Bấm đánh dấu → gọi `PATCH` với `handledMarks` đầy đủ (mảng thay thế, không phải thao tác thêm/bớt từng phần tử — đơn giản và không có tranh chấp).

Gửi **ngay**, không đi qua debounce của autosave. Debounce tồn tại vì gõ phím sinh ra hàng chục sự kiện mỗi giây; bấm đánh dấu là hành động rời rạc, hiếm, và là thứ người học kỳ vọng đã được ghi khi họ đóng tab. Dùng chung `save` mutation sẵn có, chỉ không dùng chung hàng đợi trì hoãn.

## 8. Ràng buộc module

- `packages/analysis` không đổi.
- `Editor` không đổi hành vi; chỉ `ExamRoom` thôi truyền `savedMarks`.
- Màn kết quả (`ResultView`) không đổi.
- Nhãn và chuỗi hiển thị bằng tiếng Anh (repo có test chặn chuỗi tiếng Việt lọt vào UI).

## 9. Testing

| Phạm vi | Trọng tâm |
|---|---|
| `packages/practice` | `markKey` và `countHandled` làm TDD: mảng rỗng, chưa đánh dấu gì, đánh dấu hết, khoá lạ không khớp mark nào |
| `apps/api` | `update()` ghi `handledMarks`; ghi mảng rỗng xoá hết đánh dấu; bài đã nộp vẫn 409. E2E: PATCH rồi GET thấy đúng giá trị |
| `apps/web` | Checklist render đủ mục theo thứ tự offset; bấm thì gạch ngang và gọi PATCH; bộ đếm `3/10` đúng; ghi chú ẩn cho tới khi bấm; ẩn cả mục khi bài gốc không có mark. **Test hồi quy: `ExamRoom` không truyền `savedMarks`** |

## 10. Rủi ro đã biết

- **Người học đánh dấu xong nhưng chưa thật sự sửa.** Chấp nhận được: đây là công cụ tự theo dõi, không phải kiểm tra. Lần chấm lại là trọng tài thật, và `feedbackAudit` đã đối chiếu góp ý cũ.
- **Mark của bài gốc có thể nhiều (đo được 15–18 trên một bài).** Panel sẽ dài. Giảm nhẹ bằng việc ẩn ghi chú mặc định; nếu vẫn dài quá thì cân nhắc thu gọn nhóm đã xử lý — nhưng chỉ khi thấy thật, không làm phòng xa.
