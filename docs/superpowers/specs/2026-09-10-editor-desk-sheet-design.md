# Editor desk — tờ viết và chrome — Design

**Ngày:** 2026-09-10
**Trạng thái:** đã duyệt (hướng A)

## 1. Vấn đề

Bàn ảnh đã là phòng; chrome trong suốt. Header và toolbar vẫn là ray app full cửa sổ. Title sống trên gỗ, không trên tờ. Tờ là hình chữ nhật giữa màn — chưa phải một trang bản thảo trên bàn.

## 2. Phạm vi

Trong: tờ viết, header, toolbar trên `/write` (`.editor-desk`).
Ngoài: cột Analysis, ảnh bàn, màu desk-ink, landing, auth, practice prompt.

## 3. Quyết định

| Quyết định | Chọn |
|---|---|
| Title | Xuống đầu tờ, serif italic; không dính header khi cuộn |
| Toolbar | Cùng bề ngang tờ (~46rem), canh giữa; không kẻ ngang xuyên cửa sổ |
| Write/Edit | Hai chữ mono, cái đang chọn gạch son; bỏ khung `border-rule` |
| Tờ | Lề trái rộng, một vạch son mảnh, không kẻ ngang, không nghiêng |
| Practice editor | Không có title trên tờ (không truyền props) |

## 4. Hành vi

- `aria-label="Document title"` chuyển vào input trên `.editor-sheet`.
- Placeholder title: `Untitled`. Giá trị mặc định vẫn `"Untitled"` khi mở bản mới.
- Toolbar vẫn `data-testid="editor-toolbar"`; thanh bọc `max-w` bằng tờ, nằm trên vùng cuộn (không cuộn mất).
- Write/Edit: `aria-pressed` trên nút đang chọn.

## 5. Kiểm chứng

- Title nằm trong `.editor-sheet`; header không còn ô title.
- Toolbar không kéo full viewport.
- Light + dark desktop: tờ ngồi trên gỗ, header thưa, toolbar khớp tờ.
- Practice attempt không hiện title trên tờ.
