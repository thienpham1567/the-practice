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

const TREND_W = 1000;
const TREND_H = 280;
const TREND_PAD_X = 36;
const TREND_PAD_Y = 40;

/** Band points in the trend viewBox. Aspect matches the SVG so marks stay round. */
function trendGeometry(bands: readonly number[]) {
  const low = Math.min(...bands);
  const high = Math.max(...bands);
  const span = high - low || 1;
  const innerW = TREND_W - TREND_PAD_X * 2;
  const innerH = TREND_H - TREND_PAD_Y * 2;
  return bands.map((band, index) => ({
    band,
    index,
    x: TREND_PAD_X + (index / (bands.length - 1)) * innerW,
    y: TREND_H - TREND_PAD_Y - ((band - low) / span) * innerH,
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
  const closeRef = useInView<HTMLElement>();
  const points = trendGeometry(LANDING_TREND.bands);
  const last = points[points.length - 1]!;

  return (
    <main className="landing-folio relative min-h-[100dvh]">
      <PageAtmosphere kind="folio" />

      <div className="relative mx-auto max-w-[1400px] px-4 pt-6 sm:px-6">
        <div className="landing-fade">
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
          <p
            className="landing-fade mt-6 max-w-[38ch] text-lg leading-relaxed text-ink-soft"
            style={{ "--fade-delay": "260ms" } as CSSProperties}
          >
            {LANDING_LEDE}
          </p>
          <div className="landing-fade mt-10" style={{ "--fade-delay": "400ms" } as CSSProperties}>
            <Ctas />
          </div>
        </div>

        <div className="flex lg:col-span-7">
          <div className="landing-sheet flex w-full">
            <div className="landing-script relative flex w-full flex-col justify-center overflow-hidden py-9 pr-6 pl-[3.75rem] sm:py-12 sm:pr-11 sm:pl-[4.35rem]">
              <LandingDemo />
            </div>
          </div>
        </div>
      </section>

      {/* Tasks: two offset slabs, not a second hero split. */}
      <section ref={tasksRef} className="relative mx-auto max-w-[1400px] px-4 py-24 sm:px-6 sm:py-32">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <article className="landing-leaf reveal-up relative py-8 pr-5 pl-[3.6rem] sm:py-10 sm:pr-8 sm:pl-16 md:col-span-7">
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
        <p className="reveal-up font-display text-xl text-ink-soft">{LANDING_MISTAKES.kicker}</p>
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

      {/* Trend: the line paints when it enters view. Dots land after it. */}
      <section
        ref={trendRef}
        className="relative mx-auto max-w-[1400px] px-4 pb-24 pt-24 sm:px-6 sm:pt-32"
      >
        <p className="reveal-up font-display text-xl text-ink-soft">{LANDING_TREND.kicker}</p>
        <RevealLines
          as="h2"
          lines={[...LANDING_TREND.lines]}
          className="mt-3 max-w-[22ch] text-balance font-display text-3xl leading-[1.15] sm:text-4xl"
        />
        <div className="landing-trend mt-12">
          <svg
            viewBox={`0 0 ${TREND_W} ${TREND_H}`}
            preserveAspectRatio="xMinYMid meet"
            role="img"
            aria-label="Band scores rising over eight weeks"
          >
            <line
              x1={TREND_PAD_X}
              y1={TREND_H - TREND_PAD_Y}
              x2={TREND_W - TREND_PAD_X}
              y2={TREND_H - TREND_PAD_Y}
              stroke="var(--color-rule)"
              strokeWidth="1"
            />
            <polyline
              className="landing-trend-line"
              points={points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ")}
              fill="none"
              stroke="var(--color-vermilion)"
              strokeWidth="4"
              strokeLinejoin="round"
              strokeLinecap="round"
              pathLength="100"
            />
            {points.map((point) => (
              <circle
                key={`${point.x}-${point.band}`}
                data-trend-dot
                className="landing-trend-dot"
                cx={point.x}
                cy={point.y}
                r="7"
                fill="var(--color-paper)"
                stroke="var(--color-vermilion)"
                strokeWidth="2.5"
                style={{ "--dot-i": point.index } as CSSProperties}
              />
            ))}
            <text
              className="landing-trend-band"
              x={last.x + 18}
              y={last.y + 8}
              fill="var(--color-vermilion)"
            >
              {last.band}
            </text>
          </svg>
        </div>
      </section>

      <section ref={closeRef} className="relative border-t border-rule bg-paper-deep">
        <div className="reveal-up mx-auto max-w-[1400px] px-4 py-16 sm:px-6 sm:py-20">
          <Ctas />
        </div>
      </section>
    </main>
  );
}
