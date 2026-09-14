import { MARK_CATEGORIES } from "@writing-helper/practice";
import type { MarkCategory, TaskSpec, WritingMark } from "@writing-helper/practice";
import type { JsonSchemaSpec } from "../ai/ai.service";

/**
 * What the model returns. No `severity`: the tier belongs to the label, and is
 * derived in `resolveWritingMarks` rather than asked for and reconciled.
 */
export interface RawWritingMark {
  quote: string;
  occurrence: number;
  category: MarkCategory;
  correction: string;
  note: string;
}

/** A stylistic upgrade on already-correct text — resolved the same way as marks. */
export interface RawEnhancement {
  quote: string;
  occurrence: number;
  suggestion: string;
  note: string;
}

export interface ExtractMarksResult {
  marks: RawWritingMark[];
  enhancements: RawEnhancement[];
}

/** A mistake already found in an earlier pass — just enough to avoid repeats. */
export interface PriorMarkContext {
  quote: string;
  category: MarkCategory;
  correction: string;
}

/** Resolved marks only carry offsets — recover the quote text for the prompt. */
export function toPriorMarkContext(
  plainText: string,
  marks: WritingMark[],
): PriorMarkContext[] {
  return marks.map((mark) => ({
    quote: plainText.slice(mark.start, mark.end),
    category: mark.category,
    correction: mark.correction,
  }));
}

const MARK_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["quote", "occurrence", "category", "correction", "note"],
  properties: {
    quote: { type: "string" },
    occurrence: { type: "integer", minimum: 1 },
    category: { type: "string", enum: [...MARK_CATEGORIES] },
    correction: { type: "string" },
    note: { type: "string" },
  },
} as const;

const ENHANCEMENT_ITEM_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["quote", "occurrence", "suggestion", "note"],
  properties: {
    quote: { type: "string" },
    occurrence: { type: "integer", minimum: 1 },
    suggestion: { type: "string" },
    note: { type: "string" },
  },
} as const;

export const EXTRACT_MARKS_SCHEMA: JsonSchemaSpec = {
  name: "practice_marks",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["marks", "enhancements"],
    properties: {
      marks: { type: "array", items: MARK_ITEM_SCHEMA },
      enhancements: { type: "array", items: ENHANCEMENT_ITEM_SCHEMA },
    },
  },
};

export interface VerifyMarksResult {
  marks: RawWritingMark[];
}

export const VERIFY_MARKS_SCHEMA: JsonSchemaSpec = {
  name: "practice_marks_verify",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["marks"],
    properties: {
      marks: { type: "array", items: MARK_ITEM_SCHEMA },
    },
  },
};

/**
 * Đọc trước khi sửa: mỗi lần chấm bài từng làm đúng 1 lần liệt kê "mọi lỗi" —
 * xác suất một lượt sinh duy nhất luôn bỏ sót vài lỗi, và bài revision quét lại
 * từ số 0 nên lỗi bị sót ở vòng trước lại "mới lộ ra" ở vòng sau. Hai phần
 * chống điều đó: (1) ép quét có hệ thống theo từng category thay vì kiểu chung
 * chung "liệt kê mọi lỗi", (2) `buildVerifyMarksPrompt` gọi thêm một lượt thứ
 * hai rà lại. Xem docs/superpowers/specs/2026-09-14-grading-exhaustiveness-design.md.
 */
function systematicScanInstruction(): string {
  return (
    `Check the response against EVERY one of these mistake categories, one at a ` +
    `time, before answering — do not stop at the first few mistakes you notice:\n` +
    MARK_CATEGORIES.map((c) => `- ${c}`).join("\n") +
    `\n\n`
  );
}

/**
 * Chống mark "gộp thừa": model từng báo đúng 2 lỗi atomic ("you moving" thiếu
 * "are", "new apartment" thiếu "a") RỒI báo thêm mark thứ 3 bao trùm cả câu với
 * correction gộp cả hai — 3 mark cho 2 lỗi thật. Đây không phải trường hợp "hai
 * lỗi thật trùng span" (xem mục 3 của spec, đã khảo sát và validate là không
 * nên gộp ở tầng code) — nên xử lý bằng chỉ dẫn prompt thay vì dedupe span.
 */
