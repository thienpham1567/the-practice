# Nền động trang auth — Design

**Ngày:** 2026-08-27
**Trạng thái:** đã duyệt qua brainstorm

## 1. Vấn đề

Trang login/register hiện chỉ là giấy tĩnh + grain toàn cục. Form ổn, nhưng nền không có “sự sống” — thiếu khí quyển editorial mà phần còn lại của app đã có (bàn viết, mực, son biên tập).

### Ngoài phạm vi

Landing, editor, practice, progress; WebGL/canvas; thư viện motion mới; đổi copy/layout form; particle/glow kiểu SaaS.

## 2. Các quyết định

| Quyết định | Chọn | Lý do |
|---|---|---|
| Hướng thẩm mỹ | **Mix editorial:** ink wash + ruled paper + vài dấu editorial | Khớp palette giấy/mực/son; không nhảy vibe tech |
| Cường độ | **Rất tinh** — khí quyển gần như không thấy, form vẫn trung tâm | User chọn mức rất tinh (sau tune) |
| Kỹ thuật | **CSS/SVG layers** trong component trang trí | Nhẹ, không lib mới, dễ `prefers-reduced-motion` |
| Phạm vi trang | **Login + register** (`AuthPage` chung) | Cùng một khung auth |
| Tương tác | `aria-hidden`, `pointer-events: none` | Không tranh focus / click với form |

## 3. Cấu trúc hình ảnh

Ba lớp cố định, xếp dưới nội dung form (`z-index` thấp hơn `#root` content của trang auth):

1. **Ink wash** — 2–3 vệt `radial-gradient` (ink + vermilion rất nhạt), drift chậm (~20–40s loop), opacity thấp.
2. **Ruled paper** — đường kẻ ngang + một lề son mảnh; dịch chậm theo trục Y (cảm giác sổ).
3. **Editorial marks** — tối đa 3 dấu (`¶`, `—`, hoặc khung stamp mờ), float nhẹ, opacity thấp. Không emoji.

Mobile: cùng motif; có thể bớt mật độ marks nếu chen form, nhưng không đổi concept.

## 4. Hành vi chuyển động

- Chỉ CSS keyframes (hoặc equivalent thuần CSS). Không JS animation loop.
- `prefers-reduced-motion: reduce` → dừng drift/float; nền còn giấy + (tuỳ chọn) ruled tĩnh, không chuyển động.
- Không animation khi tab ẩn không bắt buộc (CSS đủ); không phụ thuộc scroll.

## 5. Tích hợp code (định hướng)

- Component mới kiểu `AuthAmbient` (tên cuối cùng ở plan), render trong `AuthPage` phía sau form.
- Token màu tái dùng `--color-paper`, `--color-ink*`, `--color-vermilion*`, `--color-rule` — không thêm purple/glow.
- Keyframes đặt cạnh theme hiện có trong `index.css` (hoặc file CSS auth nếu tách gọn hơn).

## 6. Kiểm chứng

- Nhìn thật `/login` và `/register` ở desktop + mobile: form đọc rõ, nền “có sống” mức rất tinh.
- Bật reduced-motion (OS): không còn drift.
- Snapshot/component test: ambient có mặt, `aria-hidden`, không làm vỡ test AuthPage hiện có.
