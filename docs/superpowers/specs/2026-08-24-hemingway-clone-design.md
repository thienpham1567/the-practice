# Writing Helper — Hemingway Editor Clone: Design

**Ngày:** 2026-08-24
**Trạng thái:** Đã duyệt qua brainstorming, chờ implementation plan

## 1. Mục tiêu

Web app clone Hemingway Editor (hemingwayapp.com): người dùng gõ/dán văn bản **tiếng Anh**, thấy highlight realtime 5 loại vấn đề văn phong, kèm thống kê readability. Có tài khoản người dùng, lưu document trên server, và tính năng AI rewrite qua OpenRouter (tương đương Hemingway Plus).

### Ngoài phạm vi bản này

Export file, chia sẻ document, hỗ trợ tiếng Việt, mobile app, deploy production. Sẽ bàn riêng khi cần.

## 2. Kiến trúc tổng thể

Monorepo pnpm workspaces, TypeScript toàn bộ, chạy trên Node:

```
writing-helper/
├── packages/
│   └── analysis/          # Logic phân tích thuần TS, zero UI dependency
│       └── src/
│           ├── tokenize.ts        # Tách câu, từ, đếm âm tiết
│           ├── rules/             # Mỗi rule 1 file
│           ├── readability.ts     # Automated Readability Index
│           └── analyze.ts         # API chính: analyze(text) → AnalysisResult
├── apps/
│   ├── web/               # React 18 + Vite + Lexical editor
│   └── api/               # NestJS 10 + Prisma + PostgreSQL 16
└── docker-compose.yml     # PostgreSQL cho dev
```

**Luồng dữ liệu:**

- **Khi gõ:** editor → debounce ~150ms → `analyze(text)` chạy trên trình duyệt → danh sách ranges (offset + loại) → Lexical áp highlight → sidebar cập nhật thống kê.
- **Khi lưu:** web gửi title + content lên NestJS API (JWT auth) → PostgreSQL. Server không chạy phân tích văn bản.
- **AI rewrite:** client gọi `POST /ai/rewrite` → NestJS proxy sang OpenRouter (key ở server).

**Ranh giới trách nhiệm:** `analysis` không biết React/Lexical (nhận string, trả ranges); `web` không biết DB; `api` không biết phân tích văn bản; AI rewrite là module riêng ở cả hai phía.

## 3. Analysis engine (`packages/analysis`)

### API chính

```ts
analyze(text: string): AnalysisResult

interface AnalysisResult {
  highlights: Highlight[];      // { start, end, type, suggestion? } — offset ký tự trên text gốc
  counts: { veryHardSentences; hardSentences; adverbs; passives; qualifiers; complexPhrases };
  goals: { adverbs; passives };  // ngưỡng chấp nhận được theo độ dài văn bản
  stats: { words; sentences; paragraphs; characters; letters; readingTimeSeconds };
  grade: number;                // readability grade level
  gradeLabel: string;           // "Good" | "OK" | "Poor" theo ngưỡng Hemingway
}
```

### 5 rule — cùng interface `Rule = (sentences, text) => Highlight[]`

| # | Rule | Màu | Điều kiện |
|---|------|-----|-----------|
| 1 | Hard sentence | Vàng | Câu ≥ 14 từ và grade riêng của câu ở mức 10–13 |
| 2 | Very hard sentence | Đỏ | Câu ≥ 14 từ và grade ≥ 14. Câu < 14 từ không bao giờ bị đánh dấu |
| 3 | Passive voice | Xanh lá | To-be verb (`is/are/was/were/be/been/being`) + past participle (từ điển participle bất quy tắc + đuôi `-ed`), bỏ qua adjective phổ biến |
| 4 | Adverb | Xanh dương | Từ đuôi `-ly` trừ whitelist (`family, only, supply...`). Ngưỡng mục tiêu ~1 adverb/100 từ |
| 5 | Complex phrase / qualifier | Tím | Từ điển tĩnh cụm phức tạp kèm gợi ý thay thế (`utilize → use`) + danh sách qualifier (`I think, perhaps, maybe...`). Bắt đầu ở 192 mục, mở rộng dần — thêm mục là thêm một dòng data, không sửa rule. Qualifier cố ý không chứa từ `-ly` để không trùng với rule adverb |

### Grade level

**Automated Readability Index** (công thức Hemingway thật dùng, dựa trên ký tự/từ/câu), làm tròn, hiển thị "Grade 8".

### Tokenizer

Tách câu có xử lý viết tắt (`Mr., e.g., U.S.`), số thập phân, tên viết tắt một chữ cái (`J. R. R. Tolkien`) và chuỗi dấu kết thúc (`?!`, `...`); tách từ giữ nguyên dấu nháy và gạch nối.

Viết tắt chia hai nhóm: nhóm chỉ tính khi **viết hoa** (`Mr, Dr, Sat, No, Co`) và nhóm nhận cả khi viết thường (`e.g, i.e, etc, vs`). Nếu bỏ qua chữ hoa thì câu "The cat sat." sẽ không bao giờ được tách, vì `sat` trùng viết tắt của Saturday.

