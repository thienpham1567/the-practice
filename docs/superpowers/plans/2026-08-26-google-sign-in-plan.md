# Đăng nhập bằng Google — Implementation Plan

**Spec:** [../specs/2026-08-26-google-sign-in-design.md](../specs/2026-08-26-google-sign-in-design.md)
**Nguyên tắc:** mỗi bước nhỏ, kiểm chứng được, commit riêng. Logic liên kết tài khoản làm TDD — đó là chỗ có quyết định bảo mật. Toàn bộ e2e cũ phải xanh nguyên suốt quá trình.

## Điều kiện tiên quyết (người dùng làm)

Trước Milestone 4 cần có Client ID thật. Xem mục 8 của spec. Milestone 1–3 làm được ngay mà không cần nó (test dùng verifier giả).

## Milestone 1 — Schema và tương thích ngược

Bước nguy hiểm nhất trong plan này: `passwordHash` đang là bắt buộc, code hiện tại giả định nó luôn có.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 1.1 | Prisma: `passwordHash String?`, thêm `googleId String? @unique` + migration | `prisma migrate dev` chạy sạch; `migrate status` không còn pending; dữ liệu user cũ còn nguyên |
| 1.2 | Chặn `passwordHash` null trong `login()` — trả đúng thông báo chung `"Invalid email or password"` | Unit test: user có `passwordHash = null` + mật khẩu bất kỳ → 401, thông báo **giống hệt** trường hợp sai mật khẩu thường |
| 1.3 | Rà mọi chỗ khác đọc `passwordHash` sau khi đổi kiểu | `tsc --noEmit` sạch ở api; toàn bộ 23 e2e cũ xanh |

## Milestone 2 — Xác minh ID token

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 2.1 | Thêm `google-auth-library` vào api | `pnpm install` sạch, typecheck sạch |
| 2.2 | `GoogleTokenVerifier.verify(idToken)` → `{ googleId, email, emailVerified }`, dùng `OAuth2Client.verifyIdToken` với `audience = GOOGLE_CLIENT_ID` | Unit test với `OAuth2Client` mock: truyền đúng audience; token sai chữ ký/sai audience/hết hạn → ném `UnauthorizedException`, không rò chi tiết kỹ thuật ra client |
| 2.3 | Thiếu `GOOGLE_CLIENT_ID` → `verify()` ném lỗi rõ ràng thay vì gọi Google với audience rỗng | Unit test |

## Milestone 3 — Logic liên kết tài khoản và endpoint

Đây là phần có quyết định bảo mật — làm TDD, viết test cho cả 4 tình huống trước.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 3.1 | `AuthService.loginWithGoogle(identity)` — tình huống 1: chưa có user → tạo mới với `passwordHash = null` | Unit test: user mới có `googleId` đúng, `passwordHash` null, và nhận được cặp token như đăng nhập thường |
| 3.2 | Tình huống 2: đã có user trùng `googleId` → đăng nhập, không tạo trùng | Unit test: gọi hai lần chỉ sinh một user |
| 3.3 | Tình huống 3: trùng `email`, chưa có `googleId`, **`emailVerified === true`** → gắn `googleId` vào user sẵn có | Unit test: user cũ giữ nguyên `id` và `passwordHash`, chỉ thêm `googleId`; document/practice cũ vẫn thuộc về user đó |
| 3.4 | Tình huống 4: trùng `email` nhưng **`emailVerified === false`** → từ chối | Unit test: ném lỗi, **không** ghi gì vào DB. Đây là chốt chặn chiếm tài khoản — test phải khẳng định user cũ không bị đụng tới |
| 3.5 | `POST /auth/google` (body `{ credential }`) — verify rồi gọi `loginWithGoogle`, đặt refresh cookie **y hệt** register/login | E2E với verifier giả: nhận `accessToken` + `user`, cookie có `HttpOnly`; `credential` rỗng/sai định dạng → 400 |
| 3.6 | `GET /auth/providers` trả `{ google: { enabled, clientId } }`, không cần đăng nhập | E2E: có `GOOGLE_CLIENT_ID` → `enabled: true` kèm clientId; không có → `enabled: false` và **không** lộ `clientId` |
| 3.7 | Cập nhật `.env.example` và `render.yaml` (`GOOGLE_CLIENT_ID`, `sync: false`) | Có mặt trong cả hai file |

## Milestone 4 — Web

Cần Client ID thật từ đây trở đi.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 4.1 | `api/auth-providers.ts` + hook đọc `/auth/providers`, cache toàn phiên | Typecheck; gọi được qua proxy |
| 4.2 | Tải script GIS **động, chỉ khi `enabled`** — không nhúng sẵn vào `index.html` để người không dùng Google không phải tải script bên thứ ba | Tắt cờ → tab Network không có request nào tới `accounts.google.com` |
| 4.3 | Dựng nút bằng `google.accounts.id.renderButton`, callback POST `/auth/google` → `setSession` → `navigate(afterAuthPath())` | Chạy tay: đăng nhập Google lần đầu tạo được tài khoản, vào thẳng app |
| 4.4 | Đặt nút dưới form, ngăn bằng đường kẻ + chữ "or" | Kiểm tra bằng mắt trên cả `/login` và `/register` |
| 4.5 | Hiện lỗi từ server (ví dụ tình huống 4) ở cùng chỗ với lỗi form hiện tại | Chạy tay hoặc giả lỗi: thông báo hiện đúng chỗ, không phải alert |

## Milestone 5 — Kiểm chứng thật

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 5.1 | Đăng nhập Google bằng tài khoản chưa từng dùng → tài khoản mới | Kiểm tra trong Postgres: `googleId` có, `passwordHash` null |
| 5.2 | Đăng xuất, đăng nhập Google lại | Vẫn đúng user cũ, không tạo user thứ hai |
| 5.3 | Liên kết: tạo tài khoản email/password, rồi đăng nhập Google **cùng email** | Vẫn một user; drafts/practice cũ còn nguyên |
| 5.4 | F5 sau khi đăng nhập Google | Phiên sống sót qua refresh cookie, đúng như luồng email/password |
| 5.5 | Chạy toàn bộ test + lint | analysis, practice, web, api unit, e2e đều xanh; `eslint .` sạch |

## Rủi ro đã biết

- **`passwordHash` đổi thành nullable** động tới code auth đang chạy tốt. Milestone 1 cố ý tách riêng và chạy full e2e trước khi làm tiếp — không gộp chung với việc thêm Google.
- **Nút Google lệch tông Editorial.** Không tránh được (brand guideline bắt buộc). Xử lý bằng bố cục: tách khu vực riêng, có đường kẻ ngăn.
- **Origin chưa khai báo** là lỗi hay gặp nhất khi tích hợp GIS: nút im lặng không hoạt động, lỗi chỉ hiện trong console. Kiểm tra `localhost:5173` và domain production đã có trong Authorized JavaScript origins trước khi debug chỗ khác.
- **Test không chạm Google thật.** Mọi test dùng verifier giả; chỉ Milestone 5 mới là kiểm chứng thật, chạy tay.

## Ghi chú chung

- Mỗi bước xong: chạy test liên quan, commit riêng.
- Sau mỗi milestone: `pnpm test` + e2e đầy đủ, lint sạch, verify trên trình duyệt nếu có phần UI.
- Không commit Client ID vào git — chỉ vào `.env` (đã ignore) và biến môi trường trên Render.
