# Sổ lỗi tái diễn (Mistake Notebook) — Design

**Ngày:** 2026-09-02
**Trạng thái:** đã duyệt qua brainstorm

## 1. Vấn đề

App đã **đo lường rất tốt** nhưng vẫn **chưa dạy**. Người học có band, có xu hướng theo tiêu chí ở `/progress`, có `feedbackAudit` đánh dấu góp ý nào đã sửa, có sổ từ vựng đo từ nào đã dùng — nhưng không chỗ nào chỉ ra *câu này sai, sai vì sao*. Đọc "Grammatical Range: 5.5 — bạn dùng nhiều câu đơn" xong vẫn không biết sửa gì.

Highlight duy nhất trên bài viết là rule Hemingway (bị động, trạng từ, câu dài) — đó là **văn phong**, không phải **lỗi ngôn ngữ**. Sai mạo từ, sai thì, sai trật tự từ: app hiện im lặng.

Nghịch lý: **speaking đã có tính năng này rồi**. `SpeakingAttempt.marks` lưu `[{ start, end, kind, note }]`, định vị bằng `locateMarks`, vẽ lên transcript bằng CSS Custom Highlight API. Bài nói được chỉ ra từng chỗ hỏng; bài viết thì không.

Bản này đóng lỗ hổng đó cho writing, và làm nốt nửa sau của hướng "bộ nhớ tích luỹ" mà [spec sổ từ vựng](2026-08-27-vocab-notebook-design.md) đã ghi là để dành: gộp lỗi qua nhiều bài thành hồ sơ **lỗi hay lặp**.

### Ngoài phạm vi bản này

Speaking (giữ nguyên 4 nhãn thô hiện có — gộp hai kỹ năng vào một bộ nhãn là bản riêng, sau khi writing chạy thật). Bài tập luyện riêng theo từng loại lỗi. Ôn tập ngắt quãng. Đánh dấu lỗi trong editor tự do (`/write`, `/doc/:id`) — bên đó đã có AI rewrite theo câu, bóc lỗi theo từng phím gõ thì vừa đắt vừa vô nghĩa. Đối chiếu mark cũ với mark mới sau khi chấm lại (`feedbackAudit` đã làm việc tương tự ở mức tiêu chí). Nhãn và giải thích bằng tiếng Anh, như toàn bộ UI.

## 2. Các quyết định

| Quyết định | Chọn | Lý do |
|---|---|---|
| Bộ nhãn | **Đóng, 13 nhãn, hai tầng** | Muốn đếm "lặp 12 lần" thì nhãn phải đóng. Để model tự đặt tên sẽ ra "sai mạo từ" / "thiếu the" / "article error" là ba nhãn khác nhau, không bao giờ gộp được. |
| Độ mịn | **Trung bình** (`article`, `verb-tense`…) | `grammar` quá mơ hồ để hành động; `thiếu mạo từ xác định trước so sánh nhất` quá mịn để gộp. |
| Tên cột | **`marks`**, khớp `SpeakingAttempt.marks` | Cùng một khái niệm ở hai kỹ năng thì cùng một tên. Từ vựng codebase nhỏ lại. |
| Cách lộ lỗi | **Hiện luôn câu sửa** | Công cụ cá nhân dùng hằng ngày; bắt tự đoán trước là thêm ma sát vào chỗ vốn đã tốn 20–40 phút. |
| Lượng lỗi | **Đánh dấu hết, phân hai tầng** | Bài B1 có 30–40 chỗ đáng sửa; gạch hết như nhau thì đỏ lòm và không biết bắt đầu từ đâu. Tầng `error` đậm, `refinement` mờ, cộng ô "sửa ba nhóm này trước". |
| Neo lỗi | **Model trích nguyên văn, server dò offset** | LLM đếm ký tự rất tệ. Đây cũng đúng cách speaking đang làm. |
| `severity` | **Suy ra từ `category`**, không hỏi model | Tầng là thuộc tính cố định của nhãn. Hỏi model chỉ mở đường cho mâu thuẫn `article` + `refinement`. |
| Phạm vi hồ sơ | **Bài gốc đã chấm**, bỏ bản sửa | Bản sửa xuất phát từ chính bài gốc nên đếm cả hai là nhân đôi cùng một lỗi. Nhất quán với quyết định của [spec trang tiến bộ](2026-08-27-progress-page-design.md). |
| Chỗ đặt hồ sơ | **`/progress`**, không phải `/practice` | Theo đúng lập luận spec trang tiến bộ: mở trang để *viết* và mở trang để *soi lại mình* là hai tâm thế khác nhau. |
| Lưu hồ sơ | **Suy ra, không có bảng** | Như `computeStreak` suy từ `submittedAt`. Dữ liệu suy ra được mà lưu riêng là nguồn của bug lệch số. |