Không đếm âm tiết: ARI chỉ cần số ký tự, và `AnalysisResult` không có trường nào dùng tới âm tiết.

### Nguồn từ điển

Bộ từ điển complex words / participles biên soạn lại thành data file TS, lấy cảm hứng từ các bản open-source clone Hemingway (hemingway-js và tương tự).

### Ràng buộc module (deep module discipline)

- **Package chỉ export `analyze()` + các type của `AnalysisResult`.** `Rule` là **internal seam**: dùng cho unit test từng rule bên trong package, không export ra ngoài. Caller học đúng một hàm, nhận string, trả kết quả — không cần biết tokenizer, rules hay ARI.
- **Pure function, không side effect, không dependency ngoài.** Test chạy qua đúng interface mà caller dùng.
- **Highlight plugin (web) không biết rule nào sinh ra highlight** — chỉ đọc `type` để chọn màu. Thêm rule mới về sau là thêm data, không sửa plugin. Phần mapping Lexical nodes ↔ plain-text offsets nằm trong implementation của plugin, không rò rỉ ra component khác.

## 4. Frontend (`apps/web`)

**Stack:** React 18 + Vite + TypeScript, Lexical editor, TanStack Query, React Router, Zustand, Tailwind.

### UI/UX direction: Editorial / Literary — "Bàn viết của nhà văn"

Chức năng và bố cục theo Hemingway, nhưng diện mạo có bản sắc riêng (theo skill frontend-design):

- **Cảm giác**: tạp chí văn học, giấy ấm, mực đậm — gợi di sản typewriter của Hemingway.
- **Palette**: nền kem/giấy ngà (`#faf6ef`), chữ mực than, accent đỏ son (màu bút đỏ biên tập viên). 5 màu highlight tinh chỉnh thành tông "bút dạ quang trên giấy" hài hòa với nền ấm. Toàn bộ khai báo bằng CSS variables.
- **Typography**: Fraunces (display, optical sizing) cho heading/brand; Newsreader hoặc Source Serif cho văn bản editor; IBM Plex Mono cho số liệu thống kê.
- **Chi tiết**: texture giấy nhẹ, sidebar như lề ghi chú của biên tập viên, grade hiển thị như con dấu; micro-interactions tiết chế (staggered reveal khi load, hover tinh tế).
- **Điểm nhớ**: trang bản thảo được biên tập viên chấm bút — không phải một web tool generic.

### Layout (bắt chước Hemingway)

- **Giữa:** editor lớn, nền trắng, font serif. Format: bold, italic, H1–H3, bullet/numbered list, quote, link.
- **Phải:** sidebar cố định:
  - Readability card: "Grade X" + nhãn màu (Good/OK/Poor)
  - 5 dòng đếm lỗi đúng màu highlight, kèm ngưỡng mục tiêu theo độ dài văn bản (vd "3 adverbs, meeting the goal of 3 or fewer")
  - Counts: words, characters, sentences, paragraphs, reading time — click đổi qua lại
- **Trên:** thanh format + tên document (click để sửa) + nút Save + trạng thái "Saved/Saving…"
- **Write / Edit mode** (toggle góc phải trên): Write tắt highlight + sidebar để tập trung viết; Edit bật phân tích.

### Cơ chế highlight trong Lexical

- Sau mỗi thay đổi (debounce 150ms): lấy plain text + mapping node→offset → `analyze()` → áp mark ranges bằng Lexical node transforms/decorations. Highlight là background màu, không phá formatting.
- Highlight tím/xanh lá có tooltip hover hiện gợi ý thay thế.
- Văn bản dài (> ~30k từ): phân tích chạy trong Web Worker.

### Trang

| Route | Mô tả |
|-------|-------|
| `/` | Editor, document mới — dùng được ngay không cần đăng nhập; nhắc đăng nhập khi bấm Save |
| `/docs` | Danh sách document của user (title, ngày sửa, grade), mở/xóa |
| `/doc/:id` | Editor mở document đã lưu, autosave debounce 2s |
| `/login`, `/register` | Form email + password |

## 5. Backend (`apps/api`)

**Stack:** NestJS 10 + Prisma + PostgreSQL 16 (docker-compose khi dev).

### Data model

