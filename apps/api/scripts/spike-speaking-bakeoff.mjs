#!/usr/bin/env node
/**
 * Milestone 1.2 bake-off: same WAV + grading-style JSON prompt across audio models.
 *
 * Usage:
 *   node apps/api/scripts/spike-speaking-bakeoff.mjs [path/to/audio.wav|mp3]
 *
 * Env: OPENROUTER_API_KEY from apps/api/.env (or process env).
 */
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, join, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const apiRoot = join(__dirname, '..');
const envPath = join(apiRoot, '.env');

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(envPath);

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
  console.error('Missing OPENROUTER_API_KEY (apps/api/.env or env)');
  process.exit(1);
}

const REFERENCE =
  'Good morning. Today I would like to talk about learning English through speaking practice. When we speak aloud, we train our brain to retrieve words quickly and build confidence. Short daily sessions of fifteen to thirty seconds can help us notice pronunciation mistakes and improve fluency over time. Thank you for listening.';

const GRADING_PROMPT = `You are an IELTS Speaking examiner grading a Part 2 response from audio.

Listen carefully, then reply with ONLY valid JSON (no markdown fences) matching this schema exactly:
{
  "transcript": "...",
  "marks": [{"quote":"...","kind":"pronunciation|hesitation|grammar|filler","note":"..."}],
  "scores": {"fluencyCoherence":0,"lexicalResource":0,"grammaticalRange":0,"pronunciation":0},
  "feedback": {"strengths":[],"improvements":[]}
}

Rules:
- transcript: verbatim what you hear (plain text).
- marks: quote must be a contiguous substring of transcript; kind one of pronunciation|hesitation|grammar|filler.
- scores: integers 0–9 (IELTS band style for each criterion).
- feedback.strengths / improvements: short string arrays.
- If the speech is clean TTS with no clear faults, marks may be empty and scores may be high — still fill all fields.`;

const MODELS = [
  { id: 'google/gemini-2.5-flash', max_tokens: 4000 },
  { id: 'openai/gpt-audio-mini', max_tokens: 4000 },
  { id: 'google/gemini-2.5-flash-lite', max_tokens: 4000 },
];

const audioPath = resolve(
  process.argv[2] ?? '/tmp/speaking-spike.wav',
);
if (!existsSync(audioPath)) {
  console.error(`Audio file not found: ${audioPath}`);
  process.exit(1);
}

const ext = extname(audioPath).toLowerCase().replace('.', '');
const format = ext === 'mp3' ? 'mp3' : ext === 'wav' ? 'wav' : ext;
if (format !== 'wav' && format !== 'mp3') {
  console.error(`Unsupported extension .${ext}; use .wav or .mp3`);
  process.exit(1);
}

const bytes = readFileSync(audioPath);
const base64 = bytes.toString('base64');

console.log(`File: ${audioPath}`);
console.log(`Format: ${format}`);
console.log(`Bytes: ${bytes.length}`);
console.log(`Models: ${MODELS.map((m) => m.id).join(', ')}`);
console.log('');

function extractJson(text) {
  if (typeof text !== 'string') return null;
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // strip markdown fences if present
    const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) {
      try {
        return JSON.parse(fence[1].trim());
      } catch {
        /* fall through */
      }
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function validateSchema(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.transcript !== 'string') return false;
  if (!Array.isArray(obj.marks)) return false;
  for (const m of obj.marks) {
    if (!m || typeof m.quote !== 'string' || typeof m.kind !== 'string') return false;
  }
  const s = obj.scores;
  if (
    !s ||
    typeof s.fluencyCoherence !== 'number' ||
    typeof s.lexicalResource !== 'number' ||
    typeof s.grammaticalRange !== 'number' ||
    typeof s.pronunciation !== 'number'
  ) {
    return false;
  }
  const f = obj.feedback;
  if (!f || !Array.isArray(f.strengths) || !Array.isArray(f.improvements)) return false;
  return true;
}

