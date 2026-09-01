# Sổ lỗi — Đánh dấu lỗi và tích lũy lỗi tái diễn: Design

**Ngày:** 2026-08-26
**Trạng thái:** Đã duyệt qua brainstorming, chờ triển khai
**Xây trên:** [Writing Practice](2026-08-25-writing-practice-design.md) đã hoàn thành (6 milestone)

## 1. Mục tiêu

App hiện **chấm điểm nhưng không dạy**. Người học nộp bài, nhận band và vài dòng nhận xét ở mức tiêu chí ("Grammatical Range: 5.5 — bạn dùng nhiều câu đơn"), rồi không biết câu nào sai. Bài kế tiếp bắt đầu lại từ con số không: `nextFocus` sinh mới mỗi lần rồi biến mất, bài thứ 20 không biết gì về 19 bài trước.

Bản này đóng hai lỗ hổng đó:

1. **Lỗi ở mức span** — AI đánh dấu từng chỗ sai cụ thể trên bài, kèm câu sửa và một dòng giải thích.
2. **Lỗi tích lũy** — gộp lỗi qua nhiều bài thành hồ sơ "lỗi bạn hay lặp", hiện trên dashboard và nhắc lại trước khi viết bài mới.

Highlight hiện có trên bài là rule Hemingway (bị động, trạng từ, câu dài) — đó là **văn phong**, không phải **lỗi ngôn ngữ**. Hai thứ khác nhau và bản này không trộn chúng.

### Ngoài phạm vi bản này

Đánh dấu lỗi trong editor tự do (`/`, `/doc/:id`) — bên đó đã có AI rewrite theo câu, và bóc lỗi liên tục theo từng phím gõ thì vừa đắt vừa vô nghĩa. Bài tập luyện riêng theo từng loại lỗi (drill). Ôn tập ngắt quãng cho từ vựng. Hỗ trợ tiếng Việt: nhãn lỗi và giải thích bằng tiếng Anh, nhất quán với toàn bộ UI hiện tại.

## 2. Bộ phân loại lỗi — bắt buộc đóng

Muốn đếm được "bạn lặp lỗi này 12 lần" thì tập nhãn **phải đóng**. Để AI tự đặt tên lỗi mỗi lần gọi thì không bao giờ gộp được: "sai mạo từ", "thiếu 'the'", "article error" sẽ thành ba nhãn khác nhau.

Độ mịn ở mức trung bình — đủ cụ thể để hành động, đủ thô để đếm. `grammar` thì quá mơ hồ; `thiếu mạo từ xác định trước so sánh nhất` thì không bao giờ gộp được với gì.

```ts
export type ErrorSeverity = "error" | "refinement";

export type ErrorCategory =
  // Tầng "error" — sai thật sự
  | "article"                 // a / an / the: thiếu, thừa, sai loại
  | "verb-tense"              // sai thì
  | "subject-verb-agreement"  // hòa hợp chủ ngữ – động từ
  | "noun-number"             // số ít / số nhiều
  | "preposition"             // giới từ
  | "word-order"              // trật tự từ
  | "word-form"               // dạng từ: economic / economical, succeed / success
  | "spelling"
  | "punctuation"
  | "sentence-structure"      // câu cụt, câu dính
  | "pronoun"                 // sai chiếu, sai dạng
  // Tầng "refinement" — đúng ngữ pháp nhưng chưa hay
  | "word-choice"             // collocation không tự nhiên
  | "register";               // trang trọng / thân mật lệch dạng bài
```

Bộ nhãn này chọn theo lỗi đặc trưng của người Việt học tiếng Anh: mạo từ, số nhiều, thì, trật tự từ là bốn nhóm chiếm phần lớn.

**Cố ý không có nhãn "dài dòng".** `complex-phrase` và `qualifier` của rule engine đã lo việc đó — thêm nhãn nữa là hai hệ thống giẫm chân nhau trên cùng một đoạn văn.

### Hai tầng để không đè bẹp người học

Một bài B1 có thể có 30–40 chỗ đáng sửa. Gạch hết như nhau thì bài viết đỏ lòm và người học không biết bắt đầu từ đâu. Nên đánh dấu **hết**, nhưng phân tầng: `error` hiện đậm, `refinement` hiện mờ — và màn kết quả có ô "sửa ba nhóm này trước" làm điểm bắt đầu.

## 3. Neo lỗi vào văn bản

**Không tin offset do AI trả về.** LLM đếm ký tự rất tệ; hỏi nó `start: 143` thì con số gần như luôn lệch.

AI trả về **nguyên văn đoạn sai**, server tự tìm vị trí:

