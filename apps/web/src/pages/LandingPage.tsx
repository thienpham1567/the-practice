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

/** Đường band, vẽ trong hệ toạ độ 100×40 rồi để SVG co giãn. */
function trendPoints(bands: readonly number[]): string {
  const low = Math.min(...bands);
  const high = Math.max(...bands);
  const span = high - low || 1;
  return bands
    .map((band, index) => {
      const x = (index / (bands.length - 1)) * 100;
      const y = 40 - ((band - low) / span) * 40;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function LandingPage({ now = new Date() }: { now?: Date }) {
  const tasksRef = useInView<HTMLElement>();
  const mistakesRef = useInView<HTMLElement>();
  const trendRef = useInView<HTMLElement>();
  const ctaRef = useInView<HTMLElement>();

  return (
    <main className="relative">
      <PageAtmosphere kind="folio" />

      <div className="mx-auto max-w-3xl px-6 pt-14">
        <div className="animate-fade-up">
          <Masthead>
            <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
              {folioDateline(now)}
            </p>
          </Masthead>
        </div>
      </div>

      {/* Hero: min-h chứ không h, để màn ngang thấp vẫn cuộn tới CTA được. */}
      <section className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-20">
        <RevealLines
          as="h1"
          lines={HEADLINE_LINES}
          className="font-display text-5xl font-semibold tracking-tight sm:text-6xl"
        />
        <p className="mt-6 max-w-xl text-lg text-ink-soft">{LANDING_LEDE}</p>

        <div className="mt-16 border-t border-rule pt-10">
          <LandingDemo />
        </div>
      </section>

      <section ref={tasksRef} className="mx-auto max-w-3xl px-6 py-32">
        <article className="reveal-up relative overflow-hidden border border-rule px-5 py-8 sm:px-8 sm:py-10">
          <AppMark className="pointer-events-none absolute -right-2 -top-2 h-12 w-12 -rotate-6 text-vermilion sm:-right-3 sm:-top-3 sm:h-14 sm:w-14" />
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
            {LANDING_PAPER.kicker}
          </p>
          <p className="mt-4 text-ink-soft">{LANDING_PAPER.instruction}</p>
          <p className="mt-4 font-display text-xl leading-snug">{LANDING_PAPER.prompt}</p>
        </article>

        <article
          className="reveal-up relative mt-4 overflow-hidden border border-rule px-5 py-8 sm:px-8 sm:py-10"
          style={{ "--reveal-delay": "120ms" } as CSSProperties}
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute -right-1 -top-4 font-display text-7xl leading-none text-vermilion/25 sm:-right-2 sm:-top-5 sm:text-8xl"
          >
            &ldquo;
          </span>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
            {LANDING_TALK.kicker}
          </p>
          <p className="mt-4 text-ink-soft">{LANDING_TALK.instruction}</p>
          <p className="mt-4 font-display text-xl leading-snug">{LANDING_TALK.prompt}</p>
        </article>
      </section>

      <section ref={mistakesRef} className="mx-auto max-w-3xl px-6 py-32">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          {LANDING_MISTAKES.kicker}
        </p>
        <RevealLines
          as="h2"
          lines={[...LANDING_MISTAKES.lines]}
          className="mt-4 font-display text-3xl leading-tight sm:text-4xl"
        />
        <ul className="mt-10 space-y-3">
          {LANDING_MISTAKES.tallies.map((tally, index) => (
            <li
              key={tally.label}
              className="reveal-up flex items-baseline justify-between border-b border-rule pb-2"
              style={{ "--reveal-delay": `${index * 120}ms` } as CSSProperties}
            >
              <span className="font-display text-lg">{tally.label}</span>
              <span className="font-mono text-sm tabular-nums text-vermilion">
                &times;{tally.count}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section ref={trendRef} className="mx-auto max-w-3xl px-6 py-32">
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          {LANDING_TREND.kicker}
        </p>
        <RevealLines
          as="h2"
          lines={[...LANDING_TREND.lines]}
          className="mt-4 font-display text-3xl leading-tight sm:text-4xl"
        />
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          role="img"
          aria-label="Band scores rising over eight weeks"
          className="mt-10 h-32 w-full"
        >
          <polyline
            className="landing-trend-line"
            points={trendPoints(LANDING_TREND.bands)}
            fill="none"
            stroke="var(--color-vermilion)"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
            pathLength="100"
          />
        </svg>
      </section>

      <section ref={ctaRef} className="mx-auto max-w-3xl px-6 pb-32">
        <div className="reveal-up flex flex-wrap items-baseline gap-x-6 gap-y-3">
          <Link
            to="/register"
            className="bg-ink px-5 py-2 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-vermilion"
          >
            Begin practice
          </Link>
          <Link
            to="/write"
            className="text-vermilion decoration-vermilion/40 underline-offset-4 hover:underline"
          >
            Open a draft
          </Link>
        </div>
        <p
          className="reveal-up mt-6 text-sm text-ink-soft"
          style={{ "--reveal-delay": "120ms" } as CSSProperties}
        >
          Already have an account?{" "}
          <Link to="/login" className="text-vermilion underline underline-offset-2">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
