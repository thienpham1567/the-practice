import type { AnalysisResult } from "@writing-helper/analysis";
import type { Level } from "@writing-helper/practice";
import { readStyleSnapshot } from "./style-snapshot";

interface StyleProfileProps {
  snapshot: AnalysisResult;
  level: Level;
}

/**
 * Neutral profile, not a Hemingway "fix this" list.
 * Passive and spare adverbs stay as real faults; sentence length is descriptive.
 */
export function StyleProfile({ snapshot, level }: StyleProfileProps) {
  const { passives, adverbs, average } = readStyleSnapshot(snapshot);

  return (
    <section>
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Style notes
      </h2>

      <ul className="mt-3 space-y-2 text-sm leading-relaxed">
        <li className={passives > 0 ? "text-vermilion" : "text-ink-soft"}>
          {passives === 0
            ? "No passive constructions stood out."
            : `${passives} passive ${passives === 1 ? "construction" : "constructions"}.`}
        </li>
        <li className={adverbs > 0 ? "text-vermilion" : "text-ink-soft"}>
          {adverbs === 0
            ? "No spare adverbs."
            : `${adverbs} spare ${adverbs === 1 ? "adverb" : "adverbs"}.`}
        </li>
        {average !== null ? (
          <li className="text-ink-soft">
            Average {average} words a sentence — {sentenceFit(average, level)}.
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function sentenceFit(average: number, level: Level): string {
  const typical: Record<Level, [number, number]> = {
    A2: [8, 14],
    B1: [12, 18],
    B2: [15, 22],
    C1: [16, 24],
  };
  const [low, high] = typical[level];
  if (average < low) return `on the short side for ${level}`;
  if (average > high) return `longer than most ${level} scripts`;
  return `a fit for ${level}`;
}
