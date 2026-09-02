import { MARK_LABELS, type WritingMark } from "@writing-helper/practice";
import { shouldFlipBelow } from "./anchor-position";

/**
 * Mở ra khi bấm vào một chỗ gạch dưới ở lăng kính lỗi: tên nhóm lỗi, câu sửa,
 * rồi một dòng giải thích. Câu sửa đứng trước lời giải thích vì đó là thứ
 * người học cần trước — giải thích là để hiểu, không phải để đoán.
 */
export function MistakeCard({ pick }: { pick: { mark: WritingMark; x: number; y: number } }) {
  // Gạch nằm sát đỉnh khung thì bung lên trên sẽ bị toolbar che — lật xuống.
  const flipBelow = shouldFlipBelow(pick.y);

  return (
    <div
      role="dialog"
      aria-label="Mistake"
      className={`absolute z-20 max-w-72 -translate-x-1/2 rounded-sm border border-rule bg-paper px-3 py-2 shadow-[0_6px_20px_-8px_rgba(31,28,24,0.4)] ${
        flipBelow ? "" : "-translate-y-full"
      }`}
      style={{ left: pick.x, top: pick.y + (flipBelow ? 14 : -10) }}
    >
      <p className="font-mono text-[0.7rem] uppercase tracking-wider text-vermilion">
        {MARK_LABELS[pick.mark.category]}
      </p>
      <p className="mt-1 font-display text-base leading-snug">{pick.mark.correction}</p>
      <p className="mt-1 text-sm leading-snug text-ink-soft">{pick.mark.note}</p>
    </div>
  );
}
