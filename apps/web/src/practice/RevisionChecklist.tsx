import { MARK_LABELS, countHandled, markKey, type WritingMark } from "@writing-helper/practice";
import { useState } from "react";

/**
 * Việc cần sửa trong phòng sửa bài. Không có gì định vị bằng offset ở đây, nên
 * không có gì lệch được khi người học bắt đầu gõ — đó là cả lý do danh sách
 * này thay cho việc gạch chân trên bài đang sửa.
 *
 * Dòng đã xử lý giữ nguyên vị trí thay vì dồn xuống cuối: thứ tự theo vị trí
 * trong bài chính là thứ giúp dò theo văn bản.
 */
export function RevisionChecklist({
  marks,
  parentPlainText,
  handled,
  onToggle,
}: {
  marks: WritingMark[];
  parentPlainText: string;
  handled: string[];
  onToggle: (key: string) => void;
}) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  if (marks.length === 0) return null;

  const done = new Set(handled);
  const counted = countHandled(marks, handled);

  return (
    <section className="mt-8 border-t border-rule pt-6">
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-vermilion">
        To fix · {counted.handled}/{counted.total}
      </h2>
      <ul className="mt-3 space-y-3">
        {marks.map((mark) => {
          const key = markKey(mark);
          const quote = parentPlainText.slice(mark.start, mark.end);
          const isDone = done.has(key);

          return (
            <li key={key} className={isDone ? "opacity-50" : ""}>
              <div className="flex items-baseline gap-2">
                <input
                  type="checkbox"
                  aria-label={quote}
                  checked={isDone}
                  onChange={() => onToggle(key)}
                  className="mt-1 accent-vermilion"
                />
                <button
                  type="button"
                  onClick={() => setOpenKey(openKey === key ? null : key)}
                  aria-expanded={openKey === key}
                  className="flex-1 text-left text-sm leading-snug"
                >
                  <span className={isDone ? "line-through" : ""}>{quote}</span>
                  <span className="text-ink-faint"> → </span>
                  <span className="font-display">{mark.correction}</span>
                  <span className="mt-0.5 block font-mono text-[0.6rem] uppercase tracking-[0.12em] text-ink-faint">
                    {MARK_LABELS[mark.category]}
                  </span>
                </button>
              </div>
              {openKey === key && (
                <p className="mt-1 pl-6 text-sm leading-snug text-ink-soft">{mark.note}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
