export type ReviseAttempt = {
  band: number | null;
  submittedAt: string | Date | null;
  revisionRound: number;
  /** True when a child attempt already points at this one. Defaults to false. */
  hasRevision?: boolean;
  /** Unsubmitted child revision id, when one exists. Defaults to null. */
  pendingRevisionId?: string | null;
};

export type ReviseAction =
  | { kind: "revise" }
  | { kind: "resume"; attemptId: string }
  | { kind: "none" };

/**
 * What the result UI should offer for this attempt:
 * - revise: no child yet → start a new revision
 * - resume: unsubmitted child exists → open that attempt
 * - none: max rounds, or a submitted child already closes the slot
 */
export function reviseAction(attempt: ReviseAttempt): ReviseAction {
  if (attempt.band == null || attempt.submittedAt == null) {
    return { kind: "none" };
  }

  if (attempt.pendingRevisionId) {
    return { kind: "resume", attemptId: attempt.pendingRevisionId };
  }

  if (attempt.revisionRound >= 2 || (attempt.hasRevision ?? false)) {
    return { kind: "none" };
  }

  return { kind: "revise" };
}

/** Whether the result UI may offer “Revise this paper” (not resume). */
export function canRevise(attempt: ReviseAttempt): boolean {
  return reviseAction(attempt).kind === "revise";
}

/** Band change label, e.g. `5.5 → 6.5`. */
export function formatBandDelta(from: number, to: number): string {
  return `${from.toFixed(1)} → ${to.toFixed(1)}`;
}

/** Papers-list chain label, e.g. `5.5 → 6.5 · 2 revisions`. */
export function formatChainSummary(
  rootBand: number | null,
  latestBand: number | null,
  revisionCount: number,
): string | null {
  if (revisionCount === 0 || rootBand == null || latestBand == null) return null;
  const revisionsLabel = revisionCount === 1 ? "1 revision" : `${revisionCount} revisions`;
  return `${formatBandDelta(rootBand, latestBand)} · ${revisionsLabel}`;
}
