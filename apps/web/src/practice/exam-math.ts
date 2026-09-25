const MS_PER_DAY = 86_400_000;

function utcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** Oldest → newest: whether that calendar day has a submitted attempt. */
export function lastFourteenDays(submittedDates: Date[], now: Date = new Date()): boolean[] {
  const days = new Set(submittedDates.map(utcDay));
  const today = utcDay(now);

  return Array.from({ length: 14 }, (_, index) => {
    const day = today - (13 - index) * MS_PER_DAY;
    return days.has(day);
  });
}

export function remainingSecondsFromDuration(
  startedAt: Date,
  timeSeconds: number,
  now: Date = new Date(),
): number {
  const deadline = startedAt.getTime() + timeSeconds * 1000;
  return Math.max(0, Math.round((deadline - now.getTime()) / 1000));
}

export function remainingSeconds(startedAt: Date, timeMinutes: number, now: Date = new Date()): number {
  return remainingSecondsFromDuration(startedAt, timeMinutes * 60, now);
}

export function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

/**
 * Câu cho live region của đồng hồ. Chỉ đổi ở vài mốc, để trình đọc màn hình
 * báo đúng lúc cần thay vì đọc từng giây.
 */
export function timeWarning(remaining: number, totalSeconds: number): string {
  if (remaining <= 0) return "Time is up. You can still submit.";
  if (remaining <= 60 && totalSeconds > 60) return "One minute left.";
  if (remaining <= 300 && totalSeconds > 300) return "Five minutes left.";
  return "";
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function wordCountTone(count: number, minWords: number): "under" | "met" {
  return count < minWords ? "under" : "met";
}
