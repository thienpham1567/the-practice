# Overlay đợi API trên trang auth — Design

**Ngày:** 2026-09-08
**Trạng thái:** đã duyệt qua brainstorm

## 1. Vấn đề

Frontend tĩnh luôn online; API Render free ngủ khi idle. Trang `/login` và `/register` hiện form ngay, nút Google chỉ là khung trống (`sr-only` "Loading Google Sign-In…"). Người dùng bấm Create account lúc API còn ngủ thì request treo hoặc fail, không biết vì sao.

### Ngoài phạm vi

Nâng plan Render, keep-alive, đổi health check production, landing/editor/practice, đổi Google Sign-In sau khi API đã sẵn, copy form, layout form.

## 2. Các quyết định

| Quyết định | Chọn | Lý do |
|---|---|---|
| Phạm vi | Chỉ `AuthPage` (`/login` + `/register`) | Đúng chỗ người dùng đang kẹt |
| Hình thức | Overlay phủ form; form vẫn thấy nhưng mờ và không dùng được | User chọn ghost-overlay |
| Logo / tiêu đề | Vẫn đọc được, không mờ | Giữ ngữ cảnh "đây là trang đăng ký" |
| Gate | `GET /api/health/ready` trả 200 | Cần DB mới đăng ký được; không đếm vào throttle 10/phút của `/auth` |
| Google Sign-In | Vẫn boot song song phía sau overlay | Request đó cũng đánh thức API; khi overlay tắt, nút thường đã sẵn |
| Spinner | Không vòng tròn. Vạch son mảnh. | Khớp Folio: hairline, không SaaS spinner |
| Copy | English, editorial | App đang English |

## 3. Hành vi

### 3.1 Trạng thái

Ba trạng thái trên trang auth:

| Trạng thái | UI |
|---|---|
| `checking` | Overlay hiện. Form `inert`, opacity thấp. |
| `ready` | Overlay tắt. Form dùng được như hiện tại. |
| `failed` | Overlay còn. Copy lỗi + nút Retry. Form vẫn `inert`. |

Probe bắt đầu ngay khi mount `AuthPage`. Không abort trước 90s mỗi lần (proxy tĩnh từng timeout ~90s với 0 byte khi API ngủ). 503, network error, abort sau 90s: thử lại ngay. Tổng thời gian `checking` tối đa 180s rồi `failed`. Không poll song song.

Retry: reset đồng hồ, quay lại `checking`, probe lại từ đầu.

### 3.2 Copy (chuỗi cố định)

| Điều kiện | Chữ |
|---|---|
| `checking`, 0-8s | One moment… |
| `checking`, sau 8s | The desk is waking. This can take a minute. |
| `failed` | The desk isn't answering. |
| Nút | Try again |

Mốc 8s là timer UI, không phụ thuộc probe. `prefers-reduced-motion: reduce`: không chạy vạch; chữ vẫn đổi sau 8s.

### 3.3 Tương tác và a11y

- Mọi thứ dưới heading trong sheet (form, Google, link chuyển login/register, Back to the editor) `inert` khi không `ready`. Theme toggle ngoài sheet vẫn dùng được.
- Overlay: `role="status"` + `aria-live="polite"` + `aria-busy` trên sheet khi `checking`.
- Focus: khi overlay hiện, không nhét focus vào input. Khi `ready`, không tự focus email (tránh giật nếu người dùng đang chờ). Retry nhận focus khi chuyển sang `failed`.
- Reduced motion: chữ tĩnh, vạch đứng yên (hoặc ẩn animation).

## 4. Hình ảnh

Overlay nằm trên vùng form của `.auth-sheet` (dưới heading), scrim `paper` bán trong suốt để form còn đọc được phía sau.

Giữa overlay: vạch son ngang mảnh (scale-x chậm, CSS only) + dòng copy mono nhỏ, tracking rộng, `ink-faint` / `ink-soft`. Không emoji, không chấm bounce, không glow.

Token: `--color-paper`, `--color-ink*`, `--color-vermilion`, `--color-rule`. Dark mode theo theme hiện có.

## 5. Tích hợp code (định hướng)

- Hook probe (tên ở plan) trả `{ status, retry }`. Test được không cần DOM.
- Component overlay (tên ở plan) chỉ render UI theo `status` + elapsed.
- `AuthPage` ghép hook + overlay; không đổi `apiJson` register/login.
- Endpoint sẵn: `GET /health/ready` (web gọi `/api/health/ready`). Không thêm route.

## 6. Kiểm chứng

- Hook: 200 → `ready`; pending → `checking`; 503/timeout → retry; hết 180s → `failed`; `retry()` probe lại.
- AuthPage: overlay khi `checking`; submit/Google/link auth không tương tác; overlay biến khi `ready`; `failed` có Try again.
- Desktop + mobile, light + dark: form còn thấy, chữ overlay đọc được.
- Reduced-motion: không vạch chạy.
- Không phá test AuthPage / Google Sign-In hiện có.