function normalizeWords(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function transcriptAccuracyNotes(transcript) {
  if (!transcript) return 'no transcript';
  const ref = normalizeWords(REFERENCE);
  const got = normalizeWords(transcript);
  const refSet = new Set(ref);
  const gotSet = new Set(got);
  const missing = ref.filter((w) => !gotSet.has(w));
  const extra = got.filter((w) => !refSet.has(w));
  const uniqueMissing = [...new Set(missing)];
  const uniqueExtra = [...new Set(extra)];
  // rough word-level overlap
  let match = 0;
  const gotCopy = [...got];
  for (const w of ref) {
    const i = gotCopy.indexOf(w);
    if (i >= 0) {
      match++;
      gotCopy.splice(i, 1);
    }
  }
  const recall = ref.length ? ((match / ref.length) * 100).toFixed(0) : '0';
  const parts = [`~${recall}% word overlap vs say-ref`];
  if (uniqueMissing.length) parts.push(`missing: ${uniqueMissing.slice(0, 8).join(', ')}`);
  if (uniqueExtra.length) parts.push(`extra: ${uniqueExtra.slice(0, 8).join(', ')}`);
  return parts.join('; ');
}

async function runModel(model) {
  const body = {
    model: model.id,
    max_tokens: model.max_tokens,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'text', text: GRADING_PROMPT },
          {
            type: 'input_audio',
            input_audio: { data: base64, format },
          },
        ],
      },
    ],
  };

  const started = Date.now();
  let res;
  let raw;
  try {
    res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://writing-helper.local',
        'X-Title': 'speaking-audio-bakeoff',
      },
      body: JSON.stringify(body),
    });
    raw = await res.text();
  } catch (err) {
    return {
      model: model.id,
      latencyMs: Date.now() - started,
      httpOk: false,
      httpStatus: 0,
      validJson: false,
      finishReason: null,
      usage: null,
      transcriptNotes: `request error: ${err?.message ?? err}`,
      skipped: false,
      contentPreview: null,
      parsed: null,
      errorBody: String(err),
    };
  }

  const latencyMs = Date.now() - started;
  const httpOk = res.ok;
  let json = null;
  try {
    json = JSON.parse(raw);
  } catch {
    json = null;
  }

  if (res.status === 404) {
    return {
      model: model.id,
      latencyMs,
      httpOk: false,
      httpStatus: 404,
      validJson: false,
      finishReason: null,
      usage: null,
      transcriptNotes: '404 — model not available; skipped',
      skipped: true,
      contentPreview: raw.slice(0, 500),
      parsed: null,
      errorBody: raw.slice(0, 2000),
    };
  }

  const content =
    json?.choices?.[0]?.message?.content ??
    json?.choices?.[0]?.text ??
    null;
  const finishReason =
    json?.choices?.[0]?.finish_reason ??
    json?.choices?.[0]?.native_finish_reason ??
    null;
  const usage = json?.usage ?? null;

  let contentText = content;
  if (Array.isArray(content)) {
    contentText = content
      .map((p) => (typeof p === 'string' ? p : p?.text ?? ''))
      .join('');
  }

  const parsed = extractJson(contentText ?? '');
  const validJson = validateSchema(parsed);
  const transcriptNotes = httpOk
    ? transcriptAccuracyNotes(parsed?.transcript ?? (typeof contentText === 'string' ? contentText : ''))
    : `HTTP ${res.status}`;

  return {
    model: model.id,
    latencyMs,
    httpOk,
    httpStatus: res.status,
    validJson,
    finishReason,
    usage,
    transcriptNotes,
    skipped: false,
    contentPreview:
      typeof contentText === 'string' ? contentText.slice(0, 400) : null,
    parsed,
    errorBody: httpOk ? null : raw.slice(0, 2000),
    marksCount: Array.isArray(parsed?.marks) ? parsed.marks.length : null,
    scores: parsed?.scores ?? null,
  };
}

const results = [];
for (const model of MODELS) {
  console.log(`\n=== ${model.id} (max_tokens=${model.max_tokens}) ===`);
  const r = await runModel(model);
  results.push(r);
  console.log(`HTTP: ${r.httpStatus} ok=${r.httpOk} skipped=${r.skipped}`);
  console.log(`Latency: ${r.latencyMs} ms`);
  console.log(`finish_reason: ${r.finishReason ?? '(none)'}`);
  if (r.usage) {
    console.log(
      `Usage: prompt=${r.usage.prompt_tokens ?? '?'} completion=${r.usage.completion_tokens ?? '?'} total=${r.usage.total_tokens ?? '?'}`,
    );
    if (r.usage.prompt_tokens_details) {
      console.log(
        'prompt_tokens_details:',
        JSON.stringify(r.usage.prompt_tokens_details),
      );
    }
  } else {
    console.log('Usage: (none)');
  }
  console.log(`valid JSON: ${r.validJson}`);
  console.log(`transcript notes: ${r.transcriptNotes}`);
  if (r.parsed?.transcript) {
    console.log(`transcript: ${r.parsed.transcript.slice(0, 200)}…`);
  } else if (r.contentPreview) {
    console.log(`content preview: ${r.contentPreview}`);
  }
  if (r.errorBody) {
    console.log(`error: ${r.errorBody.slice(0, 800)}`);
  }
}

const outPath = '/tmp/speaking-spike/bakeoff-results.json';
writeFileSync(outPath, JSON.stringify({ reference: REFERENCE, results }, null, 2));
console.log(`\nWrote ${outPath}`);

console.log('\n## Bake-off summary');
console.log(
  '| Model | Latency | HTTP ok | Valid JSON | finish_reason | Tokens (p/c/t) | Transcript notes |',
);
console.log('|---|---|---|---|---|---|---|');
for (const r of results) {
  const u = r.usage;
  const tok = u
    ? `${u.prompt_tokens ?? '?'}/${u.completion_tokens ?? '?'}/${u.total_tokens ?? '?'}`
    : '—';
  console.log(
    `| ${r.model} | ${r.latencyMs} ms | ${r.httpOk ? 'yes' : `no (${r.httpStatus})`} | ${r.skipped ? 'skipped' : r.validJson ? 'yes' : 'no'} | ${r.finishReason ?? '—'} | ${tok} | ${r.transcriptNotes} |`,
  );
}
