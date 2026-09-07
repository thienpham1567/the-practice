import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { AppMark } from "../AppMark";
import { folioDateline } from "../folio/folio-dateline";
import {
  LANDING_LEDE,
  LANDING_MISTAKES,
  LANDING_PAPER,
  LANDING_TALK,
  LANDING_TREND,
} from "../folio/landing-copy";
import { Masthead } from "../folio/Masthead";
import { PageAtmosphere } from "../folio/PageAtmosphere";
import { LandingDemo } from "../landing/LandingDemo";
import { RevealLines } from "../motion/RevealLines";
import { useInView } from "../motion/use-in-view";

/*
  LANDING_HEADLINE ngắt làm hai dòng. `join(" ")` trong RevealLines phải dựng
  lại đúng nguyên văn hằng đó, kể cả dấu chấm — test cũ ghim chuỗi đầy đủ.
*/
const HEADLINE_LINES = ["Sit the paper.", "Take the turn."];

const CTA_CLASS =
  "bg-ink px-5 py-2 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-vermilion";
const GHOST_CLASS =
  "text-vermilion decoration-vermilion/40 underline-offset-4 hover:underline";

/** Đường band, vẽ trong hệ toạ độ 100×40 rồi để SVG co giãn. */
function trendGeometry(bands: readonly number[]) {
  const low = Math.min(...bands);
  const high = Math.max(...bands);
  const span = high - low || 1;
  return bands.map((band, index) => ({
    band,
    x: (index / (bands.length - 1)) * 100,
    y: 40 - ((band - low) / span) * 32 - 4,
  }));
}

function Ctas() {
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
      <Link to="/register" className={CTA_CLASS}>
        Begin practice
      </Link>
      <Link to="/write" className={GHOST_CLASS}>
        Open a draft
      </Link>
    </div>
  );
}

