import { useMutation, useQuery } from "@tanstack/react-query";
import { computeStreak, TASK_CATALOG, type WritingTaskType } from "@writing-helper/practice";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createAttempt, listAttempts, type PracticeAttemptSummary } from "../api/practice";
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
import { ScoreStamp } from "../practice/ScoreStamp";
import { StreakStrip } from "../practice/StreakStrip";

const TASK_OPTIONS = TASK_CATALOG.map((task) => ({ id: task.type, label: task.label }));

export function PracticePage() {
  const navigate = useNavigate();
  const [taskType, setTaskType] = useState<WritingTaskType>(TASK_CATALOG[0]!.type);

  const attempts = useQuery({ queryKey: ["practice-attempts"], queryFn: listAttempts });

  const start = useMutation({
    mutationFn: () => createAttempt({ taskType }),
    onSuccess: (attempt) => void navigate(`/writing/${attempt.id}`),
  });

  const submitted = (attempts.data ?? []).filter((item) => item.submittedAt);
  const submittedDates = submitted.map((item) => new Date(item.submittedAt!));
  const streak = computeStreak(submittedDates);
  const chartPoints = firstDraftChartPoints(attempts.data ?? []);
  const showLedger = submitted.length > 0;

  return (
    <main className="practice-desk relative flex min-h-dvh flex-col">
      <PageAtmosphere kind="practice" />
      <Masthead
        lockupTo="/writing"
        className="practice-chrome relative z-10 px-4 py-4 sm:px-6"
        deskToggle
      >
        <FolioNav current="/writing" />
      </Masthead>
      <div className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-2 sm:px-6">
        <div className="practice-sheet relative">
          <h1 className="animate-fade-up font-display text-3xl font-semibold">Practice</h1>
          <p className="animate-fade-up mt-2 max-w-xl text-ink-soft">
            Sit a timed paper. The examiner marks it when you submit.
          </p>

          <section className="animate-fade-up mt-10" style={{ animationDelay: "40ms" }}>
            <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
              Task
            </h2>
            <div className="mt-3">
              <FolioChoice
                label="Task"
                value={taskType}
                options={TASK_OPTIONS}
                onChange={setTaskType}
              />
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
              <p className="mt-3 text-sm text-vermilion">
                Could not set the paper. Try again in a moment.
              </p>
            )}
          </section>

          {showLedger && (
            <div className="animate-fade-up mt-12 space-y-10" style={{ animationDelay: "80ms" }}>
              <StreakStrip submittedDates={submittedDates} current={streak.current} />
              {chartPoints.length > 0 && <BandChart points={chartPoints} />}
            </div>
          )}

          <section className="animate-fade-up mt-12" style={{ animationDelay: "120ms" }}>
            <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
              Papers
            </h2>
            {attempts.isLoading && <FolioSkeleton label="Fetching your papers" />}
            {attempts.isError && (
              <p className="mt-4 text-sm text-vermilion">
                Could not load your papers. Refresh and try again.
              </p>
            )}
            {attempts.data?.length === 0 && (
              <FolioEmpty message="Nothing here yet. Pick a task and start." />
            )}
            <ul className="mt-2 divide-y divide-rule">
              {attempts.data?.map((attempt, index) => {
                const spec = TASK_CATALOG.find((task) => task.type === attempt.taskType);
                const when = new Date(attempt.submittedAt ?? attempt.startedAt);
                const title =
                  spec?.label ?? attempt.taskType;
                const heading =
                  attempt.scale === "ielts" ? `${title} · ${attempt.level}` : title;
                return (
                  <li
                    key={attempt.id}
                    className="animate-fade-up"
                    style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                  >
                    <div className="flex items-center gap-x-3">
                      <Link
                        to={`/writing/${attempt.id}`}
                        className="group flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 py-4"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="font-display text-lg transition-colors group-hover:text-vermilion">
                            {heading}
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
                        <PaperScoreMeta attempt={attempt} maxRaw={spec?.maxRaw ?? null} />
                      </Link>
                      <AttemptDeleteControl kind="paper" attemptId={attempt.id} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}

function PaperScoreMeta({
  attempt,
  maxRaw,
}: {
  attempt: PracticeAttemptSummary;
  maxRaw: number | null;
}) {
  const isIelts = attempt.scale === "ielts";
  const rootScore = isIelts ? attempt.band : attempt.estimatedScaled;
  const summary = formatChainSummary(rootScore, attempt.latestBand, attempt.revisionCount);
  if (summary) {
    return (
      <span className="flex shrink-0 items-center gap-2">
        {isIelts && <LegacyBadge />}
        <span className="font-mono text-[0.75rem] tracking-wide text-ink-soft">{summary}</span>
      </span>
    );
  }
  if (isIelts && attempt.band !== null) {
    return (
      <span className="flex shrink-0 items-center gap-2">
        <LegacyBadge />
        <BandStamp band={attempt.band} level={attempt.level} size="sm" />
      </span>
    );
  }
  if (
    !isIelts &&
    attempt.estimatedScaled != null &&
    attempt.rawRating != null &&
    maxRaw != null
  ) {
    return (
      <ScoreStamp
        estimatedScaled={attempt.estimatedScaled}
        rawRating={attempt.rawRating}
        maxRaw={maxRaw}
        cefrEstimate={attempt.cefrEstimate}
        size="sm"
      />
    );
  }
  return null;
}

function LegacyBadge() {
  return (
    <span className="font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
      Legacy
    </span>
  );
}
