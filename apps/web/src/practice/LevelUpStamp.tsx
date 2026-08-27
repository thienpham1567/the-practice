import type { LevelUpVerdict } from "./level-up";

interface LevelUpStampProps {
  verdict: LevelUpVerdict;
}

/** Rubber-stamp chrome when the level-up rule fires — hidden otherwise by the caller. */
export function LevelUpStamp({ verdict }: LevelUpStampProps) {
  return (
    <section aria-label="Level-up suggestion" className="flex justify-center">
      <div className="stamp animate-stamp-in inline-flex -rotate-2 flex-col items-center border-2 border-double border-vermilion px-6 py-4 text-center">
        <span className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-vermilion">
          Ready to try
        </span>
        <span className="mt-1 font-display text-3xl font-semibold leading-none">{verdict.suggest}</span>
        <p className="mt-2 max-w-xs text-sm leading-snug text-ink-soft">{verdict.reason}</p>
      </div>
    </section>
  );
}
