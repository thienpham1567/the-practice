/** Practice TOEIC scaled 0–200 in steps of 10. Not an official ETS conversion. */
export function practiceScaled(raw: number, maxRaw: number): number {
  if (maxRaw <= 0 || raw <= 0) return 0;
  const ratio = Math.min(raw, maxRaw) / maxRaw;
  return Math.round(ratio * 20) * 10;
}
