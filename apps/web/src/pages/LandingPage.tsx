import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { folioDateline } from "../folio/folio-dateline";
import { LANDING_LEDE, LANDING_PAPER } from "../folio/landing-copy";
import { Masthead } from "../folio/Masthead";
import { PageAtmosphere } from "../folio/PageAtmosphere";
import { LandingDemo } from "../landing/LandingDemo";
import { RevealLines } from "../motion/RevealLines";

/*
  LANDING_HEADLINE ngắt làm hai dòng. `join(" ")` trong RevealLines phải dựng
  lại đúng nguyên văn hằng đó, kể cả dấu chấm — test cũ ghim chuỗi đầy đủ.
*/
const HEADLINE_LINES = ["Sit the paper.", "Take the turn."];

const CTA_CLASS =
  "bg-ink px-5 py-2 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-vermilion";
const GHOST_CLASS =
  "text-vermilion decoration-vermilion/40 underline-offset-4 hover:underline";
const SIGN_IN_CLASS =
  "text-vermilion underline decoration-vermilion/40 underline-offset-4";

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
  return (
    <main className="landing-folio relative flex h-dvh flex-col">
      <PageAtmosphere kind="folio" />

      <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 pt-6 sm:px-6">
        <div className="landing-fade">
          <Masthead
            lockupSize="md"
            className="landing-chrome"
            deskToggle
          >
            <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-2">
              <p className="font-mono text-[0.65rem] tracking-[0.14em] text-ink-faint">
                {folioDateline(now)}
              </p>
              <Link to="/login" className={SIGN_IN_CLASS}>
                Sign in
              </Link>
            </div>
          </Masthead>
        </div>
      </div>

      <section className="landing-hero relative mx-auto grid min-h-0 w-full max-w-[1400px] flex-1 grid-cols-1 items-start gap-8 px-4 pt-6 pb-8 sm:px-6 lg:grid-cols-12 lg:items-stretch lg:gap-8 lg:pt-8 lg:pb-10">
        <div className="landing-hero-copy relative z-10 flex min-h-[calc(100dvh-8.5rem)] flex-col justify-end pb-6 lg:col-span-5 lg:min-h-0 lg:justify-center lg:pb-0">
          <RevealLines
            as="h1"
            lines={HEADLINE_LINES}
            className="relative text-balance font-display text-5xl font-semibold leading-[1.1] tracking-tight sm:text-6xl"
          />
          <p
            className="landing-fade relative mt-6 max-w-[38ch] text-lg leading-relaxed text-ink-soft"
            style={{ "--fade-delay": "260ms" } as CSSProperties}
          >
            {LANDING_LEDE}
          </p>
          <div className="landing-fade relative mt-10" style={{ "--fade-delay": "400ms" } as CSSProperties}>
            <Ctas />
          </div>
        </div>

        <div className="landing-hero-visual relative z-10 flex min-h-0 lg:col-span-7 lg:items-center">
          <div className="landing-book">
            <div className="landing-book-verso" aria-hidden="true" />
            <div className="landing-book-recto landing-script relative flex w-full flex-col py-9 pr-6 pl-[3.75rem] sm:py-12 sm:pr-11 sm:pl-[4.35rem]">
              <p className="landing-book-kicker">{LANDING_PAPER.kicker}</p>
              <LandingDemo />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
