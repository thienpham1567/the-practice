# Writing Practice — Luyện viết hằng ngày theo CEFR: Design

**Ngày:** 2026-08-25
**Trạng thái:** Đã duyệt qua brainstorming, chờ triển khai
**Xây trên:** [Hemingway clone](2026-08-24-hemingway-clone-design.md) đã hoàn thành (5 milestone)

## 1. Mục tiêu

Biến app từ "công cụ sửa văn" thành "chỗ luyện viết hằng ngày". Người dùng chọn mức độ, AI sinh đề bài kèm ý tưởng và từ vựng, người dùng viết trong thời gian giới hạn, bấm nộp và nhận điểm theo rubric IELTS cộng phân tích văn phong từ rule engine sẵn có.

### Ngoài phạm vi bản này

Chấm lại bài cũ, so sánh hai bài với nhau, xuất PDF kết quả, tự động nộp khi hết giờ (đồng hồ chỉ cảnh báo), luyện nói/nghe, hỗ trợ tiếng Việt.

## 2. Chuẩn: hai trục tách rời

Quyết định nền tảng: **mức độ và dạng bài là hai trục khác nhau.**

"Beginner/intermediate/advanced" không phải trục của IELTS — IELTS chỉ có một format, viết dở thì band thấp, không có "đề cho người mới". Ép một format cho cả ba mức sẽ khiến người mới nản (bắt viết essay 250 từ ngay) và người giỏi thấy nhạt.

| Trục | Chuẩn | Lý do |
|---|---|---|
| **Mức độ** | CEFR (A2 / B1 / B2 / C1) | Đây mới đúng là thang beginner → advanced |
| **Dạng bài** | Rút từ IELTS + Cambridge, **đổi theo mức** | Người mới viết email, người giỏi viết discussion essay |
| **Chấm điểm** | Rubric 4 tiêu chí của IELTS | Công khai, mô tả rõ ràng, và bản thân 4 tiêu chí đó là tiêu chuẩn viết tốt thật sự |

**Không chọn TOEIC Writing**: thiên về ngữ cảnh công sở, và 5 câu đầu bắt mô tả **hình ảnh** — app này là text thuần, thêm ảnh mở ra cả nhánh phức tạp mới.

## 3. `packages/practice` — nguồn duy nhất của danh mục bài

Cả web (hiển thị) lẫn api (dựng prompt) đều cần biết: mức nào có dạng bài nào, bao nhiêu từ, bao nhiêu phút. Để hai nơi tự định nghĩa là chắc chắn lệch nhau sau vài lần sửa.

### Interface công khai

```ts
export type Level = "A2" | "B1" | "B2" | "C1";

export type TaskType =
  | "email" | "describe-experience" | "letter" | "review"
  | "opinion-essay" | "discussion-essay" | "problem-solution" | "report";

export interface TaskSpec {
  type: TaskType;
  levels: Level[];
  minWords: number;
  maxWords: number;
  timeMinutes: number;
  label: string;
  /** Khung yêu cầu cố định của dạng bài, ví dụ "Discuss both views and give
   *  your own opinion." AI chỉ sinh chủ đề, không sinh khung này — giữ đề bài
   *  đúng chuẩn và giảm sai lệch giữa các lần gen. */
  instruction: string;
}

tasksForLevel(level: Level): TaskSpec[]
pickTask(level: Level, recentTypes: TaskType[]): TaskSpec
bandToCefr(band: number): Level
overallBand(scores: CriterionScores): number
computeStreak(submittedDates: Date[]): { current: number; longest: number }
```

### Danh mục bài

| type | levels | từ | phút | instruction |
|---|---|---|---|---|
| `email` | A2, B1 | 80–120 | 20 | Viết email cho một người cụ thể với mục đích cho trước |
| `describe-experience` | A2, B1 | 80–120 | 20 | Kể lại một trải nghiệm, nêu cảm nghĩ |
| `letter` | B1, B2 | 150–200 | 20 | Thư trang trọng/bán trang trọng (IELTS GT Task 1) |
| `review` | B1, B2 | 150–200 | 30 | Đánh giá một thứ đã trải nghiệm, có khuyến nghị |
| `opinion-essay` | B1, B2, C1 | 180–250 | 30 | Nêu mức độ đồng ý và lập luận |
| `discussion-essay` | B2, C1 | 250–300 | 40 | Bàn cả hai quan điểm và nêu ý kiến riêng |
| `problem-solution` | B2, C1 | 250–300 | 40 | Nêu nguyên nhân và đề xuất giải pháp |
| `report` | C1 | 250–300 | 40 | Báo cáo/đề xuất theo yêu cầu công việc |

