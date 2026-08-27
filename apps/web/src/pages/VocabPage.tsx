import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "../api/auth-store";
import { apiFetch } from "../api/client";
import { listVocab, type VocabEntry, type VocabStatusFilter } from "../api/vocab";
import { Masthead } from "../folio/Masthead";

const FILTERS: { id: VocabStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unused", label: "Unused" },
  { id: "used", label: "Used" },
];

function matchesFilter(entry: VocabEntry, filter: VocabStatusFilter): boolean {
  if (filter === "unused") return entry.usedCount === 0;
  if (filter === "used") return entry.usedCount > 0;
  return true;
}

export function VocabPage() {
  const navigate = useNavigate();
  const { user, clearSession } = useAuthStore();
  const [filter, setFilter] = useState<VocabStatusFilter>("all");

  const vocab = useQuery({ queryKey: ["practice-vocab"], queryFn: listVocab });

  const items = useMemo(
    () => (vocab.data ?? []).filter((entry) => matchesFilter(entry, filter)),
    [vocab.data, filter],
  );

  const signOut = async () => {
    await apiFetch<void>("/auth/logout", { method: "POST" }).catch(() => undefined);
    clearSession();
    void navigate("/");
  };

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

      <h1 className="animate-fade-up mt-8 font-display text-3xl font-semibold">Vocabulary</h1>
      <p className="animate-fade-up mt-2 text-ink-soft" style={{ animationDelay: "40ms" }}>
        Words suggested in practice — unused ones resurface when they fit a new topic.
      </p>

      <div
        className="animate-fade-up mt-8 flex border border-rule"
        style={{ animationDelay: "80ms" }}
        role="group"
        aria-label="Filter by status"
      >
        {FILTERS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => setFilter(option.id)}
            className={`flex-1 py-2 font-mono text-[0.75rem] uppercase tracking-[0.15em] transition-colors ${
              filter === option.id ? "bg-ink text-paper" : "text-ink-soft hover:text-vermilion"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {vocab.isLoading && (
        <p className="animate-fade-up mt-8 font-mono text-xs uppercase tracking-[0.18em] text-ink-faint">
          Fetching your notebook…
        </p>
      )}

      {vocab.isError && (
        <p className="animate-fade-up mt-8 text-ink-soft">
          Could not load your vocabulary.{" "}
          <Link to="/login" className="text-vermilion underline underline-offset-2">
            Sign in
          </Link>{" "}
          and try again.
        </p>
      )}

      {vocab.isSuccess && vocab.data.length === 0 && (
        <div className="animate-fade-up mt-14 flex flex-col items-center text-center">
          <span className="font-display text-6xl leading-none text-rule">¶</span>
          <p className="mt-4 text-ink-soft">Nothing here yet.</p>
          <Link
            to="/practice"
            className="mt-1 text-vermilion decoration-vermilion/40 underline-offset-4 hover:underline"
          >
            Start a practice paper
          </Link>
        </div>
      )}

      {vocab.isSuccess && vocab.data.length > 0 && items.length === 0 && (
        <p className="animate-fade-up mt-8 text-ink-soft">No words match this filter.</p>
      )}

      {items.length > 0 && (
        <div className="animate-fade-up mt-6 overflow-x-auto" style={{ animationDelay: "120ms" }}>
          <table className="w-full min-w-[36rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-rule">
                <th className="py-2 pr-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
                  Word
                </th>
                <th className="py-2 pr-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
                  Meaning
                </th>
                <th className="py-2 pr-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
                  Example
                </th>
                <th className="py-2 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {items.map((entry, index) => (
                <tr
                  key={entry.id}
                  className="animate-fade-up align-top"
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <td className="py-3 pr-4 font-display text-lg">{entry.word}</td>
                  <td className="py-3 pr-4 text-sm text-ink-soft">{entry.meaning}</td>
                  <td className="py-3 pr-4 text-sm italic text-ink-faint">{entry.example}</td>
                  <td className="py-3">
                    <UsageBadge usedCount={entry.usedCount} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function UsageBadge({ usedCount }: { usedCount: number }) {
  if (usedCount === 0) {
    return (
      <span className="inline-block border border-rule px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
        chưa dùng
      </span>
    );
  }
  return (
    <span className="inline-block border border-vermilion/40 px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-vermilion">
      đã dùng ×{usedCount}
    </span>
  );
}
