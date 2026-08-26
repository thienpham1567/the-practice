# Đăng nhập bằng Google — Implementation Plan

**Spec:** [../specs/2026-08-26-google-sign-in-design.md](../specs/2026-08-26-google-sign-in-design.md)

**Nguyên tắc:** mỗi bước nhỏ, kiểm chứng được, commit riêng. Logic liên kết tài khoản và nonce làm TDD — đó là chỗ có quyết định bảo mật. Toàn bộ e2e cũ phải xanh nguyên suốt quá trình.

## Điều kiện tiên quyết (người dùng làm)

Cần Client ID thật từ **Milestone 5** trở đi. Xem mục 12 của spec. Milestone 1–4 làm được ngay mà không cần nó — test dùng verifier giả.

---

## Milestone 1 — Schema và tương thích ngược

Bước nguy hiểm nhất: `passwordHash` đang bắt buộc, code hiện tại giả định nó luôn có. Làm và verify xong hẳn milestone này rồi mới đụng tới Google.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 1.1 | Prisma: `passwordHash String?`, thêm `googleId String? @unique`, thêm model `AuthNonce` + migration | `prisma migrate dev` sạch; `migrate status` không còn pending; user cũ trong DB còn nguyên |
| 1.2 | Chặn `passwordHash === null` trong `login()`, trả **đúng** thông báo chung `"Invalid email or password"` | Unit test: user Google + mật khẩu bất kỳ → 401, thông báo **giống hệt byte-for-byte** với trường hợp sai mật khẩu |
| 1.3 | Chạy bcrypt giả trên nhánh null để san bằng thời gian phản hồi | Unit test đo: hai nhánh không lệch quá một bậc độ lớn. Không có bước này thì đo thời gian là dò được tài khoản nào dùng Google |
| 1.4 | Rà mọi chỗ khác đọc `passwordHash` sau khi đổi kiểu | `tsc --noEmit` sạch ở api; **toàn bộ e2e cũ xanh** |

---

## Milestone 2 — Nonce

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 2.1 | `NonceService.issue()` — sinh 32 byte ngẫu nhiên, lưu **hash** kèm hạn 5 phút, trả chuỗi gốc | Unit test: DB không chứa chuỗi gốc; hai lần gọi ra hai giá trị khác nhau |
| 2.2 | `NonceService.consume(nonce)` — kiểm tồn tại + chưa dùng + chưa hết hạn, đánh dấu đã dùng **trong cùng transaction** | Unit test: dùng lần hai → hỏng; nonce hết hạn → hỏng; nonce không tồn tại → hỏng |
| 2.3 | Dọn bản ghi hết hạn ngay trong `issue()` | Unit test: bản ghi quá hạn biến mất sau lần `issue()` kế tiếp |
| 2.4 | `GET /auth/google/nonce` trả `{ nonce }`, nằm dưới throttle sẵn có của controller | E2E: gọi được khi chưa đăng nhập; gọi quá 10 lần/phút → 429 |

---

## Milestone 3 — Xác minh ID token

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 3.1 | Thêm `google-auth-library` vào api | `pnpm install` sạch, typecheck sạch |
| 3.2 | `GoogleTokenVerifier.verify()` dùng `OAuth2Client.verifyIdToken` với `audience = GOOGLE_CLIENT_ID`; trả `{ googleId, email, emailVerified, nonce }` | Unit test với `OAuth2Client` mock: truyền đúng audience; email chuẩn hoá lowercase/trim giống `register()` |
| 3.3 | Ánh xạ lỗi: chữ ký sai / sai `aud` / hết hạn → `UnauthorizedException` với thông báo chung, chi tiết chỉ vào log | Unit test cho từng loại lỗi: client **không** nhận được thông báo gốc của thư viện |
| 3.4 | Thiếu `GOOGLE_CLIENT_ID` → ném 503, không gọi Google với audience rỗng | Unit test |

---

## Milestone 4 — Liên kết tài khoản và endpoint

Phần có quyết định bảo mật — viết test cho cả bốn nhánh **trước** khi viết code.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 4.1 | **Chốt chặn `email_verified`**: false → từ chối ngay, trước mọi truy vấn DB | Unit test: **không** ghi gì vào DB, kể cả khi email chưa ai dùng. Đây là chốt chặn chiếm tài khoản |
| 4.2 | Tình huống 1 — chưa có user → tạo mới, `passwordHash = null` | Unit test: `googleId` đúng, `passwordHash` null, nhận cặp token như đăng nhập thường |
| 4.3 | Tình huống 2 — đã có `googleId` → đăng nhập, không tạo trùng | Unit test: gọi hai lần chỉ sinh một user |
| 4.4 | Tình huống 3 — trùng `email`, chưa có `googleId` → gắn `googleId` vào user sẵn có | Unit test: user cũ **giữ nguyên `id` và `passwordHash`**; documents/practice cũ vẫn thuộc về user đó |
| 4.5 | Chạy đua tạo tài khoản: bắt lỗi Prisma **P2002**, đọc lại rồi đăng nhập thay vì trả 500 | Unit test: giả P2002 ở lần create đầu → vẫn trả về phiên hợp lệ |
| 4.6 | `POST /auth/google` — DTO validate `credential` bằng `@IsJWT()` + giới hạn độ dài; verify → consume nonce → `loginWithGoogle` → đặt refresh cookie **y hệt** register/login | E2E với verifier giả: nhận `accessToken` + `user`, cookie có `HttpOnly`; `credential` rỗng/không phải JWT → 400 |
| 4.7 | Nonce sai/đã dùng/hết hạn → 401 `"Sign-in session expired. Please try again."` | E2E: gửi lại đúng credential lần hai → 401 (chống phát lại) |
| 4.8 | `GET /auth/providers` trả `{ google: { enabled, clientId } }`, không cần đăng nhập | E2E: có biến → `enabled: true` kèm clientId; không có → `enabled: false` và **không lộ `clientId`** |
| 4.9 | Log có cấu trúc: đăng nhập thành công, thất bại kèm lý do, tạo mới, **liên kết tài khoản** | Đọc log bằng mắt: không có `credential`, nonce thô, hay token nào lọt vào |
| 4.10 | Cập nhật `.env.example` và `render.yaml` (`GOOGLE_CLIENT_ID`, `sync: false`) | Có mặt trong cả hai file |

