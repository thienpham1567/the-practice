import type { CriterionScores } from "@writing-helper/practice";

export type CriteriaEntry = { label: string; comment: string };

const IELTS_CRITERIA: { key: keyof CriterionScores; label: string }[] = [
  { key: "taskResponse", label: "Task response" },
  { key: "coherenceCohesion", label: "Coherence & cohesion" },
  { key: "lexicalResource", label: "Lexical resource" },
  { key: "grammaticalRange", label: "Grammatical range" },
];

const META_KEYS = new Set(["overview", "nextFocus", "improvements"]);

const ENTRY_LABELS: Record<string, string> = {
  grammar: "Grammar",
  relevance: "Relevance",
  sentenceVariety: "Sentence variety",
  vocabulary: "Vocabulary",
  organization: "Organization",
  opinionSupport: "Opinion support",
  pronunciation: "Pronunciation",
  intonationStress: "Intonation & stress",
  taskAppropriateness: "Task appropriateness",
  delivery: "Delivery",
  languageUse: "Language use",
  taskResponse: "Task response",
  coherenceCohesion: "Coherence & cohesion",
  lexicalResource: "Lexical resource",
  grammaticalRange: "Grammatical range",
  fluencyCoherence: "Fluency & coherence",
};

/** Turn a feedback object into comment-only rows, skipping overview/nextFocus. */
export function criteriaEntries(feedback: object): CriteriaEntry[] {
  const entries: CriteriaEntry[] = [];
  for (const [key, value] of Object.entries(feedback)) {
    if (META_KEYS.has(key) || typeof value !== "string" || !value.trim()) continue;
    entries.push({ label: ENTRY_LABELS[key] ?? key, comment: value });
  }
  return entries;
}

interface CriteriaBarsProps {
  entries: CriteriaEntry[];
}

/** TOEIC criteria: labels + comments only — no 0–9 bars. */
export function CriteriaBars({ entries }: CriteriaBarsProps) {
  return (
    <ul className="space-y-5">
      {entries.map((entry) => (
        <li key={entry.label}>
          <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-soft">
            {entry.label}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">{entry.comment}</p>
        </li>
      ))}
    </ul>
  );
}

interface IeltsCriteriaBarsProps {
  scores: CriterionScores;
  feedback: Partial<Record<keyof CriterionScores, string>>;
}

/** Legacy IELTS 0–9 bars. Only for `scale === "ielts"` attempts. */
export function IeltsCriteriaBars({ scores, feedback }: IeltsCriteriaBarsProps) {
  return (
    <ul className="space-y-5">
      {IELTS_CRITERIA.map((criterion) => {
        const score = scores[criterion.key];
        return (
          <li key={criterion.key}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-soft">
                {criterion.label}
              </h3>
              <span className="font-display text-lg leading-none">{score}</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rule">
              <div
                className="h-full rounded-full bg-vermilion"
                style={{ width: `${(score / 9) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{feedback[criterion.key]}</p>
          </li>
        );
      })}
    </ul>
  );
}
