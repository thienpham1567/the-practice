import { Link } from "react-router-dom";
import { AppMark } from "../AppMark";
import { folioDateline } from "../folio/folio-dateline";
import { LANDING_HEADLINE, LANDING_LEDE, LANDING_PAPER } from "../folio/landing-copy";
import { Masthead } from "../folio/Masthead";

export function LandingPage({ now = new Date() }: { now?: Date }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <div className="animate-fade-up">
        <Masthead>
          <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
            {folioDateline(now)}
          </p>
        </Masthead>
      </div>

      <h1
        className="animate-fade-up mt-10 font-display text-4xl font-semibold tracking-tight sm:text-5xl"
        style={{ animationDelay: "40ms" }}
      >
        {LANDING_HEADLINE}
      </h1>
      <p className="animate-fade-up mt-3 max-w-xl text-lg text-ink-soft" style={{ animationDelay: "70ms" }}>
        {LANDING_LEDE}
      </p>

      <article
        className="animate-fade-up relative mt-12 overflow-hidden border border-rule px-5 py-8 sm:px-8 sm:py-10"
        style={{ animationDelay: "110ms" }}
      >
        <AppMark className="pointer-events-none absolute -right-2 -top-2 h-12 w-12 -rotate-6 text-vermilion sm:-right-3 sm:-top-3 sm:h-14 sm:w-14" />
        <p className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
          {LANDING_PAPER.kicker}
        </p>
        <p className="mt-4 text-ink-soft">{LANDING_PAPER.instruction}</p>
        <p className="mt-4 font-display text-xl leading-snug">{LANDING_PAPER.prompt}</p>
      </article>

      <div
        className="animate-fade-up mt-8 flex flex-wrap items-baseline gap-x-6 gap-y-3"
        style={{ animationDelay: "150ms" }}
      >
        <Link
          to="/register"
          className="bg-ink px-5 py-2 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-vermilion"
        >
          Sit a paper
        </Link>
        <Link
          to="/write"
          className="text-vermilion decoration-vermilion/40 underline-offset-4 hover:underline"
        >
          Open a draft
        </Link>
      </div>
      <p className="animate-fade-up mt-6 text-sm text-ink-soft" style={{ animationDelay: "180ms" }}>
        Already have an account?{" "}
        <Link to="/login" className="text-vermilion underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </main>
  );
}
