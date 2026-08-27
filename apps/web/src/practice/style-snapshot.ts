export interface StyleSnapshotView {
  passives: number;
  adverbs: number;
  average: number | null;
}

/**
 * Chuẩn hoá snapshot phân tích (có thể thiếu trường từ DB) thành shape UI dùng được.
 * average = null khi không đủ words/sentences — không bịa số, không NaN.
 */
export function readStyleSnapshot(raw: unknown): StyleSnapshotView {
  if (!raw || typeof raw !== "object") {
    return { passives: 0, adverbs: 0, average: null };
  }

  const snapshot = raw as Record<string, unknown>;
  const counts =
    snapshot.counts && typeof snapshot.counts === "object"
      ? (snapshot.counts as Record<string, unknown>)
      : null;
  const stats =
    snapshot.stats && typeof snapshot.stats === "object"
      ? (snapshot.stats as Record<string, unknown>)
      : null;

  const passives = asCount(counts?.passives);
  const adverbs = asCount(counts?.adverbs);
  const words = asFiniteNumber(stats?.words);
  const sentences = asFiniteNumber(stats?.sentences);

  if (words == null || sentences == null || sentences === 0) {
    return { passives, adverbs, average: null };
  }

  return {
    passives,
    adverbs,
    average: Math.round((words / sentences) * 10) / 10,
  };
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asCount(value: unknown): number {
  return asFiniteNumber(value) ?? 0;
}
