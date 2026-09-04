import type { CSSProperties } from "react";
import { useInView } from "./use-in-view";

/**
 * Chữ vào theo từng dòng, lệch nhau 70ms.
 *
 * Câu gốc giữ nguyên một khối trong `.sr-only` cho máy đọc màn hình; bản tách
 * dòng để animate thì `aria-hidden`. Bỏ qua chỗ này là máy đọc phát ra từng
 * mảnh rời rạc — lỗi mà phần lớn hiệu ứng kiểu này mắc phải.
 */
export function RevealLines({
  lines,
  className = "",
  as: Tag = "p",
}: {
  lines: string[];
  className?: string;
  as?: "h1" | "h2" | "p";
}) {
  const ref = useInView<HTMLElement>();

  return (
    <Tag ref={ref as never} className={className}>
      <span className="sr-only">{lines.join(" ")}</span>
      <span aria-hidden="true" className="reveal-lines block">
        {lines.map((line, index) => (
          <span
            key={line}
            data-line
            className="block"
            style={{ "--line-index": index } as CSSProperties}
          >
            {line}
          </span>
        ))}
      </span>
    </Tag>
  );
}
