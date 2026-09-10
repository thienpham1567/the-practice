import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listVocab, type VocabEntry, type VocabStatusFilter } from "../api/vocab";
import { FolioChoice } from "../folio/FolioChoice";
import { FolioEmpty } from "../folio/FolioEmpty";
import { FolioNav } from "../folio/FolioNav";
import { FolioSkeleton } from "../folio/FolioSkeleton";
import { Masthead } from "../folio/Masthead";
import { PageAtmosphere } from "../folio/PageAtmosphere";

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
  const [filter, setFilter] = useState<VocabStatusFilter>("all");

  const vocab = useQuery({ queryKey: ["practice-vocab"], queryFn: listVocab });

  const items = useMemo(
    () => (vocab.data ?? []).filter((entry) => matchesFilter(entry, filter)),
    [vocab.data, filter],
  );

  return (
    <main className="vocab-desk relative flex min-h-dvh flex-col">
      <PageAtmosphere kind="vocab" />
      <Masthead
        lockupTo="/practice"
        className="vocab-chrome relative z-10 px-4 py-4 sm:px-6"
        deskToggle
      >
        <FolioNav current="/vocab" />
      </Masthead>
      <div className="relative z-10 mx-auto w-full max-w-2xl flex-1 px-4 pb-16 pt-2 sm:px-6">
        <div className="vocab-sheet relative">
          <h1 className="animate-fade-up font-display text-3xl font-semibold">Vocabulary</h1>
          <p className="animate-fade-up mt-2 max-w-xl text-ink-soft" style={{ animationDelay: "40ms" }}>
            Words suggested in practice. Unused ones resurface when they fit a new topic.
          </p>

          <div className="animate-fade-up mt-8" style={{ animationDelay: "80ms" }}>
            <FolioChoice
              label="Filter by status"
              value={filter}
              options={FILTERS}
              onChange={setFilter}
            />
          </div>

          {vocab.isLoading && <FolioSkeleton label="Fetching your notebook" />}

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
            <FolioEmpty
              message="Nothing here yet."
              actions={[{ to: "/practice", label: "Start a practice paper" }]}
            />
          )}

          {vocab.isSuccess && vocab.data.length > 0 && items.length === 0 && (
            <p className="animate-fade-up mt-8 text-ink-soft">No words match this filter.</p>
          )}

          {items.length > 0 && (
            <div
              className="animate-fade-up mt-6 overflow-x-auto border border-rule"
              style={{ animationDelay: "120ms" }}
            >
              <table className="w-full min-w-[36rem] border-collapse text-left">
                <thead>
                  <tr className="border-b border-rule">
                    <th className="px-3 py-2 pr-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
                      Word
                    </th>
                    <th className="py-2 pr-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
                      Meaning
                    </th>
                    <th className="py-2 pr-4 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
                      Example
                    </th>
                    <th className="py-2 pr-3 font-mono text-[0.65rem] uppercase tracking-[0.15em] text-ink-faint">
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
                      <td className="px-3 py-3 pr-4 font-display text-lg">{entry.word}</td>
                      <td className="py-3 pr-4 text-sm text-ink-soft">{entry.meaning}</td>
                      <td className="py-3 pr-4 text-sm italic text-ink-faint">{entry.example}</td>
                      <td className="py-3 pr-3">
                        <UsageBadge usedCount={entry.usedCount} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function UsageBadge({ usedCount }: { usedCount: number }) {
  if (usedCount === 0) {
    return (
      <span className="inline-block border border-rule px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-ink-faint">
        unused
      </span>
    );
  }
  return (
    <span className="inline-block border border-vermilion/40 px-2 py-0.5 font-mono text-[0.65rem] uppercase tracking-[0.12em] text-vermilion">
      used ×{usedCount}
    </span>
  );
}