```json
{
  "quote": "I very like it",
  "occurrence": 1,
  "category": "word-order",
  "severity": "error",
  "correction": "I like it very much",
  "explain": "Adverbs of degree go after the verb in English."
}
```

`occurrence` xử lý trường hợp đoạn đó xuất hiện nhiều lần trong bài (1-based). Server dò `plainText` bằng tìm chuỗi chính xác → ra `start`/`end`.

Hai kiểu dữ liệu, tách bạch:

```ts
/** Những gì AI trả về. Chỉ tồn tại trong lúc xử lý, không lưu. */
interface RawWritingError {
  quote: string;
  occurrence: number;
  category: ErrorCategory;
  severity: ErrorSeverity;
  correction: string;
  explain: string;
}

/** Những gì lưu và vẽ. Cùng hình dạng span với Highlight của analysis. */
export interface WritingError {
  start: number;   // inclusive
  end: number;     // exclusive
  category: ErrorCategory;
  severity: ErrorSeverity;
  correction: string;
  explain: string;
}
```

### Xử lý khi phân giải hỏng

| Tình huống | Xử lý |
|---|---|
| `quote` không có trong bài (AI diễn giải lại thay vì trích đúng) | Bỏ lỗi đó, giữ phần còn lại |
| `occurrence` vượt số lần xuất hiện thật | Bỏ lỗi đó |
| `quote` rỗng hoặc chỉ khoảng trắng | Bỏ lỗi đó |
| `category` ngoài bộ nhãn đóng | Bỏ lỗi đó (schema có enum, nhưng vẫn kiểm lại phía server) |
| Hai lỗi trùng span hoàn toàn | Giữ cái đầu tiên |

Bỏ im lặng, không báo lỗi cho người dùng: mất một dấu gạch tốt hơn là hỏng cả màn kết quả.

Vì `WritingError` có đúng hình dạng span như `Highlight` của `packages/analysis`, toàn bộ hạ tầng vẽ highlight sẵn có tái dùng được.

## 4. Data model

Thêm đúng một cột vào `PracticeAttempt`:

```prisma
/// WritingError[] — null khi bóc lỗi thất bại hoặc bài chưa nộp
errors Json?
```

**Không có bảng thống kê lỗi.** Theo đúng nguyên tắc spec trước đã đặt cho streak: *dữ liệu suy ra được mà lưu riêng là nguồn của bug lệch số*. Hồ sơ lỗi tính từ `errors` của các bài gần nhất, y như streak tính từ `submittedAt`.

## 5. Backend

### `submit()` chạy hai lời gọi AI song song

| Lời gọi | Prompt | Bắt buộc? | Hỏng thì sao |
|---|---|---|---|
| Chấm điểm | `grade-prompt.ts` hiện có, **không sửa một dòng** | Có | 502, không lưu gì |
| Bóc lỗi | `error-prompt.ts` mới, `json_schema` với enum khoá cứng 13 nhãn | Không | `errors = null`, vẫn lưu band và feedback |

Tách riêng thay vì gộp một lời gọi, dù gộp tiết kiệm được phần token của bài viết:

- Prompt chấm đã ổn định và có test — nhét thêm việc vào đó là rủi ro không cần thiết.
- Một model rẻ làm hai việc khác nhau trong một lượt thường ra kết quả tệ hơn cả hai.
- **Cô lập lỗi**: bóc lỗi hỏng thì người học vẫn có điểm.

Chạy song song nên không chậm thêm; cả hai đã có timeout 15s sẵn trong `AiService.complete()`.

Prompt bóc lỗi nhận: bài viết, dạng bài (để chấm `register` đúng ngữ cảnh — email thân mật khác báo cáo), và yêu cầu trích **nguyên văn** đoạn sai.

### Endpoint mới

| Method | Route | Việc |
|---|---|---|
| GET | `/practice/profile` | Trả `ErrorProfile` tính từ `PROFILE_WINDOW` bài nộp gần nhất của user |

Server tính hồ sơ thay vì đẩy `errors` đầy đủ của 10 bài xuống client: dashboard chỉ cần nhãn và số đếm, không cần câu sửa lẫn giải thích của từng lỗi cũ. Cả dashboard lẫn phòng thi gọi chung endpoint này.

`GET /practice/attempts` (danh sách) **không** kèm `errors` — giữ payload nhẹ như hiện tại. Chỉ `GET /practice/attempts/:id` mới trả `errors`, cho màn kết quả.

### Ranh giới module

`AiService` vẫn là **cổng OpenRouter thuần** — không biết bóc lỗi là gì. Prompt và schema nằm trong `PracticeModule`, giống cách `grade-prompt.ts` và `generate-prompt.ts` đang đặt.

