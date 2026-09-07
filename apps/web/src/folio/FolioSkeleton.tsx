interface FolioSkeletonProps {
  rows?: number;
  label: string;
}

/** Hairline rows that match a folio list while data is in flight. */
export function FolioSkeleton({ rows = 4, label }: FolioSkeletonProps) {
  return (
    <div className="mt-4" role="status" aria-live="polite" aria-label={label}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="divide-y divide-rule">
        {Array.from({ length: rows }, (_, index) => (
          <div key={index} className="py-4">
            <div className="h-5 w-2/5 bg-paper-deep" />
            <div className="mt-2 h-3 w-1/4 bg-paper-edge" />
          </div>
        ))}
      </div>
    </div>
  );
}
