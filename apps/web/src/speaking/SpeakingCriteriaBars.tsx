import type { SpeakingFeedback, SpeakingScores } from "../api/speaking";

const CRITERIA: { key: keyof SpeakingScores; label: string }[] = [
  { key: "fluencyCoherence", label: "Fluency & coherence" },
  { key: "lexicalResource", label: "Lexical resource" },
  { key: "grammaticalRange", label: "Grammatical range" },
  { key: "pronunciation", label: "Pronunciation" },
];

interface SpeakingCriteriaBarsProps {
  scores: SpeakingScores;
  feedback: SpeakingFeedback;
}

export function SpeakingCriteriaBars({ scores, feedback }: SpeakingCriteriaBarsProps) {
  return (
    <ul className="space-y-5">
      {CRITERIA.map((criterion) => {
        const score = scores[criterion.key];
        return (
          <li key={criterion.key}>
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="font-mono text-[0.7rem] uppercase tracking-[0.15em] text-ink-soft">
                {criterion.label}
              </h3>
              <span className="font-display text-lg leading-none">{score}</span>
            </div>
            <div className="mt-1.5 h-px bg-rule">
              <div className="h-px bg-vermilion" style={{ width: `${(score / 9) * 100}%` }} />
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{feedback[criterion.key]}</p>
          </li>
        );
      })}
    </ul>
  );
}
