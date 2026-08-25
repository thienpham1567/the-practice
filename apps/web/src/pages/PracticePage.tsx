import { useMutation, useQuery } from "@tanstack/react-query";
import { computeStreak, TASK_CATALOG, type Level } from "@writing-helper/practice";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../api/auth-store";
import { apiFetch } from "../api/client";
import { createAttempt, listAttempts } from "../api/practice";
import { AppMark } from "../AppMark";
import { BandChart } from "../practice/BandChart";
import { BandStamp } from "../practice/BandStamp";
import { StreakStrip } from "../practice/StreakStrip";

const LEVELS: Level[] = ["A2", "B1", "B2", "C1"];

export function PracticePage() {
  const navigate = useNavigate();
  const { user, clearSession } = useAuthStore();
  const [level, setLevel] = useState<Level>("B1");

  const attempts = useQuery({ queryKey: ["practice-attempts"], queryFn: listAttempts });

  const start = useMutation({
    mutationFn: () => createAttempt({ level }),
    onSuccess: (attempt) => void navigate(`/practice/${attempt.id}`),
  });

  const submitted = (attempts.data ?? []).filter((item) => item.submittedAt);
  const submittedDates = submitted.map((item) => new Date(item.submittedAt!));
  const streak = computeStreak(submittedDates);
  const chartPoints = submitted
    .slice()
    .reverse()
    .filter((item) => item.band !== null)
    .map((item) => ({ at: new Date(item.submittedAt!).getTime(), band: item.band! }));

  const signOut = async () => {
    await apiFetch<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
    clearSession();
    void navigate("/");
  };

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <header className="animate-fade-up flex items-baseline justify-between border-b border-rule pb-5">
        <h1 className="flex items-center gap-3 font-display text-3xl font-semibold">
          <AppMark className="h-8 w-8 text-vermilion" />
          Practice
        </h1>
        <div className="flex items-center gap-4 text-sm">
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
      </header>

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
          {start.isPending ? "Setting the paper…" : "Start writing"}
        </button>
        {start.isError && (
          <p className="mt-3 text-sm text-vermilion">Could not set the paper. Try again in a moment.</p>
        )}
      </section>

      <div className="animate-fade-up mt-12 space-y-10" style={{ animationDelay: "80ms" }}>
        <StreakStrip submittedDates={submittedDates} current={streak.current} />
        <BandChart points={chartPoints} />
      </div>

      <section className="animate-fade-up mt-12" style={{ animationDelay: "120ms" }}>
        <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">Papers</h2>
        {attempts.isLoading && (
          <p className="mt-4 font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">
            Fetching your papers…
          </p>
        )}
        {attempts.data?.length === 0 && (
          <p className="mt-6 text-ink-soft">Nothing here yet. Pick a level and start.</p>
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
                <Link
                  to={`/practice/${attempt.id}`}
                  className="group flex items-center gap-4 py-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="font-display text-lg transition-colors group-hover:text-vermilion">
                      {spec?.label ?? attempt.taskType}
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
                  {attempt.band !== null && <BandStamp band={attempt.band} size="sm" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