export function LandingPage({ now = new Date() }: { now?: Date }) {
  const tasksRef = useInView<HTMLElement>();
  const mistakesRef = useInView<HTMLElement>();
  const trendRef = useInView<HTMLElement>();
  const points = trendGeometry(LANDING_TREND.bands);
  const lastBand = LANDING_TREND.bands[LANDING_TREND.bands.length - 1];

  return (
    <main className="relative min-h-[100dvh]">
      <PageAtmosphere kind="folio" />

      <div className="relative mx-auto max-w-[1400px] px-4 pt-6 sm:px-6">
        <div className="animate-fade-up">
          <Masthead>
            <div className="flex flex-wrap items-baseline justify-end gap-x-6 gap-y-2">
              <p className="font-mono text-[0.7rem] text-ink-faint">{folioDateline(now)}</p>
              <Link to="/login" className={GHOST_CLASS}>
                Sign in
              </Link>
            </div>
          </Masthead>
        </div>
      </div>

      {/*
        Hero: asymmetric split. Copy left, live marking (real component) right.
        Mobile: stack copy then script. Desktop: both sit in the first viewport.
      */}
      <section className="relative mx-auto grid min-h-[calc(100dvh-5.75rem)] max-w-[1400px] grid-cols-1 gap-10 px-4 pt-8 pb-10 sm:px-6 lg:grid-cols-12 lg:items-stretch lg:gap-8 lg:pt-10 lg:pb-12">
        <div className="flex flex-col justify-center lg:col-span-5">
          <RevealLines
            as="h1"
            lines={HEADLINE_LINES}
            className="text-balance font-display text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl"
          />
          <p className="mt-6 max-w-[38ch] text-lg leading-relaxed text-ink-soft">
            {LANDING_LEDE}
          </p>
          <div className="mt-10">
            <Ctas />
          </div>
        </div>

        <div className="flex lg:col-span-7">
          <div className="landing-script relative flex w-full flex-col justify-center overflow-hidden border border-rule px-5 py-8 sm:px-10 sm:py-12">
            <LandingDemo />
          </div>
        </div>
      </section>

      {/* Tasks: two offset slabs, not a second hero split. */}
      <section ref={tasksRef} className="relative mx-auto max-w-[1400px] px-4 py-24 sm:px-6 sm:py-32">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <article className="reveal-up relative overflow-hidden border border-rule px-5 py-8 sm:px-8 sm:py-10 md:col-span-7">
            <AppMark className="pointer-events-none absolute -right-2 -top-2 h-12 w-12 -rotate-6 text-vermilion sm:-right-3 sm:-top-3 sm:h-14 sm:w-14" />
            <p className="font-mono text-[0.7rem] text-ink-faint">{LANDING_PAPER.kicker}</p>
            <p className="mt-4 text-ink-soft">{LANDING_PAPER.instruction}</p>
            <p className="mt-4 font-display text-xl leading-snug">{LANDING_PAPER.prompt}</p>
          </article>

          <article
            className="reveal-up relative overflow-hidden bg-paper-deep px-5 py-8 sm:px-8 sm:py-10 md:col-span-5 md:mt-20"
            style={{ "--reveal-delay": "120ms" } as CSSProperties}
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -right-1 -top-4 font-display text-7xl leading-none text-vermilion/25 sm:-right-2 sm:-top-5 sm:text-8xl"
            >
              &ldquo;
            </span>
            <p className="font-mono text-[0.7rem] text-ink-faint">{LANDING_TALK.kicker}</p>
            <p className="mt-4 text-ink-soft">{LANDING_TALK.instruction}</p>
            <p className="mt-4 font-display text-xl leading-snug">{LANDING_TALK.prompt}</p>
          </article>
        </div>
      </section>

      {/* Notebook: three tally cells, not a hairline list. */}
      <section ref={mistakesRef} className="relative mx-auto max-w-[1400px] px-4 py-24 sm:px-6 sm:py-32">
        <p className="font-display text-xl text-ink-soft">{LANDING_MISTAKES.kicker}</p>
        <RevealLines
          as="h2"
          lines={[...LANDING_MISTAKES.lines]}
          className="mt-3 max-w-[20ch] text-balance font-display text-3xl leading-[1.15] sm:text-4xl"
        />
        <ul className="mt-12 grid grid-cols-1 gap-3 md:grid-cols-12">
          {LANDING_MISTAKES.tallies.map((tally, index) => (
            <li
              key={tally.label}
              className={`reveal-up flex min-h-[11rem] flex-col justify-between px-5 py-6 sm:px-7 sm:py-8 ${
                index === 0
                  ? "bg-vermilion text-paper md:col-span-5"
                  : index === 1
                    ? "bg-paper-deep md:col-span-4"
                    : "border border-rule md:col-span-3"
              }`}
              style={{ "--reveal-delay": `${index * 90}ms` } as CSSProperties}
            >
              <span className="font-display text-lg">{tally.label}</span>
              <span
                className={`font-display text-6xl leading-none tabular-nums sm:text-7xl ${
                  index === 0 ? "text-paper" : "text-vermilion"
                }`}
              >
                <span className="font-mono text-2xl">&times;</span>
                {tally.count}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Trend: one full-bleed line, last band as the scale. */}
      <section
        ref={trendRef}
        className="relative mx-auto max-w-[1400px] px-4 pb-24 pt-24 sm:px-6 sm:pt-32"
      >
        <p className="font-display text-xl text-ink-soft">{LANDING_TREND.kicker}</p>
        <RevealLines
          as="h2"
          lines={[...LANDING_TREND.lines]}
          className="mt-3 max-w-[22ch] text-balance font-display text-3xl leading-[1.15] sm:text-4xl"
        />
        <div className="relative mt-12">
          <p
            aria-hidden="true"
            className="pointer-events-none absolute -top-4 right-0 font-display text-8xl leading-none text-vermilion/30 sm:text-9xl"
          >
            {lastBand}
          </p>
          <svg
            viewBox="0 0 100 40"
            preserveAspectRatio="none"
            role="img"
            aria-label="Band scores rising over eight weeks"
            className="relative h-40 w-full sm:h-48"
          >
            <polyline
              className="landing-trend-line"
              points={points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")}
              fill="none"
              stroke="var(--color-vermilion)"
              strokeWidth="3.25"
              vectorEffect="non-scaling-stroke"
              pathLength="100"
            />
            {points.map((point) => (
              <circle
                key={`${point.x}-${point.band}`}
                cx={point.x}
                cy={point.y}
                r="1.1"
                fill="var(--color-paper)"
                stroke="var(--color-vermilion)"
                strokeWidth="0.6"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>
      </section>

      <section className="relative border-t border-rule bg-paper-deep">
        <div className="mx-auto max-w-[1400px] px-4 py-16 sm:px-6 sm:py-20">
          <Ctas />
        </div>
      </section>
    </main>
  );
}
