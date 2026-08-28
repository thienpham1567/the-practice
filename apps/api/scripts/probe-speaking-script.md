# Bài đo Pronunciation — kịch bản đọc

Mục đích: trả lời dứt điểm **AI có thật sự nghe không, hay đang đoán theo đề bài**.

Cách hoạt động: bạn đọc một đoạn đã biết trước nội dung, **cố ý mắc những lỗi cụ thể**. Vì ta biết đáp án đúng từ trước, ta chấm được chính AI.

---

## Cue card (script gửi kèm đúng đề này)

> **Describe a useful object that you own.**
> You should say: what it is · how you got it · why it is useful to you.

---

## Đoạn cần đọc

Đọc **tự nhiên như đang thi**, đừng đọc như đang đọc chính tả. Chỗ nào ghi chú thì làm đúng như ghi chú.

> I want to talk about my headphones, which I bought on **Tran Phu** street for **forty seven** dollars.
>
> I use them almost every day when I work, and they help me **[NGỪNG 4 GIÂY]** concentrate.
>
> The sound quality is very good, and the battery lasts a whole week.
>
> **[NÓI: "um"]** I think the most useful thing is the noise cancelling, because **[NÓI: "you know"]** my street is quite loud.
>
> Yesterday I **go** to the park and listen to music for one hour. ← *đọc đúng chữ "go", đừng sửa thành "went"*
>
> **[NGỪNG 4 GIÂY]** So overall, it is the most useful object that I own.
>
> **My cousin Minh** has the same pair. I would definitely **[NÓI: "uh"]** recommend them to anyone.

### Ba từ phát âm sai có chủ đích

Đọc ba từ này **sai rõ ràng** (kiểu lỗi người Việt hay mắc — mất phụ âm cuối, sai trọng âm):

| Từ | Đọc thành |
|---|---|
| **comfortable** | "com-FOR-table" (sai trọng âm, tách rõ 4 âm tiết) |
| **clothes** | "clo-thes" (hai âm tiết, bật rõ "th") |
| **months** | "mon" (nuốt hẳn "-ths") |

Chèn ba từ đó vào bằng câu này, đọc **sau** câu về battery:

> They are very **comfortable**, and I even wear them with my winter **clothes** during the cold **months**.

---

## Đáp án đúng (script tự chấm theo bảng này)

| # | Loại | Cần AI bắt được |
|---|---|---|
| 1 | pronunciation | `comfortable` |
| 2 | pronunciation | `clothes` |
| 3 | pronunciation | `months` |
| 4 | hesitation | khoảng ngừng 4 giây trước "concentrate" |
| 5 | hesitation | khoảng ngừng 4 giây trước "So overall" |
| 6 | filler | `um` |
| 7 | filler | `you know` |
| 8 | filler | `uh` |
| 9 | grammar | `Yesterday I go` (sai thì) |

**Phép thử chống bịa:** transcript phải chứa ba chi tiết **không thể đoán từ đề** — `Tran Phu`, `forty seven`, `my cousin Minh`.

Đừng dùng `headphones` hay `battery` làm dấu nhận biết: đó là bẫy. Đã kiểm chứng rằng khi đưa vào **3 giây tiếng tone thuần, không có tiếng người**, `gemini-2.5-flash` vẫn trả về một bài nói trôi chảy *"my headphones... I got them from Amazon"* kèm điểm 5.5/5.5/5/6. Những từ đó model tự đoán ra được từ cue card "a useful object".

**Vì vậy script tự chạy một lượt CONTROL trước** — gửi tiếng tone tới từng model. Model nào "phiên âm" được tiếng tone thành chữ thì mọi điểm nó chấm sau đó đều vô nghĩa.

---

## Các bước

```bash
# 1. Mở trang ghi âm trong trình duyệt thật (không dùng browser pane)
open apps/api/scripts/probe-record.html

# 2. Đọc đoạn trên, bấm Stop, file WAV tự tải về

# 3. Chấm — so kết quả AI với đáp án ở trên
node apps/api/scripts/probe-speaking-quality.mjs ~/Downloads/probe.wav
```
