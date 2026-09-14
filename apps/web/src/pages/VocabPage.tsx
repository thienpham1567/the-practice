import { useQuery } from "@tanstack/react-query";
import type { Level } from "@writing-helper/practice";
import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { listVocab, type VocabEntry, type VocabStatusFilter } from "../api/vocab";
import { FolioChoice } from "../folio/FolioChoice";
import { FolioEmpty } from "../folio/FolioEmpty";
import { FolioNav } from "../folio/FolioNav";
import { FolioSkeleton } from "../folio/FolioSkeleton";
import { Masthead } from "../folio/Masthead";
import { PageAtmosphere } from "../folio/PageAtmosphere";

type LevelFilter = "all" | Level;

const STATUS_FILTERS: { id: VocabStatusFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unused", label: "Unused" },
  { id: "used", label: "Used" },
];

const LEVEL_FILTERS: { id: LevelFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "A2", label: "A2" },
  { id: "B1", label: "B1" },
  { id: "B2", label: "B2" },
  { id: "C1", label: "C1" },
];

function matchesStatus(entry: VocabEntry, filter: VocabStatusFilter): boolean {
  if (filter === "unused") return entry.usedCount === 0;
  if (filter === "used") return entry.usedCount > 0;
  return true;
}

export function VocabPage() {
  const [statusFilter, setStatusFilter] = useState<VocabStatusFilter>("all");
  const [levelFilter, setLevelFilter] = useState<LevelFilter>("all");
  const [search, setSearch] = useState("");

  const vocab = useQuery({ queryKey: ["practice-vocab"], queryFn: listVocab });

  const query = search.trim().toLowerCase();
  const items = useMemo(
    () =>
      (vocab.data ?? []).filter((entry) => {
        if (!matchesStatus(entry, statusFilter)) return false;
        if (levelFilter !== "all" && entry.level !== levelFilter) return false;
        if (
          query &&
          !entry.word.toLowerCase().includes(query) &&
          !entry.meaning.toLowerCase().includes(query)
        ) {
          return false;
        }
        return true;
      }),
    [vocab.data, statusFilter, levelFilter, query],
  );

  return (
    <main className="vocab-desk relative flex min-h-dvh flex-col">
      <PageAtmosphere kind="vocab" />
      <Masthead
        lockupTo="/writing"
        className="vocab-chrome relative z-10 px-4 py-4 sm:px-6"
        deskToggle
      >
        <FolioNav current="/vocab" />
      </Masthead>
      <div className="relative z-10 mx-auto w-full max-w-4xl flex-1 px-4 pb-16 pt-2 sm:px-6">
        <div className="vocab-sheet relative">
          <h1 className="animate-fade-up font-display text-3xl font-semibold">Vocabulary</h1>
          <p
            className="animate-fade-up mt-2 max-w-xl text-ink-soft"
            style={{ animationDelay: "40ms" }}
          >
            Words suggested in practice. Unused ones resurface when they fit a new topic.
          </p>

          <div className="animate-fade-up mt-8 space-y-4" style={{ animationDelay: "80ms" }}>
            <SearchField value={search} onChange={setSearch} />
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="sm:flex-1">
                <FolioChoice
                  label="Filter by status"
                  value={statusFilter}
                  options={STATUS_FILTERS}
                  onChange={setStatusFilter}
                />
              </div>
              <div className="sm:flex-1">
                <FolioChoice
                  label="Filter by level"
                  value={levelFilter}
                  options={LEVEL_FILTERS}
                  onChange={setLevelFilter}
                />
              </div>
            </div>
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
              actions={[{ to: "/writing", label: "Start a practice paper" }]}
            />
          )}

          {vocab.isSuccess && vocab.data.length > 0 && items.length === 0 && (
            <p className="animate-fade-up mt-8 text-ink-soft">
              No words match your search or filters.
            </p>
          )}

          {items.length > 0 && (
            <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
              {items.map((entry, index) => (
                <li
                  key={entry.id}
                  className="animate-fade-up border border-rule bg-paper-deep/40 p-4"
                  style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
                >
                  <VocabCard entry={entry} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="group block max-w-sm">
      <span className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Search
      </span>
      <div className="relative mt-1">
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Word or meaning…"
          className="w-full bg-transparent px-1 py-2 outline-none placeholder:text-ink-faint"
        />
        {/* Gạch chân trồi từ giữa ra khi focus, khớp pattern input ở AuthPage. */}
        <span className="absolute inset-x-0 bottom-0 h-px bg-rule" />
        <span className="absolute inset-x-0 bottom-0 h-px origin-center scale-x-0 bg-vermilion transition-transform duration-300 group-focus-within:scale-x-100" />
      </div>
    </label>
  );
}

function VocabCard({ entry }: { entry: VocabEntry }) {
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-display text-xl leading-snug">{entry.word}</h2>
        <div className="flex shrink-0 items-center gap-1.5">
          <Tag>{entry.level}</Tag>
          <UsageBadge usedCount={entry.usedCount} />
        </div>
      </div>
      <p className="mt-1.5 text-sm text-ink-soft">{entry.meaning}</p>
      <p className="mt-2.5 border-l-2 border-rule pl-2.5 text-sm italic leading-relaxed text-ink-faint">
        {entry.example}
      </p>
    </>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block border border-rule px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-ink-faint">
      {children}
    </span>
  );
}

function UsageBadge({ usedCount }: { usedCount: number }) {
  if (usedCount === 0) {
    return <Tag>unused</Tag>;
  }
  return (
    <span className="inline-block border border-vermilion/40 px-1.5 py-0.5 font-mono text-[0.6rem] uppercase tracking-[0.1em] text-vermilion">
      used ×{usedCount}
    </span>
  );
}
