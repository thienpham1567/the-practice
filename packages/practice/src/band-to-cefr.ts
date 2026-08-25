import type { Level } from "./types.js";

export function bandToCefr(band: number): Level {
  if (band < 4) return "A2";
  if (band <= 5) return "B1";
  if (band <= 6.5) return "B2";
  return "C1";
}
