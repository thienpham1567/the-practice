import { bandToCefr } from "@writing-helper/practice";

interface BandStampProps {
  band: number;
  size?: "sm" | "lg";
}

/** Same rubber-stamp chrome as GradeStamp: double frame, tilt, ink grain. */
export function BandStamp({ band, size = "lg" }: BandStampProps) {
  const isLarge = size === "lg";
  const cefr = bandToCefr(band);

  return (
    <div
      className={`stamp animate-stamp-in inline-flex -rotate-2 flex-col items-center border-2 border-double border-vermilion ${
        isLarge ? "px-5 py-3" : "px-3 py-1.5"
      }`}
    >
      <span
        className={`font-display font-semibold leading-none ${isLarge ? "text-3xl" : "text-base"}`}
      >
        Band {band}
      </span>
      <span
        className={`font-mono uppercase tracking-[0.2em] text-ink ${
          isLarge ? "mt-1 text-[0.7rem]" : "mt-0.5 text-[0.55rem]"
        }`}
      >
        {cefr}
      </span>
    </div>
  );
}
