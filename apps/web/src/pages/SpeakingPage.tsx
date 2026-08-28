import { useMutation, useQuery } from "@tanstack/react-query";
import { computeStreak, type Level } from "@writing-helper/practice";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../api/auth-store";
import { apiFetch } from "../api/client";
import { createSpeakingAttempt, listSpeakingAttempts } from "../api/speaking";
import { Masthead } from "../folio/Masthead";
import { BandChart } from "../practice/BandChart";
import { BandStamp } from "../practice/BandStamp";
import { firstDraftChartPoints } from "../practice/band-chart";
import { formatChainSummary } from "../practice/revise-availability";
import { StreakStrip } from "../practice/StreakStrip";

const LEVELS: Level[] = ["A2", "B1", "B2", "C1"];

export function SpeakingPage() {
  const navigate = useNavigate();
  const { user, clearSession } = useAuthStore();
  const [level, setLevel] = useState<Level>("B1");

  const attempts = useQuery({
    queryKey: ["speaking-attempts"],
    queryFn: listSpeakingAttempts,
  });

  const start = useMutation({
    mutationFn: () => createSpeakingAttempt({ level }),
    onSuccess: (attempt) => void navigate(`/speaking/${attempt.id}`),
  });

  const submitted = (attempts.data ?? []).filter((item) => item.submittedAt);
  const submittedDates = submitted.map((item) => new Date(item.submittedAt!));
  const streak = computeStreak(submittedDates);
  const chartPoints = firstDraftChartPoints(attempts.data ?? []);

  const signOut = async () => {
    await apiFetch<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
    clearSession();
    void navigate("/");
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Masthead lockupTo="/speaking">
        <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm">
          <Link
            to="/practice"
            className="text-ink-faint decoration-vermilion/40 underline-offset-4 hover:text-vermilion hover:underline"
          >
            Writing
          </Link>
          <Link
            to="/vocab"
            className="text-ink-faint decoration-vermilion/40 underline-offset-4 hover:text-vermilion hover:underline"
          >
            Vocabulary
          </Link>
          <Link
            to="/progress"
            className="text-ink-faint decoration-vermilion/40 underline-offset-4 hover:text-vermilion hover:underline"
          >
            View progress →
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
      <h1 className="animate-fade-up mt-8 font-display text-3xl font-semibold">Speaking</h1>
      <p className="mt-2 max-w-xl text-ink-soft">
        IELTS Part 2 long turn — one cue card, two minutes to talk.
      </p>

      <section className="animate-fade-up mt-10" style={{ animationDelay: "40ms" }}>
        <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">Level</h2>
        <div className="mt-3 flex border border-rule">
          {LEVELS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setLevel(option)}
              className={`flex-1 py-2 font-mono text-[0.75rem] uppercase tracking-[0.15em] transition-colors ${
                level === option ? "bg-ink text-paper" : "text-ink-soft hover:text-vermilion"
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => start.mutate()}
          disabled={start.isPending}
          className="mt-4 bg-ink px-5 py-2 font-mono text-[0.75rem] uppercase tracking-[0.18em] text-paper transition-colors hover:bg-vermilion disabled:opacity-60"
        >
          {start.isPending ? "Setting the cue card…" : "Start speaking"}
        </button>
        {start.isError && (
          <p className="mt-3 text-sm text-vermilion">Could not start. Try again in a moment.</p>
        )}
      </section>

      <div className="animate-fade-up mt-12 space-y-10" style={{ animationDelay: "80ms" }}>
        <StreakStrip submittedDates={submittedDates} current={streak.current} />
        <BandChart points={chartPoints} />
      </div>

      <section className="animate-fade-up mt-12" style={{ animationDelay: "120ms" }}>
        <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">Talks</h2>
        {attempts.isLoading && (
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">
            Fetching your talks…
          </p>
        )}
        {attempts.isError && (
          <p className="mt-4 text-sm text-vermilion">Could not load your talks. Refresh and try again.</p>
        )}
        {attempts.data?.length === 0 && (
          <p className="mt-6 text-ink-soft">Nothing here yet. Pick a level and start.</p>
        )}
        <ul className="mt-2 divide-y divide-rule">
          {attempts.data?.map((attempt, index) => {
            const when = new Date(attempt.submittedAt ?? attempt.startedAt);
            return (
              <li
                key={attempt.id}
                className="animate-fade-up"
                style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
              >
                <Link
                  to={`/speaking/${attempt.id}`}
                  className="group flex flex-wrap items-center gap-x-4 gap-y-2 py-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-display text-lg transition-colors group-hover:text-vermilion">
                      Part 2 · {attempt.level}
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
                  <TalkBandMeta
                    band={attempt.band}
                    latestBand={attempt.latestBand}
                    revisionCount={attempt.revisionCount}
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}

function TalkBandMeta({
  band,
  latestBand,
  revisionCount,
}: {
  band: number | null;
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
  if (band !== null) return <BandStamp band={band} size="sm" />;
  return null;
}