---

## Milestone 5 — Web

Cần Client ID thật từ đây.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 5.1 | `api/auth-providers.ts` + query đọc `/auth/providers`, cache toàn phiên | Typecheck; gọi được qua proxy |
| 5.2 | `load-gsi.ts` — tải script động, **một promise ở tầng module** để nhiều component chỉ tải một lần; tải hỏng → reject rõ ràng | Unit test: gọi hai lần chỉ chèn một thẻ `<script>`; giả lỗi tải → reject, không ném ra ngoài |
| 5.3 | Thêm `@types/google.accounts`, không dùng `any` cho `window.google` | `tsc --noEmit` sạch, không có `@ts-ignore` nào |
| 5.4 | Hook `useGoogleSignIn`: providers → script → nonce → `initialize` → `renderButton`; trả `{ containerRef, status, error }` | Test hook với script giả: `initialize` gọi **đúng một lần** cho mỗi lần mount |
| 5.5 | Callback: POST `/auth/google` → `setSession` → `navigate(afterAuthPath())`; khoá double-submit; `AbortController` huỷ khi unmount | Chạy tay: bấm nhanh hai lần chỉ gửi một request; rời trang giữa chừng không cảnh báo setState |
| 5.6 | Gắn vào `AuthPage`: nút dưới form, ngăn bằng đường kẻ + "or" (`aria-hidden`) | Kiểm tra bằng mắt trên cả `/login` và `/register` |
| 5.7 | Lỗi từ server hiện trong vùng `role="alert"` sẵn có của form | Giả lỗi: thông báo hiện đúng chỗ, screen reader đọc được, không dùng `alert()` |
| 5.8 | Suy giảm êm: cờ tắt / script hỏng → ẩn nút, form thường vẫn chạy | Chặn `accounts.google.com` trong devtools → trang vẫn dùng được, không màn hình trắng |

---

## Milestone 6 — Kiểm chứng thật

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 6.1 | Đăng nhập Google bằng tài khoản chưa từng dùng | Postgres: user mới có `googleId`, `passwordHash` null |
| 6.2 | Đăng xuất rồi đăng nhập Google lại | Vẫn đúng user cũ, không sinh user thứ hai |
| 6.3 | Liên kết: tạo tài khoản email/password, rồi đăng nhập Google **cùng email** | Vẫn một user; drafts và practice cũ còn nguyên |
| 6.4 | Đăng nhập bằng mật khẩu vào tài khoản chỉ có Google | Báo lỗi chung, không tiết lộ tài khoản dùng Google |
| 6.5 | F5 sau khi đăng nhập Google | Phiên sống sót qua refresh cookie, y như luồng email/password |
| 6.6 | Chạy toàn bộ test + lint | analysis, practice, web, api unit, e2e đều xanh; `eslint .` sạch |

---

## Rủi ro đã biết

- **`passwordHash` thành nullable** động vào code auth đang chạy tốt. Milestone 1 cố ý tách riêng, chạy full e2e trước khi làm tiếp.
- **Origin chưa khai báo** là lỗi hay gặp nhất khi tích hợp GIS: nút im lặng không hoạt động, lỗi chỉ hiện trong console. Kiểm `localhost:5173` và domain production trong Authorized JavaScript origins **trước** khi debug chỗ khác.
- **Trình duyệt chặn cookie bên thứ ba** có thể ảnh hưởng GIS. Dùng `renderButton` (không phải One Tap) nên rủi ro thấp; nếu gặp, bước 5.8 đã đảm bảo app vẫn dùng được.
- **FedCM**: Google đang chuyển One Tap sang FedCM. Ta không dùng One Tap nên chưa bị ảnh hưởng — ghi lại để biết nếu sau này thêm.
- **Nút Google lệch tông Editorial.** Không tránh được (brand guideline). Xử lý bằng bố cục, không bằng cách sửa nút.
- **Test không chạm Google thật.** Mọi test dùng verifier giả; chỉ Milestone 6 là kiểm chứng thật, chạy tay.

## Ghi chú chung

- Mỗi bước xong: chạy test liên quan, commit riêng.
- Sau mỗi milestone: `pnpm test` + e2e đầy đủ, lint sạch, verify trên trình duyệt nếu có phần UI.
- Không commit Client ID vào git — chỉ vào `.env` (đã ignore) và biến môi trường trên Render.
