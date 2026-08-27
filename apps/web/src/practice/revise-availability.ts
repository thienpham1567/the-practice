export type ReviseAttempt = {
  band: number | null;
  submittedAt: string | Date | null;
  revisionRound: number;
  /** True when a child attempt already points at this one. Defaults to false. */
  hasRevision?: boolean;
};

/** Whether the result UI may offer “Sửa lại bài này”. */
export function canRevise(attempt: ReviseAttempt): boolean {
  return (
    attempt.band != null &&
    attempt.submittedAt != null &&
    attempt.revisionRound < 2 &&
    !(attempt.hasRevision ?? false)
  );
}

/** Band change label, e.g. `5.5 → 6.5`. */
export function formatBandDelta(from: number, to: number): string {
  return `${from.toFixed(1)} → ${to.toFixed(1)}`;
}

/** Papers-list chain label, e.g. `5.5 → 6.5 · 2 lần sửa`. */
export function formatChainSummary(
  rootBand: number | null,
  latestBand: number | null,
  revisionCount: number,
): string | null {
  if (revisionCount === 0 || rootBand == null || latestBand == null) return null;
  return `${formatBandDelta(rootBand, latestBand)} · ${revisionCount} lần sửa`;
}