```prisma
model User {
  id           String     @id @default(cuid())
  email        String     @unique
  passwordHash String
  createdAt    DateTime   @default(now())
  documents    Document[]
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String    @id @default(cuid())
  tokenHash String    @unique   // SHA-256 của chuỗi gốc
  userId    String
  expiresAt DateTime
  revokedAt DateTime?           // logout và rotation đều set trường này
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model Document {
  id        String   @id @default(cuid())
  title     String   @default("Untitled")
  content   Json     // Lexical editor state (giữ formatting)
  plainText String   // bản text thuần cho preview/thống kê nhanh
  grade     Int?     // grade tại lần lưu cuối (client gửi, chỉ để hiển thị ở list)
  ownerId   String
  owner     User     @relation(fields: [ownerId], references: [id])
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### Auth

Email + password (bcrypt, 12 rounds). JWT access token 15 phút + refresh token 7 ngày (httpOnly cookie, path `/auth`, có rotate).

**Refresh token không phải JWT**: nó là chuỗi ngẫu nhiên 32 byte, DB lưu **hash SHA-256** trong bảng `RefreshToken`. JWT không thu hồi được, mà spec yêu cầu logout và rotation phải thật sự vô hiệu hóa phiên cũ. Lưu hash thay vì chuỗi gốc để rò rỉ DB không đồng nghĩa rò rỉ phiên đăng nhập.

Đăng nhập sai email và sai mật khẩu trả về **cùng một thông báo**, để không tiết lộ email nào đã đăng ký. NestJS guards bảo vệ mọi route document; mọi query filter theo `ownerId`.

### Endpoints

| Method | Route | Mô tả |
|--------|-------|-------|
| POST | `/auth/register` | Validate email, password ≥ 8 ký tự |
| POST | `/auth/login` | Trả access token + set refresh cookie |
| POST | `/auth/refresh` | Cấp lại access token |
| POST | `/auth/logout` | Hủy refresh token |
| GET | `/documents` | List của user (không kèm content) |
| POST | `/documents` | Tạo mới |
| GET | `/documents/:id` | Lấy đầy đủ |
| PATCH | `/documents/:id` | Autosave title/content |
| DELETE | `/documents/:id` | Xóa |
| GET | `/ai/status` | AI rewrite có bật không |
| POST | `/ai/rewrite` | Gọi OpenRouter viết lại câu |

### Xử lý lỗi

- Validation bằng `class-validator` DTO → 400 kèm message rõ.
- 401 khi token hết hạn; client tự gọi refresh rồi retry 1 lần.
- 404 khi document không tồn tại hoặc không thuộc user (không phân biệt để tránh lộ thông tin).
- Rate limit route auth: 10 req/phút/IP.
- Giới hạn content: 1MB.

## 6. AI Rewrite (OpenRouter)

### UX

- Click vào highlight → popover: mô tả vấn đề + nút **"Fix with AI"**.
- Bấm → loading → 1–2 phương án viết lại kèm diff được tô → **Apply** (thay vào editor, undo bằng Ctrl+Z) hoặc **Dismiss**.
- Chọn nhiều câu → "Fix selection" gửi cả đoạn.

### Backend

- `POST /ai/rewrite` — body `{ text, issueType, context }` (context = 1 câu trước/sau). Yêu cầu đăng nhập.
- `OPENROUTER_API_KEY` trong `.env` của api, không bao giờ ra client.
- Model qua env `AI_MODEL` (mặc định `anthropic/claude-haiku-4.5`), đổi không cần sửa code.
- Prompt theo `issueType`: passive → active voice; very-hard → split/simplify; complex → simpler words. Ràng buộc: giữ nghĩa, giữ tone, chỉ trả text kết quả.
- Rate limit: 20 req/phút/user. Timeout 15s. Lỗi OpenRouter (hết credit, timeout) → message rõ ràng cho client, không crash.
- Không set `OPENROUTER_API_KEY` → `/ai/status` trả tắt → client ẩn nút Fix with AI.

### Ràng buộc module

**Không dựng abstraction `LLMProvider`.** OpenRouter là provider duy nhất — một adapter chỉ là seam giả định. AiModule gọi thẳng OpenRouter; `AI_MODEL` là config, không phải seam. Khi nào thực sự có provider thứ hai mới tách seam; lúc đó refactor rẻ vì mọi thứ còn nằm một chỗ.

## 7. Testing

| Package | Công cụ | Trọng tâm |
|---------|---------|-----------|
| `packages/analysis` | Vitest | **Nặng nhất.** Mỗi rule: bộ câu mẫu positive/negative (passive thật vs adjective giả passive, adverb whitelist...). Grade level đối chiếu đoạn văn có grade đã biết. Snapshot test cho `analyze()` |
| `apps/api` | Jest (NestJS mặc định) | Unit test auth service. E2E: register → login → CRUD document → không đọc được doc người khác (DB test riêng) |
| `apps/web` | Vitest + React Testing Library | Sidebar/thống kê; smoke test editor render + highlight đúng loại. Không cần coverage nặng UI |

## 8. Dev workflow

- `docker compose up -d` → PostgreSQL
- `pnpm dev` → web (port 5173, proxy `/api` → 3000) + api (port 3000) song song
- `pnpm test` chạy toàn bộ; ESLint + Prettier config chung ở root
- `.env` cho api (`DATABASE_URL`, JWT secrets, `OPENROUTER_API_KEY`, `AI_MODEL`); có `.env.example`

## 9. Thứ tự triển khai (mức milestone)

1. Scaffold monorepo + tooling
2. `packages/analysis` (tokenizer → từng rule → readability) — TDD
3. `apps/api` (auth → documents CRUD)
4. `apps/web` (editor + highlight → sidebar → auth flow → docs list)
5. AI rewrite (api module → popover UI)

Chi tiết từng bước nằm ở implementation plan (tài liệu riêng).
