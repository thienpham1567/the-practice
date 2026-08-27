import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../api/auth-store";
import { apiFetch } from "../api/client";
import { getProgress } from "../api/progress";
import { Masthead } from "../folio/Masthead";
import { CriteriaSparklines } from "../practice/CriteriaSparklines";
import { LevelUpStamp } from "../practice/LevelUpStamp";
import { levelUpVerdict } from "../practice/level-up";
import { ProgressBandChart } from "../practice/ProgressBandChart";
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
  const hasSeries = series.length > 0;
  const verdict = hasSeries ? levelUpVerdict(series) : null;

  return (
    <main className="mx-auto max-w-3xl px-6 py-14">
      <Masthead lockupTo="/practice">
        <div className="flex items-center gap-4 text-sm">
          <Link
            to="/practice"
            className="text-ink-faint decoration-vermilion/40 underline-offset-4 hover:text-vermilion hover:underline"
          >
            Practice
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
        Band, criteria, and style across your graded papers.
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

      {progress.isSuccess && !hasSeries && (
        <div className="animate-fade-up mt-14 flex flex-col items-center text-center">
          <span className="font-display text-6xl leading-none text-rule">¶</span>
          <p className="mt-4 text-ink-soft">Sit your first practice paper to see progress.</p>
          <Link
            to="/practice"
            className="mt-1 text-vermilion decoration-vermilion/40 underline-offset-4 hover:underline"
          >
            Start writing
          </Link>
        </div>
      )}

      {progress.isSuccess && hasSeries && (
        <div className="mt-12 space-y-12">
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
        </div>
      )}
    </main>
  );
}
