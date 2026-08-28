#!/usr/bin/env node
/**
 * One-off spike: prove OpenRouter accepts WAV (or MP3) audio via input_audio
 * and returns a plain transcript. Not part of the product runtime.
 *
 * Usage:
 *   node apps/api/scripts/spike-speaking-audio.mjs [path/to/audio.wav|mp3]
 *
 * Env: OPENROUTER_API_KEY from apps/api/.env (or process env).
 */
import { readFileSync, existsSync } from 'node:fs';
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

const audioPath = resolve(
  process.argv[2] ?? '/tmp/speaking-spike/spike-16k-mono.wav',
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

const body = {
  model: 'google/gemini-2.5-flash',
  max_tokens: 2000,
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'Transcribe this audio. Reply with only the plain transcript of what was said — no commentary, labels, or punctuation fixes beyond what you hear.',
        },
        {
          type: 'input_audio',
          input_audio: {
            data: base64,
            format,
          },
        },
      ],
    },
  ],
};

console.log(`File: ${audioPath}`);
console.log(`Format: ${format}`);
console.log(`Bytes: ${bytes.length} (base64 length ${base64.length})`);
console.log(`Model: ${body.model}`);

const started = Date.now();
let res;
try {
  res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://writing-helper.local',
      'X-Title': 'speaking-audio-spike',
    },
    body: JSON.stringify(body),
  });
} catch (err) {
  console.error(`Request failed after ${Date.now() - started}ms:`, err);
  process.exit(1);
}

const latencyMs = Date.now() - started;
const raw = await res.text();
let json;
try {
  json = JSON.parse(raw);
} catch {
  json = null;
}

console.log(`HTTP status: ${res.status}`);
console.log(`Latency ms: ${latencyMs}`);

if (!res.ok) {
  console.log('Error body:');
  console.log(raw.slice(0, 4000));
  process.exit(1);
}

const usage = json?.usage;
if (usage) {
  console.log(
    `Usage: prompt=${usage.prompt_tokens ?? '?'} completion=${usage.completion_tokens ?? '?'} total=${usage.total_tokens ?? '?'}`,
  );
  if (usage.prompt_tokens_details) {
    console.log('prompt_tokens_details:', JSON.stringify(usage.prompt_tokens_details));
  }
  if (usage.completion_tokens_details) {
    console.log(
      'completion_tokens_details:',
      JSON.stringify(usage.completion_tokens_details),
    );
  }
} else {
  console.log('Usage: (none)');
}

const transcript =
  json?.choices?.[0]?.message?.content ??
  json?.choices?.[0]?.text ??
  null;

if (transcript == null) {
  console.log('No transcript in response:');
  console.log(raw.slice(0, 4000));
  process.exit(1);
}

console.log('--- transcript ---');
console.log(typeof transcript === 'string' ? transcript : JSON.stringify(transcript));
console.log('--- end ---');