`summarizeErrors` là hàm thuần ở `packages/practice`; `PracticeService` chỉ đọc DB rồi gọi nó — không tự tính thống kê.

## 6. Hồ sơ lỗi tái diễn

Hàm thuần trong `packages/practice`, cạnh `computeStreak`. Không biết gì về React, HTTP hay Prisma.

```ts
/** Vừa đủ để tính hồ sơ — không kéo theo nội dung bài hay điểm số. */
export interface AttemptErrorInput {
  errors: WritingError[];
  wordCount: number;
  submittedAt: Date;
}

export interface ErrorTally {
  category: ErrorCategory;
  count: number;
  /** null khi chưa đủ bài để nói được xu hướng. */
  trend: "down" | "flat" | "up" | null;
}

export interface ErrorProfile {
  tallies: ErrorTally[];       // sắp theo count giảm dần
  attemptsConsidered: number;
}

summarizeErrors(attempts: AttemptErrorInput[]): ErrorProfile
focusCategories(errors: WritingError[]): ErrorCategory[]
```

`summarizeErrors` tự sắp `attempts` theo `submittedAt` và tự cắt còn `PROFILE_WINDOW` bài mới nhất — caller không phải nhớ tiền điều kiện nào.

### Hằng số

| Hằng số | Giá trị | Lý do |
|---|---|---|
| `PROFILE_WINDOW` | 10 bài nộp gần nhất | Đủ gần để phản ánh trình độ hiện tại, đủ nhiều để có ý nghĩa |
| `MIN_OCCURRENCES` | 2 | Một lần là tai nạn, không phải pattern |
| `MIN_ATTEMPTS_FOR_TREND` | 4 | Dưới mức này chia đôi cửa sổ không còn ý nghĩa |

### Xu hướng

Chuẩn hoá theo **lỗi trên 100 từ** — không chuẩn hoá thì viết bài dài hơn sẽ trông như đang tệ đi. Chia cửa sổ làm nửa cũ / nửa mới theo `submittedAt`, so hai tỉ lệ:

- `down` khi tỉ lệ mới < 0.75 × tỉ lệ cũ
- `up` khi tỉ lệ mới > 1.33 × tỉ lệ cũ
- `flat` ở giữa

Ngưỡng lệch nhau (0.75 và 1.33) để dao động nhỏ không bị đọc thành xu hướng.

Số bài lẻ thì bài ở giữa thuộc **nửa mới** — thiên về phản ánh hiện tại. Tỉ lệ nửa cũ bằng 0 (trước không sai nhãn này, giờ có) → `up`; cả hai bằng 0 thì nhãn đó không lọt vào `tallies` ngay từ đầu.

### `focusCategories`

Ba nhãn xuất hiện nhiều nhất **trong riêng bài này**, chỉ tầng `error`, đồng hạng thì theo thứ tự khai báo trong taxonomy. Dùng cho ô "sửa ba nhóm này trước" ở màn kết quả.

Cố ý **không** dính tới hồ sơ tái diễn: màn kết quả nói về bài vừa viết, dashboard và phòng thi nói về xu hướng dài hạn. Trộn vào nhau thì màn kết quả phải tải thêm dữ liệu chỉ để sắp xếp lại ba dòng.

## 7. Web

### Màn kết quả — hai ống kính, không chồng lên nhau

Toggle `Mistakes` / `Style`, mặc định `Mistakes`.

Vẽ cả lỗi lẫn highlight Hemingway lên cùng một bài sẽ thành mớ hỗn độn: một câu nền vàng (câu khó), gạch đỏ (sai mạo từ), chữ nền xanh (trạng từ). Tệ hơn, hai thứ đó **mâu thuẫn nhau** — spec trước đã ghi: Hemingway thưởng câu ngắn, IELTS *Grammatical Range* thưởng câu phức. Tách thành hai lăng kính giải quyết luôn mâu thuẫn đó thay vì phải hòa giải nó trên cùng một canvas.

Lỗi vẽ bằng **gạch chân**, không phải nền màu, để không lẫn với Hemingway:

| Tầng | Kiểu vẽ |
|---|---|
| `error` | Gạch sóng, màu đỏ son (`--color-vermilion`) |
| `refinement` | Gạch chấm mảnh, màu mờ (`--color-ink-faint`) |

CSS Custom Highlight API hỗ trợ `text-decoration` trên `::highlight()`, nên không cần chèn thẻ vào DOM — giữ nguyên cách làm hiện tại.

Click vào span → popover: nhãn lỗi, câu sửa, một dòng giải thích. Dùng lại `highlight-hit.ts` sẵn có. Bài đã nộp là read-only nên popover không có nút Apply.

