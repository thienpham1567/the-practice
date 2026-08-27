import type { FeedbackAuditItem, FeedbackAuditStatus } from "../api/practice";

const MARKER: Record<FeedbackAuditStatus, { symbol: string; className: string }> = {
  resolved: { symbol: "✓", className: "text-ink" },
  partial: { symbol: "±", className: "text-ink-soft" },
  unresolved: { symbol: "✗", className: "text-vermilion" },
};

export function FeedbackAuditList({ items }: { items: FeedbackAuditItem[] }) {
  return (
    <ul className="mt-4 space-y-2">
      {items.map((item) => {
        const marker = MARKER[item.status];
        return (
          <li
            key={`${item.status}:${item.point}`}
            className={`flex gap-2 text-sm leading-relaxed ${marker.className}`}
          >
            <span aria-hidden className="shrink-0 font-mono">
              {marker.symbol}
            </span>
            <span>{item.point}</span>
          </li>
        );
      })}
    </ul>
  );
}
