#!/usr/bin/env node
/**
 * Bài đo: AI có thật sự NGHE không, hay đang viết theo cue card?
 *
 * Đọc bản ghi của probe-speaking-script.md (nội dung đã biết trước, lỗi cài sẵn),
 * gửi tới từng model bằng đúng prompt + schema app đang dùng, rồi chấm ngược lại
 * chính AI theo đáp án.
 *
 *   node apps/api/scripts/probe-speaking-quality.mjs ~/Downloads/probe.wav
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const KEY = process.env.OPENROUTER_API_KEY ?? readEnvKey();
if (!KEY) {
  console.error('Thiếu OPENROUTER_API_KEY (apps/api/.env hoặc biến môi trường).');
  process.exit(1);
}

const MODELS = [
  'google/gemini-2.5-flash',
  'openai/gpt-audio-mini',
  'google/gemini-2.5-flash-lite',
];

const CUE = {
  topic: 'Describe a useful object that you own.',
  bullets: ['what it is', 'how you got it', 'why it is useful to you'],
  level: 'B1',
};

/** Đáp án — chính là những gì đã cố ý cài vào bản ghi. */
const PLANTED = {
  pronunciation: ['comfortable', 'clothes', 'months'],
  filler: ['um', 'you know', 'uh'],
  grammar: ['yesterday i go', 'i go to the park'],
  hesitation: ['concentrate', 'so overall'],
};

/**
 * Chi tiết KHÔNG thể đoán từ cue card. "headphones"/"battery" là bẫy: model bịa
 * ra chúng dễ dàng từ đề "a useful object" — đã kiểm chứng bằng control tone.
 */
const FINGERPRINT = ['tran phu', 'my cousin minh', 'forty seven'];

const SCHEMA = {
  name: 'speaking_grade',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    required: ['transcript', 'marks', 'scores', 'feedback'],
    properties: {
      transcript: { type: 'string' },
      marks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['quote', 'kind', 'note'],
          properties: {
            quote: { type: 'string' },
            kind: { type: 'string', enum: ['pronunciation', 'hesitation', 'grammar', 'filler'] },
            note: { type: 'string' },
          },
        },
      },
      scores: {
        type: 'object',
        additionalProperties: false,
        required: ['fluencyCoherence', 'lexicalResource', 'grammaticalRange', 'pronunciation'],
        properties: {
          fluencyCoherence: { type: 'number' },
          lexicalResource: { type: 'number' },
          grammaticalRange: { type: 'number' },
          pronunciation: { type: 'number' },
        },
      },
      feedback: {
        type: 'object',
        additionalProperties: false,
        required: [
          'fluencyCoherence', 'lexicalResource', 'grammaticalRange',
          'pronunciation', 'overview', 'nextFocus',
        ],
        properties: {
          fluencyCoherence: { type: 'string' },
          lexicalResource: { type: 'string' },
          grammaticalRange: { type: 'string' },
          pronunciation: { type: 'string' },
          overview: { type: 'string' },
          nextFocus: { type: 'string' },
        },
      },
    },
  },
};

// Giữ khớp với buildSpeakingGradePrompt trong apps/api/src/speaking/speaking-grade-prompt.ts
function buildPrompt({ topic, bullets, level }) {
  return (
    `You are an IELTS Speaking Part 2 examiner. Listen to the candidate's recording and grade it.\n\n` +
    `CEFR level context: ${level}\n` +
    `Cue card topic: ${topic}\n` +
    `Bullets the candidate should cover:\n${bullets.map((b) => `- ${b}`).join('\n')}\n\n` +
    `Return:\n` +
    `1) transcript — a plain verbatim transcript of what you hear (no commentary).\n` +
    `2) marks — short verbatim quotes from that transcript where something went wrong ` +
    `(pronunciation, hesitation, grammar, or filler). Each mark needs quote, kind, and a brief note. ` +
    `Quotes must be exact substrings of the transcript. Do not invent character offsets.\n` +
    `3) scores — four criteria from 0 to 9 in 0.5 steps: fluencyCoherence, lexicalResource, ` +
    `grammaticalRange, pronunciation. Do not compute an overall band — the server will.\n` +
    `4) feedback — short comments for each criterion, plus overview and one concrete nextFocus.`
  );
}

function readEnvKey() {
  try {
    const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
    return env.match(/^OPENROUTER_API_KEY=(.*)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
  } catch {
    return undefined;
  }
}

const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

async function grade(model, base64) {
  const started = Date.now();
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: 4000,
      response_format: { type: 'json_schema', json_schema: SCHEMA },
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: buildPrompt(CUE) },
          { type: 'input_audio', input_audio: { data: base64, format: 'wav' } },
        ],
      }],
    }),
  });

  const ms = Date.now() - started;
  const body = await res.json();
  if (!res.ok) return { model, ms, error: body?.error?.message ?? `HTTP ${res.status}` };

  const choice = body.choices?.[0];
  let parsed;
  try {
    parsed = JSON.parse(choice?.message?.content ?? '');
  } catch {
    return { model, ms, error: 'JSON không parse được', finish: choice?.finish_reason };
  }
  return { model, ms, parsed, finish: choice?.finish_reason, usage: body.usage };
}