Trên sidebar, dưới `Next time`, thêm ô **`Fix these first`** — ba nhãn từ `focusCategories()`.

Khi bài không có lỗi nào: hiện một dòng ghi nhận, không phải ô rỗng.

### Refactor có chủ đích: tổng quát hoá painter

`paintHighlights()` hiện hardcode `ALL_TYPES` là danh sách type của package analysis, và chỉ nhận `Highlight[]`. Việc thật sự của nó là *"cho một text index và một tập span có (start, end, type), vẽ chúng lên"* — không cần biết span đến từ rule engine hay từ AI.

Tổng quát hoá thành vẽ theo **lớp**: mỗi lớp khai báo danh sách tên registry và độ ưu tiên của nó. Hai lăng kính dùng chung một painter. Đây là loại refactor mà công việc này đòi hỏi, không phải dọn dẹp ngoài lề.

### Dashboard `/practice`

Thêm mục `Recurring` cạnh streak: 3–5 nhãn, số lần, mũi tên xu hướng. Chưa đủ dữ liệu thì ẩn hẳn mục này thay vì hiện ô rỗng.

### Phòng thi `/practice/:id`

Cuối panel đề bài, một dòng lặng lẽ: *"Watch for: articles, verb tense"* — ba nhãn đầu của hồ sơ.

Luôn hiện, **không gate như hints**. Hints bị gate vì đưa từ vựng trước khi viết là đang test "dùng được từ cho sẵn không" thay vì "vốn từ của bạn tới đâu". Nhắc lỗi thì khác hẳn: nó nói về điểm yếu của chính người viết, không tiết lộ gì về nội dung bài, nên không làm hỏng tính khách quan. Không cần cờ `errorHintOpened`.

## 8. Ràng buộc module

- `packages/analysis` **không đổi một dòng** — giữ đúng cam kết của spec trước.
- `packages/practice` giữ nguyên tính chất: chỉ export danh mục và hàm thuần, không biết React/HTTP/Prisma. `ErrorCategory`, `WritingError`, `summarizeErrors`, `focusCategories` đặt ở đây vì cả web lẫn api đều cần.
- `AiService` vẫn không biết bóc lỗi là gì.
- Việc phân giải `quote` → offset nằm ở api, tách thành module riêng test được độc lập, không lẫn vào service.

## 9. Testing

| Package | Trọng tâm |
|---|---|
| `packages/practice` | `summarizeErrors` làm **TDD**: mảng rỗng, một bài, đồng hạng, dưới `MIN_OCCURRENCES`, dưới `MIN_ATTEMPTS_FOR_TREND`, xu hướng cả hai chiều, chuẩn hoá theo độ dài bài. `focusCategories`: bỏ tầng `refinement`, đồng hạng theo thứ tự taxonomy, ít hơn ba nhãn |
| `apps/api` | Phân giải `quote` → offset: trùng lặp có `occurrence`, không tìm thấy, chuỗi rỗng, category lạ, span trùng nhau. E2E: submit trả `errors`; bóc lỗi hỏng vẫn lưu được band. **Toàn bộ test chấm điểm cũ phải xanh mà không sửa dòng nào** |
| `apps/web` | Painter sau khi tổng quát hoá vẫn vẽ đúng highlight cũ (test hồi quy). Toggle hai lăng kính. Popover hiện đúng nội dung. Ô `Fix these first` |

## 10. Rủi ro đã biết

- **AI trích không đúng nguyên văn.** Rủi ro chính. Model hay "sửa nhẹ" đoạn trích thay vì copy nguyên. Giảm thiểu bằng chỉ dẫn rõ trong prompt và bỏ im lặng khi không khớp — nhưng nếu tỉ lệ rơi cao thì phải đo và cân nhắc dò gần đúng (chuẩn hoá khoảng trắng, bỏ phân biệt hoa thường) trước khi bỏ.
- **Chi phí tăng.** Mỗi bài nộp giờ tốn hai lời gọi thay vì một. Phần bóc lỗi tốn output token đáng kể (mỗi lỗi ~40 token). Đo chi phí thật trên một bài dài trước khi làm tiếp UI.
- **Model rẻ bóc lỗi không ổn định.** Cùng một bài, hai lần chấm có thể ra hai tập lỗi khác nhau. Chấp nhận được với hồ sơ tích lũy (nhiễu tự triệt tiêu qua nhiều bài), nhưng nếu lệch quá lớn thì cân nhắc tách model riêng cho việc bóc lỗi — `AI_MODEL` hiện là một biến duy nhất.
