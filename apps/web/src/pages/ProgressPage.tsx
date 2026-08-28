import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../api/auth-store";
import { apiFetch } from "../api/client";
import { getProgress } from "../api/progress";
import { Masthead } from "../folio/Masthead";
import { PageAtmosphere } from "../folio/PageAtmosphere";
import { CriteriaSparklines } from "../practice/CriteriaSparklines";
import { LevelUpStamp } from "../practice/LevelUpStamp";
import { levelUpVerdict } from "../practice/level-up";
import { ProgressBandChart } from "../practice/ProgressBandChart";
import { SpeakingProgressCharts } from "../practice/SpeakingProgressCharts";
import { StyleTrendsChart } from "../practice/StyleTrendsChart";

export function ProgressPage() {
  const navigate = useNavigate();
  const { user, clearSession } = useAuthStore();
  const progress = useQuery({ queryKey: ["practice-progress"], queryFn: getProgress });

  const signOut = async () => {
    await apiFetch<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
    clearSession();
    void navigate("/");
  };

  const series = progress.data?.series ?? [];
  const speakingSeries = progress.data?.speaking?.series ?? [];
  const hasWriting = series.length > 0;
  const hasSpeaking = speakingSeries.length > 0;
  const hasAny = hasWriting || hasSpeaking;
  const verdict = hasWriting ? levelUpVerdict(series) : null;

  return (
    <main className="relative mx-auto min-w-0 max-w-3xl px-6 py-14">
      <PageAtmosphere kind="progress" />
      <Masthead lockupTo="/practice">
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm">
          <Link
            to="/practice"
            className="text-ink-faint decoration-vermilion/40 underline-offset-4 hover:text-vermilion hover:underline"
          >
            Practice
          </Link>
          <Link
            to="/speaking"
            className="text-ink-faint decoration-vermilion/40 underline-offset-4 hover:text-vermilion hover:underline"
          >
            Speaking
          </Link>
          <Link
            to="/vocab"
            className="text-ink-faint decoration-vermilion/40 underline-offset-4 hover:text-vermilion hover:underline"
          >
            Vocabulary
          </Link>
          <Link
            to="/docs"
            className="text-ink-faint decoration-vermilion/40 underline-offset-4 hover:text-vermilion hover:underline"
          >
            Drafts
          </Link>
          {user && (
            <button type="button" onClick={() => void signOut()} className="text-ink-faint hover:text-vermilion">
              Sign out
            </button>
          )}
        </div>
      </Masthead>

      <h1 className="animate-fade-up mt-8 font-display text-3xl font-semibold">Progress</h1>
      <p className="animate-fade-up mt-2 text-ink-soft" style={{ animationDelay: "40ms" }}>
        Writing and speaking tracked separately — different skills, different charts.
      </p>

      {progress.isLoading && (
        <p className="animate-fade-up mt-10 font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">
          Fetching your progress…
        </p>
      )}

      {progress.isError && (
        <p className="animate-fade-up mt-10 text-ink-soft">
          Could not load your progress. Try again in a moment.
        </p>
      )}

      {progress.isSuccess && !hasAny && (
        <div className="animate-fade-up mt-14 flex flex-col items-center text-center">
          <span className="font-display text-6xl leading-none text-rule">¶</span>
          <p className="mt-4 text-ink-soft">Sit your first practice paper or talk to see progress.</p>
          <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
            <Link
              to="/practice"
              className="text-vermilion decoration-vermilion/40 underline-offset-4 hover:underline"
            >
              Start writing
            </Link>
            <Link
              to="/speaking"
              className="text-vermilion decoration-vermilion/40 underline-offset-4 hover:underline"
            >
              Start speaking
            </Link>
          </div>
        </div>
      )}

      {progress.isSuccess && hasAny && (
        <div className="mt-12 min-w-0 space-y-16">
          {hasWriting && (
            <section aria-label="Writing progress" className="min-w-0 space-y-12">
              <header>
                <h2 className="font-display text-2xl font-semibold">Writing</h2>
                <p className="mt-1 text-sm text-ink-soft">Band, criteria, and style across graded papers.</p>
              </header>
              <div className="animate-fade-up" style={{ animationDelay: "80ms" }}>
                <ProgressBandChart series={series} />
              </div>
              <div className="animate-fade-up" style={{ animationDelay: "120ms" }}>
                <CriteriaSparklines series={series} />
              </div>
              <div className="animate-fade-up" style={{ animationDelay: "160ms" }}>
                <StyleTrendsChart series={series} />
              </div>
              {verdict && (
                <div className="animate-fade-up" style={{ animationDelay: "200ms" }}>
                  <LevelUpStamp verdict={verdict} />
                </div>
              )}
            </section>
          )}

          {hasSpeaking && (
            <div className="animate-fade-up" style={{ animationDelay: hasWriting ? "240ms" : "80ms" }}>
              <SpeakingProgressCharts series={speakingSeries} />
            </div>
          )}
        </div>
      )}
    </main>
  );
}
