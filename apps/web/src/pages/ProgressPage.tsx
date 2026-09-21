import { useQuery } from "@tanstack/react-query";
import { getMistakeProfile } from "../api/practice";
import { getProgress } from "../api/progress";
import { FolioEmpty } from "../folio/FolioEmpty";
import { FolioNav } from "../folio/FolioNav";
import { FolioSkeleton } from "../folio/FolioSkeleton";
import { Masthead } from "../folio/Masthead";
import { PageAtmosphere } from "../folio/PageAtmosphere";
import { CriteriaSparklines } from "../practice/CriteriaSparklines";
import { LevelUpStamp } from "../practice/LevelUpStamp";
import { levelUpVerdict } from "../practice/level-up";
import { ProgressBandChart } from "../practice/ProgressBandChart";
import { RecurringMistakes } from "../practice/RecurringMistakes";
import { SpeakingProgressCharts } from "../practice/SpeakingProgressCharts";
import { StyleTrendsChart } from "../practice/StyleTrendsChart";

export function ProgressPage() {
  const progress = useQuery({ queryKey: ["practice-progress"], queryFn: getProgress });
  const mistakes = useQuery({ queryKey: ["practice-mistakes"], queryFn: getMistakeProfile });

  const series = progress.data?.series ?? [];
  const speakingSeries = progress.data?.speaking?.series ?? [];
  const hasWriting = series.length > 0;
  const hasSpeaking = speakingSeries.length > 0;
  const hasAny = hasWriting || hasSpeaking;
  const verdict = hasWriting ? levelUpVerdict(series) : null;

  return (
    <main className="progress-desk relative flex min-h-dvh min-w-0 flex-col">
      <PageAtmosphere kind="progress" />
      <Masthead
        lockupTo="/writing"
        className="progress-chrome relative z-10 px-4 py-4 sm:px-6"
        deskToggle
      >
        <FolioNav current="/progress" />
      </Masthead>
      <div className="relative z-10 mx-auto w-full min-w-0 max-w-3xl flex-1 px-4 pb-16 pt-2 sm:px-6">
        <div className="progress-sheet relative min-w-0">
          <h1 className="animate-fade-up font-display text-3xl font-semibold">Progress</h1>
          <p className="animate-fade-up mt-2 max-w-xl text-ink-soft" style={{ animationDelay: "40ms" }}>
            Writing and speaking tracked separately. Different skills, different charts.
          </p>

          {progress.isLoading && <FolioSkeleton rows={5} label="Fetching your progress" />}

          {progress.isError && (
            <p className="animate-fade-up mt-10 text-ink-soft">
              Could not load your progress. Try again in a moment.
            </p>
          )}

          {progress.isSuccess && !hasAny && (
            <FolioEmpty
              message="Sit your first practice paper or talk to see progress."
              actions={[
                { to: "/writing", label: "Start writing" },
                { to: "/speaking", label: "Start speaking" },
              ]}
            />
          )}

          {progress.isSuccess && hasAny && (
            <div className="mt-12 min-w-0 space-y-16">
              {hasWriting && (
                <section aria-label="Writing progress" className="min-w-0 space-y-12">
                  <header>
                    <h2 className="font-display text-2xl font-semibold">Writing</h2>
                    <p className="mt-1 text-sm text-ink-soft">Practice scores, criteria, and style across graded papers.</p>
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
                  <RecurringMistakes profile={mistakes.data} />
                </section>
              )}

              {hasSpeaking && (
                <div className="animate-fade-up" style={{ animationDelay: hasWriting ? "240ms" : "80ms" }}>
                  <SpeakingProgressCharts series={speakingSeries} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
