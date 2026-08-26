# Đăng nhập bằng Google: Design

**Ngày:** 2026-08-26
**Trạng thái:** Chờ duyệt
**Xây trên:** auth email/password hiện có (JWT access 15 phút + refresh token xoay vòng)

## 1. Mục tiêu

Cho phép tạo tài khoản và đăng nhập bằng Google, song song với email/password đang có. Sau khi xác thực xong, phiên làm việc đi tiếp bằng **đúng cơ chế hiện tại** — access token 15 phút + refresh cookie httpOnly. Google chỉ dùng để xác định *bạn là ai*, không thay thế hệ thống phiên.

### Ngoài phạm vi

Provider khác (GitHub, Apple), truy cập Google API thay mặt người dùng (Drive, Gmail), One Tap tự động, gỡ liên kết Google, đặt mật khẩu cho tài khoản đã tạo bằng Google, giới hạn theo hosted domain (Workspace).

## 2. Chọn luồng: ID token, không phải redirect

| | ID token (Google Identity Services) | Authorization Code + redirect |
|---|---|---|
| Luồng | Nút GIS trả `credential` (ID token) ngay trong trang → web POST lên api → api xác minh | Chuyển hướng sang Google → callback về api → đổi `code` lấy token |
| Cần thêm | Không | Route callback, tham số `state` chống CSRF, bước đổi code |
| Client secret | **Không cần** | Cần |
| Kiểu dáng nút | Google quy định | Tự do hơn (vẫn phải theo brand guideline) |

**Chọn ID token.** Chúng ta chỉ cần *danh tính*, không cần gọi API của Google thay mặt người dùng — nên không cần access token, refresh token, hay client secret của Google. Bỏ được cả route callback lẫn xử lý `state`, tức là bỏ được một mảng logic bảo mật dễ làm sai.

Đánh đổi: nút phải theo mẫu của Google, sẽ lệch tông Editorial của app. Nhưng brand guideline của Google **bắt buộc** logo và cách viết chữ dù đi luồng nào, nên gần như không tránh được.

## 3. Thay đổi schema

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String?  // ← từ bắt buộc thành tuỳ chọn
  googleId     String?  @unique  // ← mới, là `sub` trong ID token
  createdAt    DateTime @default(now())
  ...
}

