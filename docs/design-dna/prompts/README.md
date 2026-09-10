# Photographic backgrounds — The Practice

Mỗi trang **hai file**: `light.md` (dán ban ngày) và `dark.md` (dán đêm). Prompt tự chứa — không cần đọc file kia khi generate.

Cùng gia đình analog (giấy kem, gỗ, mực, terracotta hiếm). **Không cùng một phòng.** Thumbnail phải nhận ra trang.

| Light | Dark | Trang | Bối cảnh |
|---|---|---|---|
| [auth/light.md](auth/light.md) | [auth/dark.md](auth/dark.md) | `/login` `/register` | Cửa phòng viết đóng, kệ thư; đêm: sáng khe cửa |
| *(đã có ảnh)* | | Editor `/write` | Bàn cửa sổ căn hộ — không gen lại |
| [drafts/light.md](drafts/light.md) | [drafts/dark.md](drafts/dark.md) | `/docs` | Phòng pigeonhole |
| [practice/light.md](practice/light.md) | [practice/dark.md](practice/dark.md) | `/practice` | Hội trường thi trống |
| [exam/light.md](exam/light.md) | [exam/dark.md](exam/dark.md) | đang viết đề | Carrel một chỗ |
| [result/light.md](result/light.md) | [result/dark.md](result/dark.md) | đã chấm | Phòng chấm, đèn banker |
| [speaking/light.md](speaking/light.md) | [speaking/dark.md](speaking/dark.md) | `/speaking` | Hành lang ngoài booth |
| [talk/light.md](talk/light.md) | [talk/dark.md](talk/dark.md) | `/speaking/:id` | Trong booth |
| [progress/light.md](progress/light.md) | [progress/dark.md](progress/dark.md) | `/progress` | Phòng đọc thư viện |
| [vocab/light.md](vocab/light.md) | [vocab/dark.md](vocab/dark.md) | `/vocab` | Alcove catalog |

## Cách generate

- Model: `bytedance-seed/seedream-5-0-pro` · **16:9 · 2K**
- Dán **nguyên khối** trong đúng file theme.
- **Không** gắn `editor-desk-*.jpg`.
- Dark: gắn output light **của đúng trang** để khớp chỗ + đồ vật.
- Thumbnail giống editor hoặc trang khác → gen lại.
