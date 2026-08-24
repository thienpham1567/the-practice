# Writing Helper — Implementation Plan

**Spec:** [../specs/2026-08-24-hemingway-clone-design.md](../specs/2026-08-24-hemingway-clone-design.md)
**Nguyên tắc:** mỗi bước nhỏ, kiểm chứng được, commit riêng. `packages/analysis` làm theo TDD (test trước, code sau).

## Milestone 1 — Scaffold monorepo

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 1.1 | Root: `pnpm-workspace.yaml`, `package.json`, `tsconfig.base.json`, ESLint + Prettier config chung, `.gitignore` | `pnpm install` chạy sạch |
| 1.2 | `packages/analysis`: package.json, tsconfig, Vitest config, 1 test placeholder | `pnpm --filter analysis test` xanh |
| 1.3 | `apps/api`: NestJS scaffold (CLI), chạy được | `curl localhost:3000` trả về app mặc định |
| 1.4 | `apps/web`: Vite + React + TS scaffold, Tailwind, import thử `analysis` qua workspace | `pnpm --filter web dev` render trang, import hoạt động |
| 1.5 | `docker-compose.yml` (PostgreSQL 16) + script `pnpm dev` chạy song song web + api (proxy `/api` → 3000) | `docker compose up -d` + `pnpm dev` chạy cả hai |

## Milestone 2 — Analysis engine (TDD từng bước)

Thứ tự phụ thuộc: tokenizer → readability → rules đơn giản → rules phức tạp → orchestrator.

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 2.1 | `tokenize.ts`: tách câu (xử lý `Mr., e.g., U.S.`, số thập phân), tách từ, offset chính xác trên text gốc | Unit tests: đoạn văn có viết tắt, nhiều đoạn, xuống dòng |
| 2.2 | Đếm âm tiết heuristic vowel-groups + đếm ký tự/chữ cái | Test với danh sách từ có số âm tiết đã biết |
| 2.3 | `readability.ts`: Automated Readability Index cho cả văn bản và từng câu | Test đối chiếu đoạn văn có grade đã biết |
| 2.4 | Rule **adverb**: `-ly` trừ whitelist; data file whitelist | Positive: `quickly`; negative: `family, only, supply` |
| 2.5 | Rule **qualifier**: danh sách `I think, perhaps, maybe...` — match cụm, không match giữa từ | Test cụm ở đầu/giữa câu |
| 2.6 | Rule **complex phrase**: data file ~1000 cụm + gợi ý thay thế; match dài nhất trước, kèm suggestion trong Highlight | `utilize` → gợi ý `use`; không match trong từ khác |
| 2.7 | Rule **passive voice**: to-be + past participle (từ điển participle bất quy tắc + `-ed`), bỏ qua adjective phổ biến | Positive: `was written`, `is being done`; negative: `was happy`, `is interested in` |
| 2.8 | Rule **hard / very hard sentence**: ≥ 14 từ + grade câu 10–13 (vàng) / ≥ 14 (đỏ); câu < 14 từ không bao giờ đánh dấu | Bộ câu mẫu 3 mức |
| 2.9 | `analyze.ts`: orchestrator gộp highlights + counts + stats + grade + gradeLabel (ngưỡng Good/OK/Poor), reading time | Snapshot test trên đoạn văn chuẩn; test ngưỡng adverb theo độ dài |

## Milestone 3 — API (auth + documents)

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 3.1 | Prisma schema (User, Document) + migration + PrismaService | `prisma migrate dev` tạo bảng |
| 3.2 | AuthModule: register (bcrypt, validate DTO), login (JWT access 15ph + refresh cookie 7 ngày rotate), refresh, logout; rate limit 10 req/phút/IP | Unit test service + e2e: register → login → refresh → logout |
| 3.3 | DocumentsModule: CRUD, mọi query filter `ownerId`, list không kèm content, 404 không phân biệt not-found/not-owner, giới hạn content 1MB | E2E: CRUD đầy đủ + user B không đọc/sửa/xóa được doc của user A |
| 3.4 | Global: validation pipe, exception filter trả message rõ, CORS cho dev | E2E pass toàn bộ |

## Milestone 4 — Web (UI theo hướng Editorial/Literary)

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 4.1 | Design tokens: CSS variables (palette giấy ngà/mực than/đỏ son, 5 màu highlight tông ấm), fonts Fraunces + Newsreader + IBM Plex Mono, texture giấy | Trang mẫu hiển thị đúng token |
| 4.2 | Lexical editor: rich text (bold, italic, H1–H3, list, quote, link), toolbar, paste giữ format | Gõ + format + paste hoạt động |
| 4.3 | Highlight plugin: debounce 150ms → plain text + mapping offset → `analyze()` → áp mark ranges 5 màu; Web Worker khi > 30k từ | Smoke test: văn bản mẫu ra đúng loại highlight; gõ không khựng |
| 4.4 | Tooltip hover cho highlight tím/xanh lá hiện gợi ý thay thế | Hover hiện đúng suggestion |
| 4.5 | Sidebar: readability card (grade + nhãn màu), 5 dòng đếm đúng màu + ngưỡng mục tiêu, counts (words/chars/sentences/paragraphs/reading time) click đổi | RTL test cho số liệu từ AnalysisResult mẫu |
| 4.6 | Write/Edit mode toggle: Write tắt highlight + sidebar | Toggle hoạt động |
| 4.7 | Auth flow: `/login`, `/register`, lưu access token in-memory + tự refresh khi 401 (retry 1 lần), TanStack Query client | Login/logout, refresh tự động |
| 4.8 | Documents: `/docs` list (title, ngày sửa, grade, xóa), `/doc/:id` mở + autosave debounce 2s + trạng thái Saving/Saved, `/` doc mới → nhắc login khi Save | Luồng đầy đủ chạy tay + test list |
| 4.9 | Polish theo frontend-design: staggered reveal khi load, hover states, grade như con dấu, sidebar như lề ghi chú | Review bằng mắt trên browser |

## Milestone 5 — AI Rewrite

| # | Việc | Kiểm chứng |
|---|------|-----------|
| 5.1 | Api AiModule: `GET /ai/status`; `POST /ai/rewrite` gọi OpenRouter (`OPENROUTER_API_KEY`, `AI_MODEL` mặc định `anthropic/claude-haiku-4.5`), prompt theo issueType, rate limit 20 req/phút/user, timeout 15s, lỗi trả message rõ | Unit test với OpenRouter mock: prompt đúng theo issueType, lỗi credit/timeout xử lý đúng |
| 5.2 | Web: popover khi click highlight (mô tả vấn đề + Fix with AI), loading, hiện 1–2 phương án kèm diff tô, Apply (undo được) / Dismiss; ẩn nút khi `/ai/status` tắt | Chạy tay với key thật; test popover render |
| 5.3 | Fix selection: chọn nhiều câu → gửi cả đoạn | Chạy tay |

## Ghi chú chung

- Mỗi bước xong: chạy test liên quan, commit riêng với message mô tả.
- Sau mỗi milestone: chạy toàn bộ `pnpm test` + review nhanh.
- `.env.example` cập nhật ngay khi thêm biến mới.
