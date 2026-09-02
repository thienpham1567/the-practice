/**
 * Đo độ ổn định của việc chấm bài và bóc lỗi: cùng một bài, chấm N lần.
 *
 * Không chép prompt ra đây — import thẳng hàm dựng prompt và schema mà app
 * đang dùng, để con số đo được là con số thật của sản phẩm.
 *
 * Usage:
 *   cd apps/api && npx ts-node --transpileOnly scripts/spike-grading-variance.ts [runs]
 *
 * Env: OPENROUTER_API_KEY, AI_MODEL từ apps/api/.env
 */
import "dotenv/config";
import { TASK_CATALOG, overallBand, type MarkCategory } from "@writing-helper/practice";
import { GRADE_TASK_SCHEMA, buildGradePrompt, type GradeResult } from "../src/practice/grade-prompt";
import {
  EXTRACT_MARKS_SCHEMA,
  buildMarkPrompt,
  type ExtractMarksResult,
} from "../src/practice/mark-prompt";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const RUNS = Number(process.argv[2] ?? 5);

const task = TASK_CATALOG.find((item) => item.type === "email")!;

const promptText =
  "Your friend Alex is planning to visit your city next month. Write an email to Alex " +
  "suggesting three activities you could do together, explaining why each activity would be " +
  "interesting, and asking about Alex's preferences regarding food and accommodation.";

/** Bài B1 thật, lỗi cố ý theo kiểu người Việt hay mắc. */
const essay =
  "Dear Alex,\n\n" +
  "I am very happy that you will come to my city next month. I want to suggest three " +
  "activity we can do together.\n\n" +
  "First, we can go to the old market. It have many delicious street food and you can try " +
  "the local dish. Second, I think we should visit the museum near river, because it show " +
  "the history of my city very interesting. Third, we can join a cooking class in weekend.\n\n" +
  "What kind of food do you like? Do you prefer hotel or homestay? Please tell me soon.\n\n" +
  "See you soon,\nMinh";

const wordCount = essay.split(/\s+/).filter(Boolean).length;

async function complete<T>(prompt: string, schema: { name: string; schema: Record<string, unknown> }): Promise<T> {
  const response = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.AI_MODEL ?? "anthropic/claude-haiku-4.5",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 2000,
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

function spread(values: number[]): string {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return `min ${min}  max ${max}  spread ${(max - min).toFixed(1)}  mean ${mean.toFixed(2)}`;
}

async function main(): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) throw new Error("OPENROUTER_API_KEY missing");
  console.log(`model=${process.env.AI_MODEL ?? "anthropic/claude-haiku-4.5"} runs=${RUNS} words=${wordCount}\n`);

  const gradePrompt = buildGradePrompt({ task, promptText, essay, wordCount });
  const markPrompt = buildMarkPrompt(task, promptText, essay);

  const bands: number[] = [];
  const criteria: Record<string, number[]> = {
    taskResponse: [],
    coherenceCohesion: [],
    lexicalResource: [],
    grammaticalRange: [],
  };
  /** quote -> các category mà từng lần chấm gán cho nó. */
  const quoteLabels = new Map<string, MarkCategory[]>();
  const markCounts: number[] = [];

  for (let run = 1; run <= RUNS; run++) {
    const [graded, marks] = await Promise.all([
      complete<GradeResult>(gradePrompt, GRADE_TASK_SCHEMA),
      complete<ExtractMarksResult>(markPrompt, EXTRACT_MARKS_SCHEMA),
    ]);

    const band = overallBand(graded.scores);
    bands.push(band);
    for (const key of Object.keys(criteria)) {
      criteria[key]!.push(graded.scores[key as keyof GradeResult["scores"]]);
    }

    const found = marks.marks ?? [];
    markCounts.push(found.length);
    for (const mark of found) {
      const quote = mark.quote.trim();
      if (!quoteLabels.has(quote)) quoteLabels.set(quote, []);
      quoteLabels.get(quote)!.push(mark.category);
    }

    console.log(
      `run ${run}: band ${band}  scores ${Object.values(graded.scores).join("/")}  marks ${found.length}`,
    );
  }

  console.log(`\nBAND      ${spread(bands)}`);
  for (const [name, values] of Object.entries(criteria)) {
    console.log(`${name.padEnd(20)} ${spread(values)}`);
  }
  console.log(`MARK COUNT ${spread(markCounts)}`);

  console.log(`\nMARK AGREEMENT (quote — how many of ${RUNS} runs found it — labels given)`);
  const rows = [...quoteLabels.entries()].sort((a, b) => b[1].length - a[1].length);
  for (const [quote, labels] of rows) {
    const unique = [...new Set(labels)];
    const flag = unique.length > 1 ? "  ← LABEL DISAGREES" : "";
    console.log(`  ${String(labels.length).padStart(2)}/${RUNS}  "${quote}"  [${unique.join(", ")}]${flag}`);
  }

  const everyRun = rows.filter(([, l]) => l.length === RUNS).length;
  const onceOnly = rows.filter(([, l]) => l.length === 1).length;
  const disagreed = rows.filter(([, l]) => new Set(l).size > 1).length;
  console.log(
    `\nSUMMARY  distinct quotes ${rows.length}  found every run ${everyRun}  found once only ${onceOnly}  label disagreements ${disagreed}`,
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
