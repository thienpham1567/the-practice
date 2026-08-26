# Đăng nhập bằng Google: Design

**Ngày:** 2026-08-26
**Trạng thái:** Chờ duyệt
**Xây trên:** auth email/password hiện có (JWT access 15 phút + refresh token xoay vòng)

## 1. Mục tiêu

Cho phép tạo tài khoản và đăng nhập bằng Google, song song với email/password đang có. Sau khi xác thực xong, phiên làm việc đi tiếp bằng **đúng cơ chế hiện tại** — access token 15 phút + refresh cookie httpOnly. Google chỉ dùng để xác định *bạn là ai*, không thay thế hệ thống phiên.

### Ngoài phạm vi

Đăng nhập bằng provider khác (GitHub, Apple), truy cập Google API thay mặt người dùng (Drive, Gmail), One Tap tự động, gỡ liên kết Google khỏi tài khoản, đặt mật khẩu cho tài khoản đã tạo bằng Google.

## 2. Chọn luồng: ID token, không phải redirect

Hai lựa chọn thực tế:

| | ID token (Google Identity Services) | Authorization Code + redirect |
|---|---|---|
| Luồng | Nút GIS trả `credential` (ID token) ngay trong trang → web POST lên api → api xác minh | Chuyển hướng sang Google → callback về api → đổi `code` lấy token |
| Cần thêm | Không | Route callback, tham số `state` chống CSRF, bước đổi code |
| Client secret | **Không cần** | Cần |
| Kiểu dáng nút | Google quy định | Tự do hơn (vẫn phải theo brand guideline) |

**Chọn ID token.** Chúng ta chỉ cần *danh tính*, không cần gọi API của Google thay mặt người dùng — nên không cần access token, refresh token, hay client secret của Google. Bỏ được cả route callback lẫn xử lý `state`, tức là bỏ được một mảng logic bảo mật dễ làm sai.

Đánh đổi: nút phải theo mẫu của Google, sẽ lệch tông Editorial của app. Nhưng brand guideline của Google **bắt buộc** logo và cách viết chữ dù đi luồng nào, nên đánh đổi này gần như không tránh được.

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
```

**`passwordHash` phải nullable**: tài khoản tạo bằng Google không có mật khẩu. Đây là thay đổi phá vỡ giả định của code hiện tại — xem mục 5.

**Tại sao `googleId` nằm thẳng trên `User`, không tách bảng `Account`?** Theo đúng nguyên tắc đã dùng xuyên suốt dự án: *một adapter chỉ là seam giả định, hai mới là seam thật*. Hiện chỉ có Google. Khi nào thêm provider thứ hai (GitHub, Apple) thì mới tách `Account(provider, providerAccountId)` — lúc đó refactor rẻ vì mọi thứ còn nằm gọn một chỗ.

**Không lưu `name`/`avatarUrl`** từ hồ sơ Google: hiện không màn hình nào hiển thị chúng. Thêm khi có chỗ dùng thật.

## 4. Chính sách liên kết tài khoản — quyết định quan trọng nhất

Bốn tình huống khi nhận ID token hợp lệ:

| # | Trạng thái DB | Xử lý |
|---|---|---|
| 1 | Chưa có user nào với `googleId` hay `email` này | Tạo user mới, `passwordHash = null` |
| 2 | Đã có user với đúng `googleId` này | Đăng nhập bình thường |
| 3 | Có user trùng `email` nhưng chưa có `googleId` | **Chỉ liên kết khi `email_verified === true`** |
| 4 | `email_verified === false` và email đã tồn tại | Từ chối, báo lỗi rõ ràng |

### Vì sao `email_verified` là bắt buộc

Nếu liên kết mà không kiểm tra, đây là lỗ hổng chiếm tài khoản thật sự: kẻ tấn công tạo một tài khoản Google Workspace tự quản lý domain, khai email là `nan-nhan@example.com` **chưa xác minh**, đăng nhập vào app của chúng ta, và được liên kết thẳng vào tài khoản email/password có sẵn của nạn nhân.

Google có trả trường `email_verified` trong ID token đúng để phòng chuyện này. **Không bao giờ liên kết theo email khi trường này là false.**

## 5. Trường hợp biên phải xử lý

**Đăng nhập bằng mật khẩu vào tài khoản chỉ có Google.** Code hiện tại gọi `bcrypt.compare(password, user.passwordHash)` — với `passwordHash = null` sẽ ném lỗi hoặc trả false không xác định. Phải chặn tường minh: `passwordHash` null thì trả về **đúng thông báo chung** `"Invalid email or password"`.

Có đánh đổi ở đây: báo "tài khoản này dùng Google" thì thân thiện hơn nhiều, nhưng lại tiết lộ email nào đã đăng ký. Code hiện tại **đã cố ý chọn** không tiết lộ (có comment giải thích ngay tại `login()`), nên giữ nhất quán. Ghi nhận đây là chỗ có thể đổi ý sau nếu ưu tiên UX.

**Đăng ký email/password bằng email đã dùng Google.** `email` là unique nên sẽ trả 409 như hiện tại — chấp nhận được, không cần xử lý riêng.

## 6. Feature flag và biến môi trường

Mirror đúng mẫu `/ai/status` đã có: thiếu cấu hình thì tính năng tự ẩn, không lỗi.

```
GET /auth/providers → { "google": { "enabled": true, "clientId": "..." } }
```

**Chỉ một biến môi trường: `GOOGLE_CLIENT_ID`.** Web *cũng* cần client ID để dựng nút, nhưng thay vì thêm `VITE_GOOGLE_CLIENT_ID` (hai biến phải khớp nhau, chắc chắn có ngày lệch), web lấy luôn từ `/auth/providers`. Client ID vốn công khai — nó nằm sẵn trong mã trang khi nút render — nên trả về qua API là an toàn.

Không set `GOOGLE_CLIENT_ID` → `enabled: false` → web không tải script GIS, không hiện nút.

## 7. Kiểm thử và ranh giới module

**`GoogleTokenVerifier` là một service riêng, một phương thức:**

```ts
verify(idToken: string): Promise<{ googleId: string; email: string; emailVerified: boolean }>
```

Bọc `google-auth-library` (thư viện chính thức — tự lo tải JWKS, kiểm chữ ký, `iss`/`aud`/`exp`; **không tự viết lại phần này**). Tách ra vì test là consumer thật thứ hai: gọi Google thật trong test là vừa chậm vừa không tất định.

`AuthService` nhận verifier qua DI và **không biết gì về Google** ngoài hình dạng dữ liệu trả về — toàn bộ logic liên kết tài khoản (mục 4) test được bằng verifier giả.

## 8. Thiết lập phía Google Cloud Console

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
