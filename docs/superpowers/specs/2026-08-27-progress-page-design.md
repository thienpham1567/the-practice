# Trang tiến bộ (/progress) — Design

**Ngày:** 2026-08-27
**Trạng thái:** đã duyệt qua brainstorm

## 1. Vấn đề

Từng bài practice có điểm nhưng không có bức tranh dài hạn. Ba lỗ hổng cụ thể:

1. `BandChart` hiện trộn mọi level vào một đường — B1 6.0 đứng cạnh B2 5.5 trông như tụt điểm dù thực tế là tiến bộ.
2. Không có xu hướng theo **tiêu chí** — `CriteriaBars` chỉ per-bài, không trả lời "Grammar có đang ghìm mình không".
3. `styleSnapshot` chụp mỗi bài nhưng chưa bao giờ được cộng dồn thành xu hướng.

Và câu hỏi người dùng thật sự muốn app trả lời: **"có nên lên level chưa?"**

### Ngoài phạm vi bản này

AI viết nhận xét định kỳ; xuất báo cáo; so sánh với người khác; mục tiêu tuần/tháng tự đặt; thống kê cho documents thường (chỉ practice).

## 2. Các quyết định

| Quyết định | Chọn | Lý do |
|---|---|---|
| Vị trí | **Trang `/progress` riêng**, link từ PracticePage | Mở trang để *viết* và mở trang để *soi lại mình* là hai tâm thế khác nhau. PracticePage giữ gọn. |
| Gợi ý lên level | **Luật cố định**, không AI | Xác định, giải thích được, test được, không tốn token. Ngưỡng là hằng số dễ chỉnh. |
| Nguồn dữ liệu | **Endpoint tổng hợp `GET /practice/progress`** | Giữ `list()` gọn đúng tinh thần hardening 4.1 — không nhét `scores`/`styleSnapshot` ngược vào LIST_FIELDS. Một round trip, payload vài KB. |
| Chỗ đặt luật level-up | **Web, module thuần `level-up.ts`** | Theo nếp `exam-math.ts`/`band-chart.ts`: endpoint trả dữ liệu câm, luật nằm nơi dễ test. |
| Phạm vi dữ liệu | Bài **gốc** (không tính bản sửa), **đã chấm**, **90 ngày** gần nhất | Nhất quán với ngữ nghĩa biểu đồ đã chốt ở spec vòng sửa: so sánh công bằng giữa các ngày bằng band lần viết đầu. |

## 3. API

### `GET /practice/progress` (JwtAuthGuard, chỉ đọc, không AI)

```ts
{
  series: Array<{
    at: string;                 // submittedAt
    level: "A2" | "B1" | "B2" | "C1";
    band: number;
    scores: { task: number; coherence: number; lexical: number; grammar: number };
    /// Quy về trên-100-từ từ styleSnapshot; null nếu snapshot thiếu/hỏng.
    per100: { passives: number; adverbs: number } | null;
  }>,
  streak: { current: number; submittedDates: string[] }
}
```

Server chỉ lọc và quy đổi — không phán xét gì. Snapshot thiếu trường → `per100: null`, không ném lỗi.

## 4. Luật level-up (`apps/web/src/practice/level-up.ts`)

- Xét level luyện **nhiều nhất trong 30 ngày** qua.
- **5 bài gần nhất** ở level đó có band `≥ 6.5` **và** không tiêu chí nào `< 6.0` → gợi ý thử level trên.
- Chưa đủ 5 bài ở level đó → chưa phán. Đang ở C1 → không có gợi ý.
- `BAND_THRESHOLD`, `CRITERION_FLOOR`, `WINDOW_SIZE` là hằng số đầu file.

## 5. Trang `/progress` (RequireAuth)

Bốn khối, ngôn ngữ Folio hiện có:

1. **Band theo thời gian** — mỗi level một đường màu mực riêng, tái dùng `chartDots`; chú giải level.
2. **Bốn tiêu chí** — sparkline nhỏ mỗi tiêu chí + nhãn "yếu nhất 30 ngày" (trung bình thấp nhất).
3. **Xu hướng style** — passive và adverb trên-100-từ theo thời gian.
4. **Gợi ý level-up** — hộp kiểu con dấu, chỉ hiện khi luật thoả, kèm một dòng giải thích tại sao ("5 bài B1 gần nhất đều ≥ 6.5"). Không thoả → không hiện gì, không hiện "chưa đủ điều kiện".

`PracticePage` thêm link "Xem tiến bộ →".

## 6. Testing

- **Service (unit):** lọc đúng (bỏ bản sửa, bỏ chưa chấm, cắt 90 ngày); quy per-100-từ đúng; snapshot thiếu → null; user không dữ liệu → mảng rỗng.
- **`level-up.ts` (unit, thuần):** đủ/thiếu bài; band đạt nhưng dính tiêu chí thấp; C1; đổi level giữa chừng (level nhiều nhất 30 ngày); đúng biên `≥`.
- **E2E:** chỉ thấy dữ liệu của mình; shape payload đúng.
- **Web (component):** 4 khối với dữ liệu rỗng / ít (1 bài) / nhiều level; hộp level-up hiện đúng điều kiện.