function score(parsed) {
  const transcript = norm(parsed.transcript);
  const marks = parsed.marks ?? [];
  const quotesOf = (kind) => marks.filter((m) => m.kind === kind).map((m) => norm(m.quote)).join(' | ');
  const allQuotes = marks.map((m) => norm(m.quote)).join(' | ');

  const heard = FINGERPRINT.filter((w) => transcript.includes(norm(w)));
  const caught = (kind, list, haystack) =>
    list.filter((w) => haystack.includes(norm(w)));

  return {
    // Phép thử chống bịa — quan trọng nhất
    fingerprint: `${heard.length}/${FINGERPRINT.length}`,
    heardWords: heard,
    hallucinating: heard.length === 0,

    pronunciation: caught('pronunciation', PLANTED.pronunciation, quotesOf('pronunciation') || allQuotes),
    filler: caught('filler', PLANTED.filler, quotesOf('filler') || allQuotes),
    grammar: caught('grammar', PLANTED.grammar, quotesOf('grammar') || allQuotes),
    hesitation: caught('hesitation', PLANTED.hesitation, quotesOf('hesitation') || allQuotes),
    markCount: marks.length,
    scores: parsed.scores,
  };
}

/** WAV 3 giây tone 220 Hz — không có tiếng người. Model nào "nghe" ra chữ là đang bịa. */
function controlTone() {
  const rate = 16000, secs = 3, n = rate * secs, bytes = n * 2;
  const buf = Buffer.alloc(44 + bytes);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + bytes, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28);
  buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(bytes, 40);
  for (let i = 0; i < n; i++) {
    buf.writeInt16LE(Math.round(3000 * Math.sin((2 * Math.PI * 220 * i) / rate)), 44 + i * 2);
  }
  return buf.toString('base64');
}

/**
 * Chạy trước mọi thứ: gửi tone không lời. Model trả về transcript có chữ nghĩa
 * = nó sinh văn bản từ cue card chứ không phiên âm. Khi đó điểm Pronunciation
 * và toàn bộ marks đều là sản phẩm tưởng tượng.
 */
async function runControl() {
  console.log('CONTROL — gửi 3 giây tone 220 Hz (không có tiếng người)\n');
  const tone = controlTone();
  const verdicts = [];
  for (const model of MODELS) {
    const r = await grade(model, tone);
    if (r.error) { console.log(`  ${model.padEnd(30)} lỗi: ${r.error}`); verdicts.push({ model, unknown: true }); continue; }
    const words = norm(r.parsed?.transcript).split(' ').filter(Boolean).length;
    const bad = words >= 5;
    verdicts.push({ model, bad });
    console.log(`  ${model.padEnd(30)} ${bad ? '❌ BỊA' : '✅ ok'} — ${words} từ: "${(r.parsed?.transcript ?? '').slice(0, 90)}"`);
  }
  console.log();
  return verdicts;
}

const file = process.argv[2];
if (!file) {
  console.error('Cách dùng: node apps/api/scripts/probe-speaking-quality.mjs <file.wav>');
  process.exit(1);
}

const control = await runControl();
if (control.some((v) => v.bad)) {
  console.log('⚠️  Có model bịa transcript từ tiếng tone. Kết quả bên dưới của model đó KHÔNG đáng tin.\n');
}

const wav = readFileSync(resolve(file.replace(/^~/, process.env.HOME ?? '~')));
const base64 = wav.toString('base64');
console.log(`File: ${file} — ${(wav.length / 1024).toFixed(0)} KB, base64 ${(base64.length / 1024).toFixed(0)} KB\n`);

for (const model of MODELS) {
  const r = await grade(model, base64);
  console.log(`\n${'='.repeat(72)}\n${model}  (${r.ms} ms)`);
  if (r.error) { console.log(`  LỖI: ${r.error}`); continue; }

  const s = score(r.parsed);
  console.log(`  finish_reason : ${r.finish}`);
  console.log(`  audio tokens  : ${r.usage?.prompt_tokens_details?.audio_tokens ?? '?'}`);
  console.log(`\n  NGHE THẬT?    : ${s.hallucinating ? '❌ BỊA — không có từ nào của đoạn' : `✅ ${s.fingerprint} (${s.heardWords.join(', ')})`}`);
  console.log(`  marks trả về  : ${s.markCount}`);
  console.log(`  phát âm       : ${s.pronunciation.length}/3  ${s.pronunciation.join(', ') || '—'}`);
  console.log(`  filler        : ${s.filler.length}/3  ${s.filler.join(', ') || '—'}`);
  console.log(`  ngữ pháp      : ${s.grammar.length ? '✅ bắt được' : '❌ bỏ sót'}`);
  console.log(`  ngập ngừng    : ${s.hesitation.length}/2  ${s.hesitation.join(', ') || '—'}`);
  console.log(`  scores        : ${JSON.stringify(s.scores)}`);
  console.log(`\n  transcript    : ${(r.parsed.transcript ?? '').slice(0, 220)}…`);
}

console.log(`\n${'='.repeat(72)}`);
console.log('Đọc kết quả:');
console.log('  • CONTROL ❌ BỊA      → model sinh chữ từ tiếng tone. Mọi điểm bên dưới vô nghĩa.');
console.log('  • "NGHE THẬT? ❌ BỊA"  → model viết theo đề, không nghe. Lỗi nặng.');
console.log('  • phát âm 0/3 ở mọi model → tiêu chí Pronunciation không có thực chất;');
console.log('    phải nói rõ điều đó trong UI thay vì hiện một con điểm rỗng.');
console.log('  • phát âm ≥2/3 → tiêu chí đáng tin, giữ nguyên.');
