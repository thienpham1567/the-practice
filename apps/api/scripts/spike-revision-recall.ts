/**
 * Đo lại đúng bug đã báo: một lượt bóc lỗi có bắt được hết lỗi đã cài sẵn
 * không, và bài đã sửa sạch có còn bị báo lại lỗi cũ (hoặc lỗi mới bịa ra)
 * không. Đây là ca tái hiện gốc của
 * docs/superpowers/specs/2026-09-14-grading-exhaustiveness-design.md —
 * essay và danh sách lỗi cài sẵn lấy nguyên từ phiên điều tra đó.
 *
 * Không chép prompt ra đây — import thẳng hàm dựng prompt/schema mà app đang
 * dùng, để đo đúng con số thật của sản phẩm (kể cả sau khi prompt đổi).
 *
 * Usage:
 *   cd apps/api && npx ts-node --transpileOnly scripts/spike-revision-recall.ts
 *
 * Env: OPENROUTER_API_KEY, AI_MODEL từ apps/api/.env
 *
 * Kỳ vọng thực tế (đo 2 lần khi viết script này): recall vòng 1 dao động
 * 73–82%, không phải 100% — extract+verify cải thiện rõ rệt so với 1 lượt cũ
 * (từng để lọt 3/12 ở essay này) nhưng không đảm bảo tuyệt đối, đúng như spec
 * đã nói. Lỗi khó bắt nhất trong bài mẫu này là các lỗi dấu câu/comma-splice
 * ("However I think", "I have a car, I can carry") — cả hai lần chạy đều sót.
 * Vòng 2 (bài đã sửa hết) không bao giờ báo lại đúng 1 trong 11 lỗi cũ, chỉ
 * thấy gợi ý mới (đôi khi có false positive nhẹ, ví dụ "I hear" -> "I heard"
 * — nằm ngoài phạm vi sửa của bug này).
 */
import "dotenv/config";
import { TASK_CATALOG } from "@writing-helper/practice";
import {
  EXTRACT_MARKS_SCHEMA,
  VERIFY_MARKS_SCHEMA,
  buildMarkPrompt,
  buildVerifyMarksPrompt,
  type ExtractMarksResult,
  type RawWritingMark,
  type VerifyMarksResult,
} from "../src/practice/mark-prompt";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const task = TASK_CATALOG.find((item) => item.type === "email")!;

const promptText =
  "Your English-speaking friend Alex is moving to a new apartment next month. Write an email " +
  "offering to help with the move and suggesting specific ways you could assist. Ask about the " +
  "moving date and what type of help would be most useful.";

/** Bài gốc với 11 lỗi cài sẵn, xác nhận từng ký tự bằng offset trong phiên điều tra gốc. */
const BROKEN_ESSAY =
  "Dear Alex,\n\n" +
  "I hear you moving to new apartment next month, that's great news! I am very exciting to help " +
  "you with the move.\n\n" +
  "I have a car, I can carry heavy boxs to your new place. Me and my brother is free all " +
  "Saturday, so we can come early. However I think Sunday might be better for you too.\n\n" +
  "I am interested on knowing more about your new place. Could you tell me when exactly you " +
  "moving? Very much I want to help you settle in fast.\n\n" +
  "I will recieve your reply soon. Please let me know what type of help would be most useful.\n\n" +
  "Best,\nSam";

/** Từng lỗi cài sẵn: đoạn trích nguyên văn trong BROKEN_ESSAY (để đối chiếu mark tìm được). */
const PLANTED: readonly string[] = [
  "you moving", // verb-tense: thiếu "are" (lần 1)
  "new apartment", // article: thiếu "a"
  "very exciting", // word-form: exciting -> excited
  "boxs", // noun-number: boxs -> boxes
  "Me and my brother is free", // subject-verb-agreement: is -> are
  "Me and my brother", // pronoun: Me -> My brother and I
  "I have a car, I can carry", // sentence-structure: comma splice
  "However I think", // punctuation: thiếu dấu phẩy sau However
  "interested on", // preposition: on -> in
  "when exactly you moving", // verb-tense: thiếu "are" (lần 2, occurrence khác của "you moving")
  "recieve", // spelling: recieve -> receive
];