`pickTask` xoay vòng, tránh dạng vừa làm gần đây — để luyện đều thay vì lặp một dạng.

### Quy đổi band → CEFR

| Band | CEFR |
|---|---|
| < 4.0 | A2 |
| 4.0 – 5.0 | B1 |
| 5.5 – 6.5 | B2 |
| ≥ 7.0 | C1 |

### `computeStreak` là hàm thuần

Nhận danh sách ngày nộp, trả về chuỗi ngày liên tiếp hiện tại và dài nhất. Không phải logic UI, phải test được độc lập.

## 4. Data model

```prisma
model PracticeAttempt {
  id       String @id @default(cuid())
  userId   String
  level    String   // A2 | B1 | B2 | C1
  taskType String

  /// Đề bài do AI sinh
  prompt     String
  ideas      Json     // string[]
  vocabulary Json     // { word, meaning, example }[]
  /// Người dùng có mở gợi ý không — ảnh hưởng cách đọc điểm
  hintsOpened Boolean @default(false)

  content    Json?    // Lexical editor state
  plainText  String   @default("")
  wordCount  Int      @default(0)

  /// Mốc cho đồng hồ đếm ngược. Đặt ở server nên F5 không reset được.
  startedAt      DateTime  @default(now())
  submittedAt    DateTime?
  elapsedSeconds Int?

  band          Float?   // 0–9, bước 0.5
  scores        Json?    // { taskResponse, coherenceCohesion, lexicalResource, grammaticalRange }
  feedback      Json?    // nhận xét từng tiêu chí + tổng quan + việc cần làm tiếp
  /// counts từ analyze() tại thời điểm nộp, để xem lại mà không phải chạy lại
  styleSnapshot Json?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, submittedAt])
}
```

**Streak không lưu trong DB** — suy ra từ `submittedAt`. Dữ liệu suy ra được mà lưu riêng là nguồn của bug lệch số.

**Không dùng chung bảng `Document`**: vòng đời khác hẳn — có đề bài, có điểm, và không sửa lại sau khi nộp.

## 5. Backend

### Tách seam trong AiModule

`AiService` hiện chỉ biết làm rewrite. Giờ có **caller thật thứ hai** (sinh đề + chấm bài) dùng chung phần gọi OpenRouter, timeout 15s, xử lý lỗi — đó là seam thật, không phải giả định:

- `AiService.complete<T>({ prompt, schema?, maxTokens })` — cổng OpenRouter duy nhất.
- `rewrite()` viết lại dựa trên `complete()`, **hành vi không đổi**, test cũ phải xanh nguyên.
- Sinh đề và chấm bài dùng **structured output** (`response_format: json_schema`), không dùng text thuần như rewrite — cần JSON đáng tin chứ không phải 2 dòng dọn tay được.

### Sinh đề bài

Prompt nhận `TaskSpec` + level, trả về JSON:

```json
{
  "prompt": "đề bài, đã bao gồm ngữ cảnh cụ thể",
  "ideas": ["4–6 ý tưởng triển khai"],
  "vocabulary": [{ "word": "...", "meaning": "...", "example": "..." }]
}
```

`instruction` của `TaskSpec` được ghép vào đề bài ở phía server, AI chỉ sinh chủ đề — giữ đề đúng chuẩn giữa các lần gen.

### Chấm bài

Prompt nhận đề bài, `TaskSpec` (kèm ngưỡng số từ), số từ thực tế, và bài viết. Trả về JSON 4 điểm 0–9 kèm nhận xét từng tiêu chí.

**Band tổng do server tính**, không để AI tự tính: trung bình 4 tiêu chí, làm tròn về bội số 0.5 gần nhất. Mô hình ngôn ngữ làm số học không đáng tin, mà đây là con số người dùng nhìn vào để đánh giá tiến bộ.

Bài dưới ngưỡng số từ tối thiểu bị trừ Task Response — nêu rõ trong prompt, giống cách IELTS phạt bài thiếu độ dài.

### Endpoints