## 3. Bộ nhãn

```ts
export type MarkSeverity = "error" | "refinement";

export type MarkCategory =
  // Tầng "error" — sai thật sự
  | "article" | "verb-tense" | "subject-verb-agreement" | "noun-number"
  | "preposition" | "word-order" | "word-form" | "spelling"
  | "punctuation" | "sentence-structure" | "pronoun"
  // Tầng "refinement" — đúng ngữ pháp nhưng chưa tự nhiên
  | "word-choice" | "register";
```

Chọn theo lỗi đặc trưng của người Việt học tiếng Anh: mạo từ, số nhiều, thì, trật tự từ chiếm phần lớn.

**Cố ý không có nhãn "dài dòng"** — `complex-phrase` và `qualifier` của rule engine đã lo. Thêm nhãn nữa là hai hệ thống giẫm chân nhau trên cùng một đoạn văn.

Thứ tự khai báo trong `MARK_CATEGORIES` cũng là thứ tự phá hoà khi hai nhãn cùng số lần, nên phải ổn định.

## 4. Data model

Một cột trên `PracticeAttempt`, không bảng mới:

```prisma
/// WritingMark[] — null khi bóc lỗi thất bại; [] khi bài không có lỗi nào.
marks Json?
```

Phân biệt `null` với `[]` là có chủ đích: "chưa bóc được" và "bài sạch lỗi" phải hiện khác nhau.

```ts
/** Những gì model trả về. Chỉ tồn tại trong lúc xử lý, không lưu. */
interface RawWritingMark {
  quote: string;
  occurrence: number;   // 1-based, cho đoạn lặp lại nhiều lần
  category: MarkCategory;
  correction: string;
  note: string;
}

/** Những gì lưu và vẽ. Cùng hình dạng span với Highlight của analysis. */
export interface WritingMark {
  start: number;   // inclusive
  end: number;     // exclusive
  category: MarkCategory;
  severity: MarkSeverity;
  correction: string;
  note: string;
}
```

`note` thay vì `explain` để khớp `SpeakingMark`.

## 5. Định vị quote — tách một primitive dùng chung

`apps/api/src/speaking/locate-marks.ts` đã dò quote → offset. Writing cần thêm `occurrence`. Viết bản thứ hai là nhân đôi một thứ tinh tế (bỏ im lặng khi không khớp, offset inclusive/exclusive).

Rút ra `apps/api/src/common/locate-quote.ts`:

```ts
/** Vị trí lần xuất hiện thứ `occurrence` (1-based) của `quote`, hoặc null. */
export function locateQuote(
  text: string,
  quote: string,
  occurrence?: number,
): { start: number; end: number } | null;
```

`locateMarks` của speaking gọi nó với `occurrence` bỏ trống → lần đầu tiên, **đúng hành vi hiện tại**. Test speaking phải xanh nguyên mà không sửa dòng nào. Mỗi bên giữ phần validate riêng: speaking lọc `kind`, writing lọc `category` và bỏ span trùng.

### Xử lý khi phân giải hỏng

| Tình huống | Xử lý |
|---|---|
| `quote` không có trong bài (model diễn giải lại thay vì trích) | Bỏ mark đó, giữ phần còn lại |
| `occurrence` vượt số lần xuất hiện thật | Bỏ mark đó |
| `quote` rỗng hoặc chỉ khoảng trắng | Bỏ mark đó |
| `category` ngoài bộ nhãn | Bỏ mark đó (schema có enum, vẫn kiểm lại ở server) |
| Hai mark trùng span hoàn toàn | Giữ cái đầu tiên |

