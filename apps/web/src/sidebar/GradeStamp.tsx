import type { GradeLabel } from "@writing-helper/analysis";

const TONE: Record<GradeLabel, string> = {
  Good: "text-ink",
  OK: "text-ink",
  Poor: "text-vermilion",
};

interface GradeStampProps {
  grade: number;
  label: GradeLabel;
  size?: "sm" | "lg";
}

/**
 * Con dấu của biên tập viên: khung đôi, chữ display, đóng hơi nghiêng — dùng ở
 * cả sidebar (đang viết) và danh sách bản thảo (đã lưu), nên tách riêng thay
 * vì lặp lại style hai nơi.
 */
export function GradeStamp({ grade, label, size = "lg" }: GradeStampProps) {
  const isLarge = size === "lg";

  return (
    <div
      className={`stamp animate-stamp-in inline-flex -rotate-2 flex-col items-center border-2 border-double border-vermilion ${
        isLarge ? "px-5 py-3" : "px-3 py-1.5"
      }`}
    >
      <span
        className={`font-display font-semibold leading-none ${isLarge ? "text-3xl" : "text-base"}`}
      >
        Grade {grade}
      </span>
      <span
        className={`font-mono uppercase tracking-[0.2em] ${TONE[label]} ${
          isLarge ? "mt-1 text-[0.7rem]" : "mt-0.5 text-[0.55rem]"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