/** Cùng bài, đã sửa hết 11 lỗi trên — dùng để kiểm tra bài sạch không bị báo lại lỗi cũ. */
const FIXED_ESSAY =
  "Hi Alex,\n\n" +
  "I hear you are moving to a new apartment next month. That's great news! I am very excited " +
  "to help you with the move.\n\n" +
  "I have a car, so I can carry heavy boxes to your new place. My brother and I are free all " +
  "Saturday, so we can come early. However, I think Sunday might be better for you too.\n\n" +
  "I am interested in knowing more about your new place. Could you tell me when exactly you " +
  "are moving? I very much want to help you settle in quickly.\n\n" +
  "I look forward to your reply soon. Please let me know what type of help would be most " +
  "useful.\n\n" +
  "Warm regards,\nSam";

async function complete<T>(
  prompt: string,
  schema: { name: string; schema: Record<string, unknown> },
  maxTokens: number,
): Promise<T> {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL ?? "anthropic/claude-haiku-4.5",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      response_format: {
        type: "json_schema",
        json_schema: { name: schema.name, strict: true, schema: schema.schema },
      },
    }),
  });
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`);
  const body = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  return JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as T;
}

/** Chạy đúng pipeline extract→verify mà practice.service.ts dùng khi nộp bài. */
async function extractMarks(essay: string): Promise<RawWritingMark[]> {
  const first = await complete<ExtractMarksResult>(
    buildMarkPrompt(task, promptText, essay),
    EXTRACT_MARKS_SCHEMA,
    2000,
  );
  const found = first.marks ?? [];
  const verify = await complete<VerifyMarksResult>(
    buildVerifyMarksPrompt(task, promptText, essay, found),
    VERIFY_MARKS_SCHEMA,
    1500,
  );
  return [...found, ...(verify.marks ?? [])];
}

function reportRecall(marks: RawWritingMark[], planted: readonly string[]): void {
  const quotes = marks.map((m) => m.quote);
  const hit = (needle: string) => quotes.some((q) => q.includes(needle) || needle.includes(q));

  console.log(`Marks found: ${marks.length}`);
  for (const m of marks) {
    console.log(`  [${m.category}] "${m.quote}" -> "${m.correction}"`);
  }

  console.log(`\nPlanted mistakes: ${planted.length}`);
  let caught = 0;
  for (const p of planted) {
    const ok = hit(p);
    if (ok) caught++;
    console.log(`  ${ok ? "✓" : "✗ MISSED"}  "${p}"`);
  }
  console.log(`\nRecall: ${caught}/${planted.length} (${((100 * caught) / planted.length).toFixed(0)}%)`);
}

async function main(): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY missing");
  console.log(`model=${process.env.AI_MODEL ?? "anthropic/claude-haiku-4.5"}\n`);

  console.log("=== ROUND 1: bài có 11 lỗi cài sẵn ===\n");
  const roundOneMarks = await extractMarks(BROKEN_ESSAY);
  reportRecall(roundOneMarks, PLANTED);

  console.log("\n=== ROUND 2: cùng bài, đã sửa hết — không được báo lại lỗi cũ ===\n");
  const roundTwoMarks = await extractMarks(FIXED_ESSAY);
  console.log(`Marks found on the fixed essay: ${roundTwoMarks.length} (kỳ vọng 0, hoặc chỉ vài gợi ý nhỏ không liên quan tới 11 lỗi đã sửa)`);
  for (const m of roundTwoMarks) {
    console.log(`  [${m.category}] "${m.quote}" -> "${m.correction}"`);
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