Bỏ im lặng, không báo cho người dùng: mất một dấu gạch tốt hơn hỏng cả màn kết quả. Đây cũng đúng tinh thần "marks are best-effort" mà speaking đã ghi.

## 6. Backend

### `submit()` — thêm một lời gọi song song

`submit()` hiện đã phức tạp: grading lock, hai nhánh chấm (gốc / revision), vocab `markUsed`, quota. Bản này chèn tối thiểu — thêm lời gọi bóc lỗi **song song** với lời gọi chấm sẵn có:

| Lời gọi | Bắt buộc? | Hỏng thì sao |
|---|---|---|
| Chấm điểm (`grade-prompt` hoặc `revision-grade-prompt`, **không sửa**) | Có | Như hiện tại |
| Bóc lỗi (`mark-prompt` mới, `json_schema` enum khoá cứng 13 nhãn) | Không | `marks` không được ghi; band và feedback vẫn lưu |

Tách riêng thay vì gộp vào prompt chấm: prompt chấm đã ổn định và có test, và một model rẻ làm hai việc trong một lượt thường kém ở cả hai. Chạy song song nên không chậm thêm; timeout và quota đã có sẵn trong `AiService.complete()`.

Bản sửa cũng được bóc lỗi — nó là bài viết thật. Chỉ hồ sơ mới loại bản sửa (mục 7).

### Module mới, theo nếp `progress` và `vocab`

| Method | Route | Việc |
|---|---|---|
| GET | `/practice/mistakes` | Trả `MistakeProfile` gộp từ các bài gốc gần nhất |

`mistakes.controller.ts` + `mistakes.service.ts`, đúng khuôn `progress.controller.ts` / `vocab.controller.ts` — mỗi mối quan tâm một controller base path riêng, không nhét route vào `practice/attempts` (ở đó đã có `@Get(":id")`, thêm route tĩnh cạnh nó là phụ thuộc thứ tự khai báo).

Server tính hồ sơ rồi trả, thay vì đẩy `marks` đầy đủ của 10 bài xuống client: hai màn tiêu thụ chỉ cần nhãn và số đếm. `GET /practice/attempts` (danh sách) **không** kèm `marks`, giữ payload gọn đúng tinh thần hardening.

`AiService` vẫn là cổng OpenRouter thuần — prompt và schema nằm trong `PracticeModule`, như `grade-prompt.ts` và `generate-prompt.ts`.

## 7. Hồ sơ lỗi hay lặp

Hàm thuần ở `packages/practice`, cạnh `computeStreak`. Không biết React, HTTP hay Prisma.

```ts
export interface AttemptMarkInput {
  marks: WritingMark[];
  wordCount: number;
  submittedAt: Date;
}

export interface MarkTally {
  category: MarkCategory;
  count: number;
  /** null khi chưa đủ bài để nói được xu hướng. */
  trend: "down" | "flat" | "up" | null;
}

export interface MistakeProfile {
  tallies: MarkTally[];        // sắp theo count giảm dần
  attemptsConsidered: number;
}

summarizeMarks(attempts: AttemptMarkInput[]): MistakeProfile
focusCategories(marks: WritingMark[], limit?: number): MarkCategory[]
```

`summarizeMarks` tự sắp theo `submittedAt` và tự cắt cửa sổ — caller không phải nhớ tiền điều kiện nào.

| Hằng số | Giá trị | Lý do |
|---|---|---|
| `PROFILE_WINDOW` | 10 bài gốc đã chấm gần nhất | Đủ gần để phản ánh trình độ hiện tại, đủ nhiều để có nghĩa |
| `MIN_OCCURRENCES` | 2 | Một lần là tai nạn, không phải pattern |
| `MIN_ATTEMPTS_FOR_TREND` | 4 | Dưới mức này chia đôi cửa sổ vô nghĩa |

### Xu hướng

Chuẩn hoá theo **lỗi trên 100 từ** — không chuẩn hoá thì viết bài dài hơn trông như đang tệ đi. Chia cửa sổ làm nửa cũ / nửa mới theo `submittedAt`; số bài lẻ thì bài giữa thuộc **nửa mới** (thiên về hiện tại).