function noBundlingInstruction(): string {
  return (
    `Quote the SMALLEST span that still contains the mistake — never a whole ` +
    `sentence or clause when a shorter substring already isolates it. If you have ` +
    `already reported two separate small mistakes, do NOT also report a third, ` +
    `wider mark whose correction just restates both of them together — report ` +
    `each real mistake exactly once, at its smallest span.\n\n`
  );
}

function priorMarksContext(prior: PriorMarkContext[]): string {
  if (prior.length === 0) return "";
  const list = prior
    .map((m, i) => `${i + 1}. [${m.category}] "${m.quote}" → "${m.correction}"`)
    .join("\n");
  return (
    `This is a revision. The writer previously received these corrections and ` +
    `attempted to apply them:\n${list}\n\n` +
    `Judge the response below on its own merits — some of these may still be ` +
    `wrong, fixed differently than suggested, or reintroduced. Do not assume any ` +
    `of them are resolved just because they were pointed out before.\n\n`
  );
}

export function buildMarkPrompt(
  task: TaskSpec,
  promptText: string,
  essay: string,
  priorMarks: PriorMarkContext[] = [],
): string {
  return (
    `You mark language mistakes in English exam writing.\n\n` +
    `Task type: ${task.label}\n` +
    `Assignment given to the writer:\n${promptText}\n\n` +
    // Register only means anything against a reader. The task type alone says
    // "an email"; the assignment says whether it goes to a friend or a landlord.
    `Judge register against that assignment — who the writer is addressing, and why.\n\n` +
    priorMarksContext(priorMarks) +
    `Writer's response:\n${essay}\n\n` +
    systematicScanInstruction() +
    `For each mistake:\n` +
    `- "quote": copy the exact substring from the response, character for character. ` +
    `Never paraphrase it and never fix it inside the quote.\n` +
    `- "occurrence": 1 if that substring appears once in the response; otherwise ` +
    `which occurrence you mean, counting from 1.\n` +
    `- "category": the closest label from the fixed list.\n` +
    `- "correction": the corrected version of the quoted span only.\n` +
    `- "note": one short sentence saying why, written for a learner.\n\n` +
    noBundlingInstruction() +
    `Do not comment on style, sentence length, or word count in "marks" — only ` +
    `language mistakes and unnatural word choice or register. Return an empty ` +
    `list if there are none.\n\n` +
    `Separately, return "enhancements": spots that are grammatically CORRECT but ` +
    `could read more naturally or more strongly (a plainer word that could be more ` +
    `precise, a flat sentence that could be more engaging). Do not duplicate ` +
    `anything already in "marks" — enhancements are for correct text only. Same ` +
    `quote/occurrence rules, plus "suggestion" (the improved wording) and "note" ` +
    `(why it's better). Return an empty list if the response is already strong ` +
    `throughout — do not force enhancements onto a short, plain but correct response.`
  );
}

export function buildVerifyMarksPrompt(
  task: TaskSpec,
  promptText: string,
  essay: string,
  found: RawWritingMark[],
): string {
  const foundList =
    found.length > 0
      ? found.map((m, i) => `${i + 1}. [${m.category}] "${m.quote}" → "${m.correction}"`).join("\n")
      : "(none found yet)";

  return (
    `You already reviewed this English exam response once and found these mistakes:\n` +
    `${foundList}\n\n` +
    `Task type: ${task.label}\n` +
    `Assignment given to the writer:\n${promptText}\n\n` +
    `Writer's response:\n${essay}\n\n` +
    `Review it one more time. ` +
    systematicScanInstruction() +
    `Return ONLY mistakes that are NOT already in the list above — do not repeat ` +
    `them, do not rephrase them, and do not report a wider span that bundles an ` +
    `already-found mistake together with something else. Same fields as before: ` +
    `quote (exact substring, smallest span), occurrence, category, correction, note. ` +
    `Return an empty list if a careful re-read finds nothing new.`
  );
}