| Method | Route | Việc |
|---|---|---|
| POST | `/practice/attempts` | body `{ level, taskType? }` → AI sinh đề, tạo attempt, trả `startedAt` cho đồng hồ |
| GET | `/practice/attempts` | Lịch sử, không kèm `content` — cho streak + biểu đồ + danh sách |
| GET | `/practice/attempts/:id` | Mở lại một bài |
| PATCH | `/practice/attempts/:id` | Autosave `content`/`plainText`/`wordCount`/`hintsOpened` |
| POST | `/practice/attempts/:id/submit` | AI chấm → lưu band, scores, feedback, styleSnapshot |

Mọi route yêu cầu đăng nhập, filter theo `userId`, trả **404** cho bài của người khác (giống `DocumentsModule`, để không tiết lộ bài nào có thật).

Hai route tốn tiền (`POST /attempts`, `submit`) dùng `UserThrottlerGuard` như `/ai/rewrite` — giới hạn theo user, không theo IP.

**Không nộp lại được**: `submit` trên bài đã có `submittedAt` trả 409.

## 6. Web

### `/practice` — bảng điều khiển

- Chọn mức (A2 / B1 / B2 / C1) → nút bắt đầu.
- **Dải streak 14 ngày** kiểu vạch đếm trên bản thảo, không phải icon ngọn lửa — giữ đúng tông Editorial.
- **Biểu đồ band theo thời gian**: SVG inline vẽ tay, nét mảnh như mực. Không thêm thư viện chart cho một đường gấp khúc.
- Danh sách bài đã làm: ngày, dạng bài, band.

### `/practice/:id` — phòng thi

- Thẻ đề bài: dạng bài, yêu cầu, mục tiêu số từ, thời gian.
- **Gợi ý thu gọn mặc định** (ý tưởng + từ vựng). Đưa từ vựng trước khi viết là đang test "dùng được từ cho sẵn không" chứ không phải "vốn từ của bạn tới đâu" — nên để người dùng tự quyết, và ghi nhận `hintsOpened`.
- Editor chạy **Write mode, tắt sạch highlight** — đúng như phòng thi thật, tận dụng cơ chế Write/Edit đã có.
- Header: đồng hồ đếm ngược tính từ `startedAt` phía server (F5 không reset), bộ đếm từ đổi màu khi dưới ngưỡng, nút Nộp bài.
- Đồng hồ hết giờ chỉ cảnh báo, **không tự nộp**.

### Màn kết quả

Mở khoá cả hai lớp phản hồi cùng lúc:

1. **Con dấu band** — dùng lại đúng thẩm mỹ `GradeStamp` (khung đôi, nghiêng, vân mực), thêm nhãn CEFR quy đổi.
2. **4 thanh tiêu chí IELTS** + nhận xét từng tiêu chí + một việc cụ thể cần làm tốt hơn lần sau.
3. **Hồ sơ văn phong** từ rule engine.
4. Bài viết hiện lại **kèm highlight** để tự soi.

### Mâu thuẫn Hemingway vs IELTS — phải xử lý ở tầng trình bày

Hemingway thưởng câu ngắn, từ đơn giản, grade level thấp. IELTS thì tiêu chí *Grammatical Range* **thưởng câu phức, cấu trúc đa dạng** — viết toàn câu 8 từ sẽ bị trừ điểm.

Nên ở màn kết quả, **không** hiện sidebar Hemingway kiểu "sửa hết đi". Trình bày thành **hồ sơ trung tính**:

- Passive voice và trạng từ thừa: vẫn là lỗi thật, giữ cảnh báo.
- Độ phức tạp câu: ghi kiểu "trung bình 18 từ/câu — hợp mức C1", không tô đỏ.

## 7. Ràng buộc module

- `packages/practice` chỉ export danh mục + các hàm thuần đã liệt kê. Không biết gì về React, HTTP, hay Prisma.
- `packages/analysis` **không đổi** — practice dùng lại `analyze()` như hiện tại, không thêm gì cho nó.
- `AiService` sau refactor là **cổng OpenRouter thuần**: không biết rewrite hay chấm bài là gì. Prompt và schema nằm ở module dùng chúng.
- `PracticeModule` không biết gì về phân tích văn phong — web tự chạy `analyze()` và gửi `styleSnapshot` lên khi nộp.