- `down` khi tỉ lệ mới < 0.75 × tỉ lệ cũ
- `up` khi tỉ lệ mới > 1.33 × tỉ lệ cũ
- `flat` ở giữa

Hai ngưỡng lệch nhau để dao động nhỏ không bị đọc thành xu hướng. Tỉ lệ nửa cũ bằng 0 mà nửa mới khác 0 → `up`; cả hai bằng 0 thì nhãn đó không lọt vào `tallies` ngay từ đầu.

### `focusCategories`

Ba nhãn nhiều nhất **trong riêng bài này**, chỉ tầng `error` — bảo người học lo chuyện dùng từ chưa hay trong khi còn sai ngữ pháp là sai thứ tự. Đồng hạng theo thứ tự taxonomy.

Cố ý **không** dính tới hồ sơ tái diễn: màn kết quả nói về bài vừa viết, `/progress` nói về xu hướng dài hạn. Trộn vào nhau thì màn kết quả phải tải thêm dữ liệu chỉ để sắp lại ba dòng.

## 8. Web

### Màn kết quả — hai lăng kính

Toggle `Mistakes` / `Style`, mặc định `Mistakes`.

Vẽ cả gạch lỗi lẫn nền Hemingway lên cùng một bài vừa rối vừa **mâu thuẫn**: Hemingway thưởng câu ngắn, IELTS *Grammatical Range* thưởng câu phức. Tách hai lăng kính giải quyết luôn mâu thuẫn đó thay vì phải hoà giải nó trên một canvas.

| Tầng | Kiểu vẽ |
|---|---|
| `error` | Gạch sóng, `--color-vermilion` |
| `refinement` | Gạch chấm mảnh, `--color-ink-faint` |

Gạch chân chứ không phải nền màu — nền màu đã là ngôn ngữ của highlight văn phong; dùng lại sẽ khiến hai thứ khác hẳn nhau trông giống nhau. CSS Custom Highlight API hỗ trợ `text-decoration`, nên vẫn không chèn thẻ nào vào DOM.

Click vào span → thẻ hiện nhãn, câu sửa, giải thích. Dùng lại `highlight-hit.ts` sẵn có. Bài đã nộp là read-only nên thẻ không có nút Apply.

Sidebar thêm ô **`Fix these first`** — ba nhãn từ `focusCategories()`. Ba trạng thái, phân biệt rõ:

| `marks` | Hiện gì |
|---|---|
| `null` (bóc lỗi hỏng) | Ẩn hẳn ô, và lăng kính mặc định lùi về `Style` — không có gì để xem ở `Mistakes` |
| `[]` (bài sạch lỗi) | Một dòng ghi nhận, không phải ô rỗng |
| có mark | Ba nhãn, đánh số |

### Phòng sửa bài

Nạp mark của **bài gốc** khi đang sửa, click xem được câu sửa. Không có thì người học phải nhớ lỗi từ màn kết quả rồi lật qua lại — đúng kiểu ma sát làm người ta bỏ cuộc.

`ExamRoom` đã fetch sẵn parent attempt cho revision (`getAttempt(attempt.parentAttemptId)`), nên dữ liệu đã có mặt.

### `/progress`

Mục `Recurring`: nhãn, số lần, mũi tên xu hướng, tối đa 5 dòng. Chưa có pattern nào thì ẩn hẳn mục — ô rỗng nói "chưa đủ dữ liệu" chỉ làm trang ồn thêm.

### Phòng thi

Cuối panel đề bài, một dòng lặng lẽ: *"Watch for: articles, verb tense"* — ba nhãn đầu của `GET /practice/mistakes`. Hồ sơ rỗng (chưa đủ bài, hoặc chưa nhãn nào lặp 2 lần) thì không hiện dòng nào.

Luôn hiện, **không gate như hints**. Hints bị gate vì đưa từ vựng trước khi viết là đang test "dùng được từ cho sẵn không" thay vì "vốn từ tới đâu". Nhắc lỗi thì khác: nó nói về điểm yếu của chính người viết, không tiết lộ gì về nội dung bài, nên không làm hỏng tính khách quan.

