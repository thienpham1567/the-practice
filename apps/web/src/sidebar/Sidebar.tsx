import type { AnalysisResult, HighlightType } from "@writing-helper/analysis";
import { useState } from "react";
import { formatReadingTime, issueRows } from "./issue-rows";

/** Chấm màu của mỗi dòng khớp đúng màu highlight trong văn bản. */
const SWATCH: Record<HighlightType, string> = {
  "very-hard-sentence": "bg-mark-very-hard",
  "hard-sentence": "bg-mark-hard",
  passive: "bg-mark-passive",
  adverb: "bg-mark-adverb",
  qualifier: "bg-mark-qualifier",
  "complex-phrase": "bg-mark-complex",
};

const GRADE_TONE = {
  Good: "text-ink",
  OK: "text-ink",
  Poor: "text-vermilion",
} as const;

interface SidebarProps {
  result: AnalysisResult | null;
}

export function Sidebar({ result }: SidebarProps) {
  if (!result) {
    return (
      <aside className="w-80 shrink-0 border-l border-rule bg-paper-deep px-6 py-10">
        <p className="text-sm italic text-ink-faint">
          Write mode hides the marks so you can get the words down. Switch to Edit when you are
          ready to cut.
        </p>
      </aside>
    );
  }

  return (
    <aside className="w-80 shrink-0 overflow-y-auto border-l border-rule bg-paper-deep px-6 py-10">
      <ReadabilityCard result={result} />
      <IssueList result={result} />
      <CountsPanel result={result} />
    </aside>
  );
}

function ReadabilityCard({ result }: { result: AnalysisResult }) {
  return (
    <section>
      <h2 className="font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        Readability
      </h2>

      {/* Con dấu của biên tập viên: khung đôi, chữ display, đóng hơi nghiêng. */}
      <div className="mt-3 inline-flex -rotate-1 flex-col items-center border-2 border-double border-vermilion px-5 py-3">
        <span className="font-display text-3xl font-semibold leading-none">
          Grade {result.grade}
        </span>
        <span
          className={`mt-1 font-mono text-[0.7rem] uppercase tracking-[0.2em] ${GRADE_TONE[result.gradeLabel]}`}
        >
          {result.gradeLabel}
        </span>
      </div>
    </section>
  );
}

function IssueList({ result }: { result: AnalysisResult }) {
  return (
    <section className="mt-9 border-t border-rule pt-6">
      <ul className="space-y-3">
        {issueRows(result).map((row) => (
          <li key={row.type} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-3 w-3 shrink-0 rounded-[2px] ${SWATCH[row.type]} ${
                row.count === 0 ? "opacity-30" : ""
              }`}
            />
            <p className={`text-sm leading-snug ${row.count === 0 ? "text-ink-faint" : ""}`}>
              {row.label}
              <span
                className={`block text-xs ${row.tone === "over" ? "text-vermilion" : "text-ink-faint"}`}
              >
                {row.note}
              </span>
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

const COUNT_VIEWS = ["words", "characters", "sentences", "paragraphs"] as const;

function CountsPanel({ result }: { result: AnalysisResult }) {
  const [viewIndex, setViewIndex] = useState(0);
  const view = COUNT_VIEWS[viewIndex]!;

  return (
    <section className="mt-9 border-t border-rule pt-6">
      <button
        type="button"
        onClick={() => setViewIndex((current) => (current + 1) % COUNT_VIEWS.length)}
        className="group text-left"
        title="Click to cycle counts"
      >
        <span className="font-mono text-2xl">{result.stats[view].toLocaleString()}</span>
        <span className="ml-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint group-hover:text-vermilion">
          {view}
        </span>
      </button>

      <p className="mt-2 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-ink-faint">
        {formatReadingTime(result.stats.readingTimeSeconds)} to read
      </p>
    </section>
  );
}
