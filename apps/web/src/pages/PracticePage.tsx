import { useMutation, useQuery } from "@tanstack/react-query";
import { computeStreak, TASK_CATALOG, type Level } from "@writing-helper/practice";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAttempt, listAttempts } from "../api/practice";
import { AttemptDeleteControl } from "../folio/AttemptDeleteControl";
import { FolioChoice } from "../folio/FolioChoice";
import { FolioEmpty } from "../folio/FolioEmpty";
import { FolioNav } from "../folio/FolioNav";
import { FolioSkeleton } from "../folio/FolioSkeleton";
import { Masthead } from "../folio/Masthead";
import { PageAtmosphere } from "../folio/PageAtmosphere";
import { BandChart } from "../practice/BandChart";
import { BandStamp } from "../practice/BandStamp";
import { firstDraftChartPoints } from "../practice/band-chart";
import { formatChainSummary } from "../practice/revise-availability";
import { StreakStrip } from "../practice/StreakStrip";

const LEVELS: Level[] = ["A2", "B1", "B2", "C1"];
const LEVEL_OPTIONS = LEVELS.map((id) => ({ id, label: id }));

export function PracticePage() {
  const navigate = useNavigate();
  const [level, setLevel] = useState<Level>("B1");

  const attempts = useQuery({ queryKey: ["practice-attempts"], queryFn: listAttempts });

  const start = useMutation({
    mutationFn: () => createAttempt({ level }),
    onSuccess: (attempt) => void navigate(`/practice/${attempt.id}`),
  });

  const submitted = (attempts.data ?? []).filter((item) => item.submittedAt);
  const submittedDates = submitted.map((item) => new Date(item.submittedAt!));
  const streak = computeStreak(submittedDates);
  const chartPoints = firstDraftChartPoints(attempts.data ?? []);
  const showLedger = submitted.length > 0;

  return (
    <main className="relative mx-auto min-h-[100dvh] max-w-3xl px-6 py-14">
      <PageAtmosphere kind="practice" />
      <Masthead lockupTo="/practice">
        <FolioNav current="/practice" />
      </Masthead>
      <h1 className="animate-fade-up mt-8 font-display text-3xl font-semibold">Practice</h1>
      <p className="animate-fade-up mt-2 max-w-xl text-ink-soft">
        Sit a timed paper. The examiner marks it when you submit.
      </p>

      <section className="animate-fade-up mt-10" style={{ animationDelay: "40ms" }}>
        <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">Level</h2>
        <div className="mt-3">
          <FolioChoice label="Level" value={level} options={LEVEL_OPTIONS} onChange={setLevel} />
        </div>
        <button
          type="button"
          onClick={() => start.mutate()}
          disabled={start.isPending}
          className="mt-4 min-h-11 bg-ink px-5 py-3 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-vermilion disabled:opacity-60"
        >
          {start.isPending ? "Setting the paper…" : "Start writing"}
        </button>
        {start.isError && (
          <p className="mt-3 text-sm text-vermilion">Could not set the paper. Try again in a moment.</p>
        )}
      </section>

      {showLedger && (
        <div className="animate-fade-up mt-12 space-y-10" style={{ animationDelay: "80ms" }}>
          <StreakStrip submittedDates={submittedDates} current={streak.current} />
          <BandChart points={chartPoints} />
        </div>
      )}

      <section className="animate-fade-up mt-12" style={{ animationDelay: "120ms" }}>
        <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">Papers</h2>
        {attempts.isLoading && <FolioSkeleton label="Fetching your papers" />}
        {attempts.isError && (
          <p className="mt-4 text-sm text-vermilion">Could not load your papers. Refresh and try again.</p>
        )}
        {attempts.data?.length === 0 && (
          <FolioEmpty message="Nothing here yet. Pick a level and start." />
        )}
        <ul className="mt-2 divide-y divide-rule">
          {attempts.data?.map((attempt, index) => {
            const spec = TASK_CATALOG.find((task) => task.type === attempt.taskType);
            const when = new Date(attempt.submittedAt ?? attempt.startedAt);
            return (
              <li
                key={attempt.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <div className="flex items-center gap-x-3">
                  <Link
                    to={`/practice/${attempt.id}`}
                    className="group flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 py-4"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="font-display text-lg transition-colors group-hover:text-vermilion">
                        {spec?.label ?? attempt.taskType} · {attempt.level}
                      </span>
                      <span className="ml-3 font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-faint">
                        {when.toLocaleDateString(undefined, {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                      {!attempt.submittedAt && (
                        <span className="ml-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-vermilion">
                          In progress
                        </span>
                      )}
                    </span>
                    <PaperBandMeta
                      band={attempt.band}
                      level={attempt.level}
                      latestBand={attempt.latestBand}
                      revisionCount={attempt.revisionCount}
                    />
                  </Link>
                  <AttemptDeleteControl kind="paper" attemptId={attempt.id} />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

function PaperBandMeta({
  band,
  level,
  latestBand,
  revisionCount,
}: {
  band: number | null;
  level: Level;
  latestBand: number | null;
  revisionCount: number;
}) {
  const summary = formatChainSummary(band, latestBand, revisionCount);
  if (summary) {
    return (
      <span className="shrink-0 font-mono text-[0.75rem] tracking-wide text-ink-soft">
        {summary}
      </span>
    );
  }
  if (band !== null) return <BandStamp band={band} level={level} size="sm" />;
  return null;
}