### Refactor có chủ đích: painter theo lớp

`paintHighlights()` hardcode `ALL_TYPES` là danh sách type của `packages/analysis` và chỉ nhận `Highlight[]`. Việc thật của nó là *"cho một text index và tập span có (start, end, layer), vẽ chúng lên"* — không cần biết span đến từ rule engine hay từ model.

Tổng quát hoá thành vẽ theo **lớp**, hai lăng kính dùng chung một painter. File này không ai đụng suốt tuần qua nên refactor an toàn.

Painter của speaking (`speaking-highlights.ts`) **giữ nguyên**: nó vẽ lên một text node thuần, không có Lexical và không có `TextIndex`. Chất liệu khác nhau thì hai painter là chính đáng, không phải trùng lặp cần dọn.

## 9. Ràng buộc module

- `packages/analysis` **không đổi một dòng**.
- `packages/practice` giữ nguyên tính chất: chỉ danh mục và hàm thuần. `MarkCategory`, `WritingMark`, `summarizeMarks`, `focusCategories` đặt ở đây vì cả web lẫn api đều cần.
- `grade-prompt.ts` và `revision-grade-prompt.ts` **không sửa**; test chấm điểm hiện có phải xanh mà không sửa file test.
- `locateMarks` của speaking đổi phần ruột sang `locateQuote` nhưng **hành vi không đổi**; test speaking xanh nguyên.
- `AiService` vẫn không biết bóc lỗi là gì.

## 10. Testing

| Package | Trọng tâm |
|---|---|
| `packages/practice` | `summarizeMarks` làm **TDD**: rỗng, một bài, đồng hạng, dưới `MIN_OCCURRENCES`, dưới `MIN_ATTEMPTS_FOR_TREND`, xu hướng hai chiều, chuẩn hoá theo độ dài bài, số bài lẻ. `focusCategories`: bỏ tầng `refinement`, đồng hạng theo taxonomy, ít hơn ba nhãn |
| `apps/api` | `locateQuote`: occurrence, không tìm thấy, chuỗi rỗng. Phân giải mark: category lạ, span trùng. E2E: submit trả `marks`; bóc lỗi hỏng vẫn lưu band; `/practice/mistakes` chặn khi chưa đăng nhập và gộp đúng. **Test speaking và test chấm điểm xanh nguyên, không sửa** |
| `apps/web` | Painter sau khi tổng quát hoá vẫn vẽ đúng highlight cũ (hồi quy). Toggle hai lăng kính. Thẻ lỗi hiện đúng nội dung. `Fix these first`. Mục `Recurring` ẩn khi chưa đủ dữ liệu |

## 11. Rủi ro đã biết

- **Model trích không đúng nguyên văn.** Rủi ro chính: model hay "sửa nhẹ" đoạn trích thay vì copy nguyên. Giảm bằng chỉ dẫn rõ trong prompt và bỏ im lặng khi không khớp. Nếu tỉ lệ rơi cao thì cân nhắc dò gần đúng (chuẩn hoá khoảng trắng, bỏ phân biệt hoa thường) — nhưng chỉ sau khi đo thật, không làm phòng xa.
- **Chi phí.** Mỗi lần nộp giờ tốn hai lời gọi thay vì một; phần bóc lỗi tốn output token đáng kể (~40 token mỗi mark). Đo trên một bài 300 từ trước khi làm tiếp UI. Quota ngày (`AI_DAILY_QUOTA`) đã có nên không có nguy cơ cháy tiền im lặng.
- **Model rẻ bóc lỗi không ổn định.** Cùng bài, hai lần chấm có thể ra hai tập lỗi khác nhau. Chấp nhận được với hồ sơ tích luỹ (nhiễu tự triệt tiêu qua nhiều bài); nếu lệch quá lớn thì tách model riêng cho việc bóc lỗi, theo nếp `AI_MODEL_AUDIO` đã có.
- **`text-decoration` trong `::highlight()`.** Được spec hỗ trợ nhưng ít dùng. Safari không vẽ gạch sóng thì đổi `error` sang nền `--color-vermilion-soft`, giữ `refinement` gạch chấm — vẫn phân biệt được hai tầng.
