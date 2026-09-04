# Landing page có chuyển động — Design

**Ngày:** 2026-09-04
**Trạng thái:** đã duyệt qua brainstorm
**Tham chiếu:** phân tích trang `microsoft.ai/models/mai-transcribe-2/` (xem mục 2)

## 1. Vấn đề

Landing page hiện tại (`apps/web/src/pages/LandingPage.tsx`, 84 dòng) là một cột
`max-w-3xl` với mọi thứ vào cùng lúc bằng `animate-fade-up` 0.5s, lệch nhau
30–40ms. Nó gọn và không sai, nhưng nó **không cho thấy app làm gì** — người
chưa dùng đọc xong vẫn phải tự tưởng tượng "chấm như giám khảo" nghĩa là gì.

Người dùng muốn nhịp và chuyển động kiểu trang MAI-Transcribe-2.

## 2. Trang tham chiếu đã học được gì

Đọc thẳng DOM và CSSOM của trang đó, không đoán:

**Chuyển động** — không thư viện nào. Một custom element `<scroll-object>` +
`IntersectionObserver` gắn class `in-view`; CSS transition lo phần còn lại.
Từ vựng gồm 8 primitive: `scale-out` (`scale(1.2)→1`), `scale-in`, `fade-in`,
`slide-up`, `slide-left`, `blur-focus`, `scale-out-and-slide-up`, và custom
element `<split-text by="lines|words|letters">` lệch `--line-index * 70ms`.

Easing dùng chung `cubic-bezier(.43, .195, .02, 1)`.

**Điểm mấu chốt: thời lượng 1.8–2.3s.** Animation web thường 200–400ms. Sự chậm
đó chính là tính cách — điềm tĩnh, "biên tập", không "công nghệ". Chép hiệu ứng
mà giữ 300ms sẽ ra một trang khác hẳn.

**Bảng màu và chữ** — và đây là phát hiện quan trọng nhất:

| | microsoft.ai | The Practice (đang có) |
|---|---|---|
| Nền | `#FEF9ED` | `#faf6ef` (`--color-paper`) |
| Chữ thân | `#5D524B` | `#6b6255` (`--color-ink-soft`) |
| Display | Bradford LL (serif) | `font-display` serif |
| Phụ | Red Hat Mono | `font-mono` uppercase tracking |
| Nhấn | *(không có)* | vermilion `#c14324` |

App **đã ở cùng họ thẩm mỹ**, thậm chí có thêm một màu nhấn. Nên bản này
**không đổi một token màu hay font nào**. Cái thiếu là chuyển động và khoảng
trắng, không phải bảng màu.

**Một thứ họ làm dở, không chép:** `prefers-reduced-motion` của họ chỉ có 2
rule và không tắt được primitive nào. Đó là lý do họ phải gắn toggle
"Accessibility Mode" thủ công ở góc màn hình để bù.

## 3. Các quyết định

| Quyết định | Chọn | Lý do |
|---|---|---|
| Phạm vi | **Chỉ landing page** | Phòng thi và phòng sửa là chỗ làm việc; animation 2 giây ở đó gây vướng. |
| Token màu/chữ | **Không đổi** | Đã cùng họ với trang tham chiếu. Đổi nữa chỉ là đổi cho khác. |
| Số primitive | **3, không phải 8** | YAGNI: chỉ lấy cái trang này dùng. |
| Thời lượng | **1.4–2.0s** | Là toàn bộ tính cách. Rút ngắn thì mất. |
| Hero | **Bài tự sửa trước mắt** | App không có ảnh; ảnh stock sẽ lạc quẻ. Và đoạn văn tự sửa *chính là* thứ app làm — nói được nhiều hơn mọi bức ảnh. |
| Hero lặp lại? | **Diễn một lần rồi dừng** | Trang tham chiếu cũng vậy: settle rồi đứng yên. Lặp vô hạn gây mất tập trung khi đọc phần chữ. |
| Giảm chuyển động | **Nhảy thẳng tới trạng thái cuối** | Làm đúng chỗ này thì không cần toggle thủ công như họ. |

### Ngoài phạm vi

Mọi trang khác. Token màu và font. Nội dung `landing-copy.ts` (dùng lại
nguyên). Ảnh, font, và câu chữ của trang tham chiếu — không lấy gì.