/// Nonce dùng một lần cho luồng Google, chống phát lại ID token đã bị bắt.
/// Lưu hash chứ không lưu chuỗi gốc — cùng lý do với RefreshToken.
model AuthNonce {
  id        String    @id @default(cuid())
  nonceHash String    @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  @@index([expiresAt])
}
```

**`passwordHash` phải nullable**: tài khoản tạo bằng Google không có mật khẩu. Đây là thay đổi phá vỡ giả định của code hiện tại — xem mục 6.

**Tại sao `googleId` nằm thẳng trên `User`, không tách bảng `Account`?** Theo nguyên tắc đã dùng xuyên suốt dự án: *một adapter chỉ là seam giả định, hai mới là seam thật*. Hiện chỉ có Google. Khi thêm provider thứ hai mới tách `Account(provider, providerAccountId)` — lúc đó refactor rẻ vì mọi thứ còn nằm gọn một chỗ.

**Không lưu `name`/`avatarUrl`** từ hồ sơ Google: hiện không màn hình nào hiển thị chúng. Thêm khi có chỗ dùng thật.

## 4. Nonce — chống phát lại ID token

ID token của Google sống tới một giờ. Nếu bị bắt được (log rò rỉ, extension độc hại, proxy doanh nghiệp), kẻ tấn công gửi lại đúng token đó cho API của chúng ta là đăng nhập được.

Nonce khoá cửa đó:

1. Web gọi `GET /auth/google/nonce` → server sinh chuỗi ngẫu nhiên, **lưu hash** kèm hạn 5 phút, trả chuỗi gốc.
2. Web truyền nonce vào `google.accounts.id.initialize({ nonce })`.
3. Google nhúng nonce vào ID token.
4. Web gửi `credential` lên `POST /auth/google`.
5. Server xác minh token, rồi đối chiếu claim `nonce` với bản ghi **chưa dùng, chưa hết hạn**, và **đánh dấu đã dùng ngay trong cùng transaction**.

Nonce do **server** sinh, không phải client. Client tự sinh thì kẻ tấn công bắt được token cũng bắt được nonce đi kèm — vô nghĩa.

Dọn bản ghi hết hạn ngay khi sinh nonce mới, không cần cron riêng.

## 5. Chính sách liên kết tài khoản — quyết định quan trọng nhất

### Điều kiện tiên quyết: `email_verified` phải là `true`

Kiểm tra **trước mọi thứ khác**, không phụ thuộc email đã tồn tại hay chưa.

Vì sao: nếu liên kết theo email mà không kiểm tra, đây là lỗ hổng chiếm tài khoản thật sự — kẻ tấn công tạo tài khoản Google Workspace trên domain do chính hắn quản lý, khai email là `nan-nhan@example.com` **chưa xác minh**, đăng nhập vào app của chúng ta, và được liên kết thẳng vào tài khoản email/password có sẵn của nạn nhân.

Đặt điều kiện này lên trước cũng làm luật đơn giản hơn: không có nhánh "email chưa xác minh nhưng chưa ai dùng thì cho qua". Một luật, không ngoại lệ.

Thông báo lỗi nói về **tài khoản Google của họ**, không nói về database của ta: *"Your Google account's email is not verified."* — không tiết lộ email nào đã đăng ký ở đây.

### Ba tình huống còn lại

| # | Trạng thái DB | Xử lý |
|---|---|---|
| 1 | Chưa có user nào với `googleId` hay `email` này | Tạo user mới, `passwordHash = null` |
| 2 | Đã có user với đúng `googleId` này | Đăng nhập bình thường |
| 3 | Có user trùng `email` nhưng chưa có `googleId` | Gắn `googleId` vào user sẵn có, giữ nguyên `id` và `passwordHash` |

### Chạy đua khi tạo tài khoản

Hai request đồng thời cho cùng một người dùng mới: cả hai cùng đọc "chưa có user", cả hai cùng tạo. Ràng buộc unique trên `googleId` chặn được, nhưng phải **bắt lỗi P2002 của Prisma và đọc lại rồi đăng nhập**, thay vì trả 500. Đây là optimistic concurrency, không phải khoá bi quan — rẻ hơn và đủ dùng.

## 6. Trường hợp biên phải xử lý

**Đăng nhập bằng mật khẩu vào tài khoản chỉ có Google.** Code hiện tại gọi `bcrypt.compare(password, user.passwordHash)` — với `passwordHash = null` sẽ ném lỗi hoặc trả kết quả không xác định. Phải chặn tường minh và trả **đúng thông báo chung** `"Invalid email or password"`.

Đánh đổi: báo "tài khoản này dùng Google" thân thiện hơn nhiều, nhưng lại tiết lộ email nào đã đăng ký. Code hiện tại **đã cố ý chọn** không tiết lộ (có comment giải thích ngay tại `login()`), nên giữ nhất quán. Ghi nhận đây là chỗ có thể đổi ý sau nếu ưu tiên UX.

Nhưng vẫn phải giữ **thời gian phản hồi tương đương**: nhánh `passwordHash === null` trả về ngay lập tức, trong khi nhánh sai mật khẩu tốn ~100ms cho bcrypt — chênh lệch đó đủ để dò xem tài khoản nào dùng Google. Chạy một phép bcrypt giả trên nhánh null để san bằng.

**Đăng ký email/password bằng email đã dùng Google.** `email` unique nên trả 409 như hiện tại — chấp nhận được.

## 7. Bảng mã lỗi

| Tình huống | Mã | Thông báo |
|---|---|---|
| `credential` thiếu/sai định dạng JWT | 400 | Lỗi validation của DTO |
| Chữ ký sai, sai `aud`, hết hạn | 401 | `"Invalid Google credential"` — không kèm chi tiết kỹ thuật |
| Nonce sai, đã dùng, hoặc hết hạn | 401 | `"Sign-in session expired. Please try again."` |
| `email_verified === false` | 401 | `"Your Google account's email is not verified."` |
| Chưa cấu hình `GOOGLE_CLIENT_ID` | 503 | `"Google sign-in is not configured"` |
| Quá 10 request/phút/IP | 429 | Của throttler |

Nguyên tắc: chi tiết kỹ thuật vào log, ra client chỉ những gì người dùng làm được gì đó với nó.

## 8. Ghi log sự kiện xác thực

Log có cấu trúc cho: đăng nhập Google thành công, thất bại (kèm lý do), tạo tài khoản mới, liên kết vào tài khoản sẵn có, nonce hỏng.

**Không bao giờ log**: `credential`, nonce thô, refresh token, `passwordHash`. Chỉ log `userId`, `email` (đã có sẵn trong DB), và loại sự kiện.

Việc liên kết tài khoản đặc biệt đáng log — đó là lúc quyền sở hữu dữ liệu thay đổi.

## 9. Feature flag và biến môi trường

Mirror đúng mẫu `/ai/status` đã có: thiếu cấu hình thì tính năng tự ẩn, không lỗi.

```
GET /auth/providers → { "google": { "enabled": true, "clientId": "..." } }
```

**Chỉ một biến môi trường: `GOOGLE_CLIENT_ID`.** Web *cũng* cần client ID để dựng nút, nhưng thay vì thêm `VITE_GOOGLE_CLIENT_ID` (hai biến phải khớp nhau, chắc chắn có ngày lệch), web lấy luôn từ `/auth/providers`. Client ID vốn công khai — nó nằm sẵn trong mã trang khi nút render — nên trả về qua API là an toàn.

Không set → `enabled: false`, **không trả `clientId`**, web không tải script GIS.

## 10. Ranh giới module phía backend

**`GoogleTokenVerifier` — một service, một phương thức:**

```ts
verify(idToken: string): Promise<{ googleId: string; email: string; emailVerified: boolean; nonce?: string }>
```

Bọc `google-auth-library` (thư viện chính thức — tự lo tải và cache JWKS, kiểm chữ ký, `iss`/`aud`/`exp`, độ lệch đồng hồ; **không tự viết lại phần này**). Tách ra vì test là consumer thật thứ hai: gọi Google thật trong test là vừa chậm vừa không tất định.

**`AuthService` không biết gì về Google** ngoài hình dạng dữ liệu verifier trả về. Toàn bộ logic liên kết tài khoản test được bằng verifier giả.

**`NonceService`** giữ việc sinh/kiểm/đánh dấu-đã-dùng — tách khỏi `AuthService` vì đó là cơ chế độc lập, và để test riêng phần hết hạn/dùng lại.

## 11. Mẫu triển khai phía frontend

**Tải script GIS động, chỉ khi bật.** Không nhúng sẵn vào `index.html` — người không dùng Google không phải tải script bên thứ ba. Dùng một promise ở tầng module để dù nhiều component cùng gọi thì script chỉ tải một lần; xử lý cả trường hợp tải hỏng (mạng chặn, adblock) bằng cách ẩn nút và giữ form email/password hoạt động bình thường.

**Tách hook `useGoogleSignIn`** lo toàn bộ vòng đời: đọc `/auth/providers` → tải script → xin nonce → `initialize` → `renderButton`. Component `AuthPage` chỉ nhận về `{ containerRef, status, error }`.

**Chống double-submit**: khoá nút và bỏ qua callback trùng khi đang có request bay.

**Huỷ request khi unmount** bằng `AbortController` — tránh `setState` trên component đã gỡ.

**An toàn kiểu cho `window.google`**: dùng `@types/google.accounts`, không tự khai `any`.

**Không khởi tạo lại GIS mỗi lần render** — `initialize` và `renderButton` chạy đúng một lần cho mỗi lần mount.

**Khả năng tiếp cận**: lỗi hiện trong vùng `role="alert"` sẵn có của form; đường kẻ ngăn và chữ "or" là trang trí nên `aria-hidden`; trạng thái đang xử lý phải đọc được bằng screen reader, không chỉ đổi màu.

**Suy giảm êm**: script hỏng, cờ tắt, hay trình duyệt chặn — form email/password vẫn dùng được như thường, không màn hình trắng.

## 12. Thiết lập phía Google Cloud Console

Việc này người dùng phải tự làm, không tự động hoá được:

1. Tạo project tại [console.cloud.google.com](https://console.cloud.google.com).
2. **APIs & Services → OAuth consent screen**: chọn External, điền tên app, email hỗ trợ. Scope chỉ cần `email` và `profile` (mặc định).
3. **Credentials → Create OAuth client ID → Web application**.
4. **Authorized JavaScript origins** — phải có cả hai:
   - `http://localhost:5173` (dev)
   - `https://the-practice.onrender.com` (production, theo `render.yaml`)
5. **Authorized redirect URIs**: để trống — luồng ID token không dùng redirect.
6. Copy Client ID vào `apps/api/.env` và vào biến môi trường của service `the-practice-api` trên Render.

Client secret sinh ra ở bước 3 **không dùng đến** trong luồng này.
