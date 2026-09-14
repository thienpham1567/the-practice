import type { FeedbackAuditStatus, RevisionAudit } from "../api/practice";

const MARKER: Record<FeedbackAuditStatus, { symbol: string; className: string }> = {
  resolved: { symbol: "✓", className: "text-ink" },
  partial: { symbol: "±", className: "text-ink-soft" },
  unresolved: { symbol: "✗", className: "text-vermilion" },
};

/**
 * `criteria` is the AI's narrative read on the four criteria — useful but a
 * paraphrase, so it can be wrong about a specific mistake. `marksResolution`
 * is a plain string check computed server-side (does the old mistake's exact
 * text still appear?) so it cannot hallucinate; shown separately so a stale
 * claim in `criteria` never overrides what actually changed in the text.
 */
export function FeedbackAuditList({ audit }: { audit: RevisionAudit }) {
  return (
    <>
      {audit.criteria.length > 0 && (
        <ul className="mt-4 space-y-2">
          {audit.criteria.map((item) => {
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
      )}
      {audit.marksResolution.length > 0 && (
        <ul className="mt-4 space-y-1.5">
          {audit.marksResolution.map((item) => {
            const marker = item.resolved ? MARKER.resolved : MARKER.unresolved;
            return (
              <li
                key={`${item.category}:${item.quote}`}
                className={`flex gap-2 font-mono text-[0.7rem] leading-relaxed ${marker.className}`}
              >
                <span aria-hidden className="shrink-0">
                  {marker.symbol}
                </span>
                <span className="lowercase">{item.quote}</span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
