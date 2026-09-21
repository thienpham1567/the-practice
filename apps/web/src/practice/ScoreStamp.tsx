interface ScoreStampProps {
  estimatedScaled: number;
  rawRating: number;
  maxRaw: number;
  cefrEstimate?: string | null;
  size?: "sm" | "lg";
}

/** Rubber-stamp chrome for a TOEIC practice scaled score — not an official ETS score. */
export function ScoreStamp({
  estimatedScaled,
  rawRating,
  maxRaw,
  cefrEstimate,
  size = "lg",
}: ScoreStampProps) {
  const isLarge = size === "lg";

  return (
    <div
      className={`stamp animate-stamp-in inline-flex -rotate-2 flex-col items-center border-2 border-double border-vermilion ${
        isLarge ? "px-5 py-3" : "px-3 py-1.5"
      }`}
    >
      <span
        className={`font-display font-semibold leading-none ${isLarge ? "text-3xl" : "text-base"}`}
      >
        {estimatedScaled}
      </span>
      <span
        className={`font-mono uppercase tracking-[0.2em] text-ink ${
          isLarge ? "mt-1 text-[0.7rem]" : "mt-0.5 text-[0.55rem]"
        }`}
      >
        Practice score
      </span>
      <span
        className={`font-mono tabular-nums text-ink-soft ${
          isLarge ? "mt-1 text-[0.7rem]" : "mt-0.5 text-[0.55rem]"
        }`}
      >
        raw {rawRating}/{maxRaw}
      </span>
      {cefrEstimate ? (
        <span
          className={`font-mono uppercase tracking-[0.15em] text-ink-soft ${
            isLarge ? "mt-1 text-[0.65rem]" : "mt-0.5 text-[0.5rem]"
          }`}
        >
          {cefrEstimate}
        </span>
      ) : null}
      <span
        className={`max-w-[10rem] text-center leading-snug text-ink-faint ${
          isLarge ? "mt-1.5 text-[0.55rem]" : "mt-1 text-[0.45rem]"
        }`}
      >
        Practice score, not an official TOEIC score
      </span>
    </div>
  );
}