## 4. Hệ chuyển động

### Hook

```ts
/** Gắn class `in-view` một lần khi phần tử vào khung nhìn. Không gỡ ra khi
 *  cuộn qua: hiệu ứng vào lại mỗi lần cuộn lên xuống gây chóng mặt. */
useInView<T extends HTMLElement>(options?: { threshold?: number }): RefObject<T>
```

Trả về một ref. Phần tử tự thêm `in-view` vào `classList`. Dùng
`IntersectionObserver`, ngắt kết nối sau lần đầu.

### Ba class CSS

```css
:root { --ease-settle: cubic-bezier(0.43, 0.195, 0.02, 1); }

.reveal-up        { opacity: 0; transform: translateY(1.5rem); }
.reveal-up.in-view,
.in-view .reveal-up { opacity: 1; transform: none;
                      transition: opacity 1.4s var(--ease-settle),
                                  transform 1.4s var(--ease-settle); }

.settle           { transform: scale(1.03); }
.settle.in-view   { transform: scale(1); transition: transform 2s var(--ease-settle); }

/* Từng dòng, lệch theo --line-index. */
.reveal-lines > [data-line] { opacity: 0; transform: translateY(0.6em); }
.reveal-lines.in-view > [data-line] {
  opacity: 1; transform: none;
  transition: opacity 1.4s var(--ease-settle), transform 1.4s var(--ease-settle);
  transition-delay: calc(var(--line-index) * 70ms);
}
```

`70ms` lấy đúng từ trang tham chiếu — đo được, không phỏng đoán.

### Chữ tách dòng, không phá screen reader

Component `<RevealLines>` nhận `lines: string[]` và render:

```tsx
<span className="sr-only">{lines.join(" ")}</span>
<span aria-hidden="true" className="reveal-lines">
  {lines.map((line, i) => (
    <span key={line} data-line style={{ "--line-index": i }}>{line}</span>
  ))}
</span>
```

Câu gốc nguyên vẹn cho máy đọc; bản tách dòng chỉ để nhìn. Đây là chỗ đa số
người làm hiệu ứng này làm sai.

Tách dòng **thủ công qua props**, không đo chiều rộng lúc chạy — đơn giản hơn
nhiều và không nhảy layout.

### Giảm chuyển động

```css
@media (prefers-reduced-motion: reduce) {
  .reveal-up, .settle, .reveal-lines > [data-line],
  .landing-demo * {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
    animation: none !important;
  }
}
```

Nối vào khối `prefers-reduced-motion` đã có trong `index.css`.

## 5. Hero: bài tự sửa

Cao `min-h-screen`, nội dung căn giữa.

Trên: headline serif lớn qua `<RevealLines>`. Dưới: khối demo.

### Khối demo

Một đoạn văn ngắn của người học với **3 lỗi**. Diễn theo mốc thời gian cố định,
**một lần**, rồi giữ nguyên trạng thái cuối:

| Mốc | Việc |
|---|---|
| 0.0s | Đoạn văn hiện (`reveal-up`) |
| 1.2s | Gạch chân đỏ son vẽ vào lỗi 1 |
| 1.6s | lỗi 2 |
| 2.0s | lỗi 3 |
| 2.8s | Ba chỗ sai đổi thành câu đúng, lệch 150ms |
| 3.6s | Dòng mono `3 mistakes · marked` hiện |

Gạch chân "tự vẽ" bằng `background-image` gradient + `background-size` chạy từ
`0%` tới `100%` — **không** dùng `::highlight()`, vì CSS Custom Highlight API
không animate được và cần JS Range. Kiểu dáng khớp `::highlight(wh-error)` đang
có: sóng, đỏ son, `underline-offset` 3px.

Dữ liệu demo là hằng trong `landing-copy.ts`, cạnh `LANDING_PAPER`:

```ts
export const LANDING_DEMO = {
  lead: "I am very happy that you",
  fixes: [
    { wrong: "will come", right: "are coming", label: "Verb tense" },
    { wrong: "three activity", right: "three activities", label: "Singular / plural" },
    { wrong: "in weekend", right: "at the weekend", label: "Prepositions" },
  ],
  tail: ["to my city. I want to suggest", "we can do together", "."],
  caption: "3 mistakes · marked",
} as const;
```

