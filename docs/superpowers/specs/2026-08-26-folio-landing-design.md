# Folio theme, landing, and product chrome: Design

**Ngày:** 2026-08-26
**Trạng thái:** Đã duyệt qua brainstorming, chờ implementation plan
**Xây trên:** [Writing practice](2026-08-25-writing-practice-design.md), branding The Practice (con dấu ¶)

## 1. Mục tiêu

Một ngôn ngữ hình **Folio** (tờ giấy biên tập) cho toàn bộ web, rồi:

1. **Landing** cho khách chưa đăng nhập tại `/` — tờ báo ngắn, trục là luyện viết CEFR hàng ngày.
2. **Sơn lại chrome** login, drafts, practice, editor header cho cùng Folio. Canvas editor, highlight, rubric, API không đổi.

Người lạ hiểu đây là phòng thi viết; vẫn mở draft không cần tài khoản. Người có tài khoản vào practice sau khi đăng ký/đăng nhập (trừ khi đang viết dở).

### Ngoài phạm vi

Landing dài kiểu marketing, testimonial, screenshot sản phẩm, dashboard nhiều cột, icon set mới, dark mode, đổi scoring/band, sinh đề AI trên landing, guest ngồi practice (practice vẫn `RequireAuth`).

## 2. Theme Folio

Không thêm màu hay font. Giữ:

| Token | Giá trị |
|---|---|
| Giấy | `#faf6ef` (`paper`) |
| Mực | `#1f1c18` (`ink`) |
| Son | `#c14324` (`vermilion`) |
| Gạch | `#e2d8c7` (`rule`) |
| Display / body / mono | Fraunces / Newsreader / IBM Plex Mono |

Siết **cách dùng**:

| Mảnh | Quy tắc |
|---|---|
| **Masthead** | Lockup (¶ + *The Practice*) trái. Landing: thêm dòng mono `Vol. 1 · {ngày} · English writing` phải, ngày theo locale `en-GB` dạng `26 August 2026`. App: cụm link phải, không dòng ngày. Gạch `rule` dưới. Không thanh nav SaaS. |
| **Sheet** | Cột `max-w-3xl`, lề rộng, không card, không bóng. Landing, auth, drafts, practice cùng khổ. |
| **Hành động chính** | Khối mực (`bg-ink text-paper`, mono caps). Hover được flush vermilion như nút hiện tại. Không pill, không nền vermilion mặc định. |
| **Hành động phụ** | Chữ vermilion gạch dưới (hoặc ink-faint → vermilion). |
| **Con dấu** | `AppMark` chỉ nhận diện. `GradeStamp` / `BandStamp` chỉ điểm. |

Cấm: gradient, glass, lưới dashboard, icon generic.

Component dùng chung: `Masthead` (lockup + `children` bên phải). Nút mực không bắt buộc tách component nếu class thống nhất.

## 3. Routing

Session `status === loading` → màn “One moment…” (giữ như `RequireAuth`). Không render landing rồi mới editor.

| Ai | `/` | Editor trống |
|---|---|---|
| Chưa đăng nhập | `LandingPage` | `/write` — `EditorPage`, không auth |
| Đã đăng nhập | `EditorPage` (như hiện tại) | `/write` cũng `EditorPage` |

Route mới: `/write` → `EditorPage` (không `id`). `/doc/:id` không đổi.

| Hành động | Đích |
|---|---|
| Sit a paper | `/register` |
| Open a draft | `/write` |
| Auth “Back to the editor” | `/write` |
| Register/login, có stash draft | `/write` |
| Register/login, không stash | `/practice` (không còn mặc định `/docs`) |
| Sign out | `/` |
| Drafts “New draft” | `/` (đã login → editor) |
| Editor lockup, khách | `/` (về landing) |
| Editor lockup, đã login | `/practice` |

`*` vẫn `Navigate` về `/`. Practice và `/docs` vẫn `RequireAuth`.

Landing không gọi API.

## 4. Tờ landing

Một sheet Folio, cuộn ngắn trên mobile. Copy tiếng Anh, cùng giọng editorial hiện tại.

1. **Masthead** — lockup; dòng `Vol. 1 · {ngày} · English writing`.
2. **Headline** — display: *Sit the next paper.* Lede: daily CEFR writing, marked like an examiner.
3. **Đề mẫu** — tĩnh, không AI. B1 Email lấy khung từ `TASK_CATALOG` (`email`, 80–120 từ, 20 phút). Copy cố định:

   - Nhãn mono: `Paper · B1 · Email · 20 min · 80–120 words`
   - Instruction catalog: *Write an email to a specific person for a given purpose.*
   - Đề: *Your friend is visiting your city next month. Write to them. Tell them what you can do together and suggest a place to meet.*
   - `AppMark` đóng lệch góc khối đề (cùng nghiêng với stamp điểm).

4. **CTA** — khối mực **Sit a paper** → `/register`. Chữ vermilion **Open a draft** → `/write`. Dưới: *Already have an account? Sign in.* → `/login`.

Không hero screenshot, không section feature.

## 5. Sơn chrome sản phẩm

Không đổi bố cục phòng thi, Lexical, highlight, streak, band chart.

- **Auth:** masthead + sheet hẹp; nút mực giữ; link về `/write`.
- **Drafts / Practice:** `Masthead` thay cụm h1+`AppMark` rời; link phụ Folio; nút tạo đề vẫn mực, nhãn **Start writing** giữ nguyên.
- **Editor header:** lockup theo bảng routing; Write/Edit/Save giữ cụm mực.

## 6. Kiểm thử

Web (Vitest +/hoặc kiểm tay trên Vite):

- Chưa login: `/` ra landing (masthead, đề B1, hai CTA); không gọi `/practice` hay `/documents`.
- `/write` ra editor, không redirect login.
- Sit a paper → `/register`; Open a draft → `/write`; Sign in link → `/login`.
- Đã login: `/` ra editor, không landing.
- Restore session: không flash landing trước editor.
- Auth back-link không về landing.
- Login/register không stash → `/practice`.
- Drafts list, empty, start paper, empty practice: regression hành vi.

API không đổi; không e2e Nest bắt buộc cho bản này.

## 7. Thứ tự triển khai

1. `Masthead` + class hành động Folio.
2. Routing `/write` + `/` phân nhánh session.
3. `LandingPage`.
4. Auth redirect + back-link; editor lockup.
5. Masthead trên Drafts / Practice / Auth.
6. Test và rà tay landing → register → practice, và `/write`.
