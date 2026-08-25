/**
 * Interface công khai của package.
 *
 * Chỉ `analyze()` và các type kết quả được export. Tokenizer, rules và
 * readability là chi tiết implementation — `Rule` là internal seam, dùng cho
 * unit test bên trong package, không rò rỉ ra caller.
 */
export { analyze } from "./analyze.js";
export { gradeLabelFor } from "./readability.js";
export { locateSentence } from "./sentence-lookup.js";
export type {
  AnalysisResult,
  GradeLabel,
  Highlight,
  HighlightType,
  IssueCounts,
  IssueGoals,
  SentenceContext,
  SentenceSpan,
  TextStats,
} from "./types.js";
