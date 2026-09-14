import type { JsonSchemaSpec } from "../ai/ai.service";
import {
  GRADE_TASK_SCHEMA,
  type GradeInput,
  type GradeResult,
} from "./grade-prompt";
import type { PriorMarkContext } from "./mark-prompt";

export type FeedbackAuditStatus = "resolved" | "partial" | "unresolved";

export interface FeedbackAuditItem {
  point: string;
  status: FeedbackAuditStatus;
}

export interface RevisionGradeInput extends GradeInput {
  parentFeedback: GradeResult["feedback"];
  parentBand: number;
  level?: string;
  /** Specific mistakes flagged on the parent, so feedback doesn't reverse a
   * recommendation the writer already followed (e.g. "use a formal closing"
   * then, next round, "that closing is too formal"). */
  parentMarks: PriorMarkContext[];
}

export interface RevisionGradeResult extends GradeResult {
  feedbackAudit: FeedbackAuditItem[];
}

const AUDIT_STATUSES = new Set<FeedbackAuditStatus>([
  "resolved",
  "partial",
  "unresolved",
]);

export function parseFeedbackAudit(raw: unknown): FeedbackAuditItem[] | null {
  if (!Array.isArray(raw)) return null;

  const items: FeedbackAuditItem[] = [];
  for (const entry of raw) {
    if (
      entry == null ||
      typeof entry !== "object" ||
      typeof (entry as { point?: unknown }).point !== "string" ||
      typeof (entry as { status?: unknown }).status !== "string" ||
      !AUDIT_STATUSES.has((entry as { status: string }).status as FeedbackAuditStatus)
    ) {
      return null;
    }
    items.push({
      point: (entry as { point: string }).point,
      status: (entry as { status: FeedbackAuditStatus }).status,
    });
  }
  return items;
}

const gradeSchema = GRADE_TASK_SCHEMA.schema as {
  type: string;
  additionalProperties: boolean;
  required: string[];
  properties: Record<string, unknown>;
};

export const REVISION_GRADE_SCHEMA: JsonSchemaSpec = {
  name: "practice_revision_grade",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [...gradeSchema.required, "feedbackAudit"],
    properties: {
      ...gradeSchema.properties,
      feedbackAudit: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["point", "status"],
          properties: {
            point: { type: "string" },
            status: {
              type: "string",
              enum: ["resolved", "partial", "unresolved"],
            },
          },
        },
      },
    },
  },
};

function formatFeedbackPoints(feedback: GradeResult["feedback"]): string {
  return (
    `- Task Response: ${feedback.taskResponse}\n` +
    `- Coherence and Cohesion: ${feedback.coherenceCohesion}\n` +
    `- Lexical Resource: ${feedback.lexicalResource}\n` +
    `- Grammatical Range: ${feedback.grammaticalRange}\n` +
    `- Overview: ${feedback.overview}\n` +
    `- Next focus: ${feedback.nextFocus}`
  );
}

/**
 * Quan sát thực tế: vòng 1 khuyên "Best," → "Best regards," (trang trọng
 * hơn); người học làm theo; vòng 2 lại chê "Best regards," quá trang trọng,
 * khuyên đổi sang "Warm regards,". Nguyên nhân là revision-grade-prompt trước
 * đây chỉ nhận feedback tường thuật (đoạn văn chung chung), không có "trí nhớ"
 * cụ thể về từng khuyến nghị đã đưa. Truyền thẳng danh sách mark cụ thể của
 * vòng trước để chặn việc tự đá nhau này.
 */
function formatParentMarks(marks: PriorMarkContext[]): string {
  if (marks.length === 0) return "";
  const list = marks
    .map((m, i) => `${i + 1}. [${m.category}] "${m.quote}" → "${m.correction}"`)
    .join("\n");
  return (
    `Specific corrections given last round:\n${list}\n\n` +
    `The writer attempted to apply these. Do not reverse a recommendation you ` +
    `see was followed (e.g. do not now call a change too formal/informal when ` +
    `that is exactly the direction you previously suggested) unless the result ` +
    `is genuinely wrong — focus new feedback on points not covered above.\n\n`
  );
}

export function buildRevisionGradePrompt(input: RevisionGradeInput): string {
  const levelLine = input.level ? `Learner level: ${input.level}\n` : "";

  return (
    `You are an IELTS Writing examiner. Score this revised English response on the four official criteria.\n\n` +
    `Task type: ${input.task.label}\n` +
    levelLine +
    `Instruction: ${input.task.instruction}\n` +
    `Prompt given to the writer:\n${input.promptText}\n\n` +
    `Expected length: ${input.task.minWords}–${input.task.maxWords} words. ` +
    `The writer produced ${input.wordCount} words.\n` +
    `If the response is under the minimum length, lower Task Response, as IELTS does for short answers.\n\n` +
    `This is a revision of a previous attempt that scored band ${input.parentBand}. ` +
    `Do not receive or compare against the previous essay text — grade only this new response, ` +
    `and audit whether each previous feedback point was addressed.\n\n` +
    `Previous feedback points to audit:\n${formatFeedbackPoints(input.parentFeedback)}\n\n` +
    formatParentMarks(input.parentMarks) +
    `Writer's revised response:\n${input.essay}\n\n` +
    `Give each criterion a score from 0 to 9 in 0.5 steps. ` +
    `Do not compute an overall band — the server will do that. ` +
    `For feedback, comment on each criterion, add a short overview, and name one concrete thing to do better next time. ` +
    `Also return "improvements": 2-3 short, concrete suggestions for making this specific response ` +
    `better beyond fixing mistakes. Ground each one in this response, not generic advice.\n\n` +
    `Also return feedbackAudit: for every previous feedback point above, copy the point text ` +
    `UNCHANGED and mark it resolved, partial, or unresolved. Base that judgment strictly on the ` +
    `revised response printed above — do not rely on memory of the earlier draft, and do not state ` +
    `that a specific mistake is still present unless you can point to it in the text you were just given.`
  );
}
