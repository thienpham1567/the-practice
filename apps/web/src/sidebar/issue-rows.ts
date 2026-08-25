import type { AnalysisResult, HighlightType } from "@writing-helper/analysis";

export interface IssueRow {
  type: HighlightType;
  count: number;
  label: string;
  note: string;
  /** "over" khi vượt ngưỡng khuyến nghị — chỉ áp dụng cho adverb và passive. */
  tone: "met" | "over" | "neutral";
}

function plural(count: number, singular: string, pluralForm = `${singular}s`): string {
  return count === 1 ? singular : pluralForm;
}

/** Các dòng đếm lỗi trong sidebar, theo đúng thứ tự hiển thị. */
export function issueRows(result: AnalysisResult): IssueRow[] {
  const { counts, goals, stats } = result;
  const ofSentences = `of ${stats.sentences} ${plural(stats.sentences, "sentence")}`;

  return [
    {
      type: "very-hard-sentence",
      count: counts.veryHardSentences,
      label: `${counts.veryHardSentences} ${ofSentences} very hard to read`,
      note: "Split them.",
      tone: "neutral",
    },
    {
      type: "hard-sentence",
      count: counts.hardSentences,
      label: `${counts.hardSentences} ${ofSentences} hard to read`,
      note: "Shorten them.",
      tone: "neutral",
    },
    {
      type: "adverb",
      count: counts.adverbs,
      label: `${counts.adverbs} ${plural(counts.adverbs, "adverb")}`,
      note:
        counts.adverbs <= goals.adverbs
          ? `meeting the goal of ${goals.adverbs} or fewer`
          : `aim for ${goals.adverbs} or fewer`,
      tone: counts.adverbs <= goals.adverbs ? "met" : "over",
    },
    {
      type: "passive",
      count: counts.passives,
      label: `${counts.passives} ${plural(counts.passives, "use")} of passive voice`,
      note:
        counts.passives <= goals.passives
          ? `meeting the goal of ${goals.passives} or fewer`
          : `aim for ${goals.passives} or fewer`,
      tone: counts.passives <= goals.passives ? "met" : "over",
    },
    {
      type: "complex-phrase",
      count: counts.complexPhrases,
      label: `${counts.complexPhrases} ${plural(counts.complexPhrases, "phrase")} with a simpler alternative`,
      note: "Swap them.",
      tone: "neutral",
    },
    {
      type: "qualifier",
      count: counts.qualifiers,
      label: `${counts.qualifiers} weakening ${plural(counts.qualifiers, "phrase")}`,
      note: "Say it plainly.",
      tone: "neutral",
    },
  ];
}

/** Thời gian đọc dạng người đọc được: "45 sec", "2 min 5 sec". */
export function formatReadingTime(seconds: number): string {
  if (seconds < 60) return `${seconds} sec`;

  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;

  return rest === 0 ? `${minutes} min` : `${minutes} min ${rest} sec`;
}
