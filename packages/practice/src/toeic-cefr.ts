export type CefrEstimate = "A1" | "A2" | "B1" | "B2" | "C1";
export type ToeicSkill = "speaking" | "writing";

const CUTS: Record<ToeicSkill, Array<{ min: number; level: CefrEstimate }>> = {
  speaking: [
    { min: 180, level: "C1" },
    { min: 160, level: "B2" },
    { min: 120, level: "B1" },
    { min: 90, level: "A2" },
    { min: 50, level: "A1" },
  ],
  writing: [
    { min: 180, level: "C1" },
    { min: 150, level: "B2" },
    { min: 120, level: "B1" },
    { min: 70, level: "A2" },
    { min: 30, level: "A1" },
  ],
};

export function cefrFromScaled(
  scaled: number,
  skill: ToeicSkill,
): CefrEstimate | null {
  for (const row of CUTS[skill]) {
    if (scaled >= row.min) return row.level;
  }
  return null;
}