Câu ghép lại đọc là: *"I am very happy that you **will come** to my city. I want
to suggest **three activity** we can do together **in weekend**."*

Ba lỗi này lấy từ bài đo variance có thật (`2026-09-02-grading-variance-measurement.md`
mục 3) — chúng là ba trong năm lỗi mà model tìm thấy **5/5 lần** với nhãn nhất
quán tuyệt đối. Nên demo không phải bịa: nó là thứ app thật sự bắt được.

Nhãn khớp `MARK_LABELS` trong `packages/practice/src/mark-catalog.ts`.

## 6. Bốn màn sau

Mỗi màn một ý, cách nhau `py-32` trở lên.

| Màn | Nội dung | Chuyển động |
|---|---|---|
| Paper & Talk | Hai thẻ `LANDING_PAPER` / `LANDING_TALK` đang có | `reveal-up`, lệch 120ms |
| Sổ lỗi | Vài nhãn lỗi lặp lại kèm số đếm | `reveal-up` từng dòng |
| Tiến bộ | Một `<svg>` inline với `<polyline>` band tĩnh | `stroke-dasharray`/`stroke-dashoffset` vẽ trong 2s |
| CTA | `Begin practice` + `Sign in` | `reveal-up` |

Số liệu ở màn "Sổ lỗi" và "Tiến bộ" là **hằng minh hoạ**, đặt trong
`landing-copy.ts`. Không gọi API: landing là trang công khai, người chưa đăng
nhập không có dữ liệu, và gọi API ở đây sẽ trả 401.

## 7. Ràng buộc module

- Không đổi token trong `@theme` của `index.css`.
- Không sửa trang nào khác, không sửa `apps/api`, `packages/*`.
- Chuỗi hiển thị bằng **tiếng Anh** (repo có test chặn tiếng Việt lọt vào UI).
- Không thêm dependency: `IntersectionObserver` là API sẵn của trình duyệt.
- Không lấy ảnh, font, hay câu chữ của trang tham chiếu.

## 8. Testing

| Phạm vi | Trọng tâm |
|---|---|
| `useInView` | Thêm `in-view` khi observer báo giao nhau; ngắt kết nối sau lần đầu; không thêm lại |
| `RevealLines` | Câu gốc có trong DOM cho máy đọc; bản animate `aria-hidden`; `--line-index` tăng dần |
| Demo hero | Trạng thái cuối hiện đủ 3 câu sửa; hẹn giờ được dọn khi unmount |
| `LandingPage` | Test cũ (`LandingPage.test.tsx`) **phải xanh nguyên trạng, không sửa một assertion nào** |

`jsdom` không có `IntersectionObserver`; test phải tự stub nó.

### Test cũ ghim những gì

`LandingPage.test.tsx` khẳng định 9 chuỗi và 3 link. Bản dựng lại **phải giữ đủ**:

- `"Sit the paper. Take the turn."` (headline) và câu lede
- `"Vol. 1 · 26 August 2026 · Writing & speaking"` — dateline, tức **`<Masthead>` phải còn**
- kicker + instruction + prompt của cả `LANDING_PAPER` lẫn `LANDING_TALK`
- link `Begin practice` → `/register`, và hai link còn lại

Chú ý chỗ dễ hỏng: headline đi qua `<RevealLines>` nên chuỗi đầy đủ chỉ còn nằm
ở `<span class="sr-only">`. `getByText("Sit the paper. Take the turn.")` vẫn khớp
span đó — **với điều kiện** `lines.join(" ")` dựng lại đúng nguyên văn, kể cả dấu
chấm. Nếu tách dòng sai chỗ, test cũ sẽ đỏ và đó là tín hiệu đúng, không được
sửa test để né.

## 9. Rủi ro

- **Hero cao `100vh` trên điện thoại ngang** có thể cắt mất CTA. Dùng
  `min-h-screen` chứ không `h-screen`, và để nội dung tự đẩy chiều cao.
- **Đoạn demo dài quá sẽ xuống dòng lộn xộn ở màn hẹp.** Giữ ngắn, kiểm ở 375px.
