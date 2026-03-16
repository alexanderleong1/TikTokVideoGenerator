/**
 * scriptGenerator.ts
 *
 * Generates a TikTok video script. Supports two modes:
 *
 *  MANUAL MODE (default for now):
 *    Point SCRIPT_FILE to a JSON file containing your script.
 *    Copy the prompt from getPrompt(), paste it into Claude chat,
 *    save the JSON response to script.json, then run the pipeline.
 *
 *  API MODE:
 *    Set ANTHROPIC_API_KEY to use the Anthropic API automatically.
 *    API mode is used only if SCRIPT_FILE is not set.
 */

import fs from 'fs';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedScript {
  topic: string;
  hook: string;       // attention-grabbing first line (≤15 words)
  script: string;     // full narration text (60–90 words → 20–40 s at 130 wpm)
  captions: string[]; // short subtitle segments
}

// ─── Prompt (copy this into Claude chat) ─────────────────────────────────────

export function getPrompt(topic: string): string {
  return `You are a viral TikTok content creator. Create an engaging short-form video script on:

"${topic}"

Requirements:
- hook: ≤15 words, punchy, grabs attention in the first 3 seconds
- script: 60–90 words total (20–40 seconds of narration at 130 wpm)
- captions: 5 short segments of 5–10 words each, matching script flow
- End with a clear CTA (like, follow, comment)
- Tone: energetic, conversational, direct

Return ONLY valid JSON, no markdown fences, no extra text:
{
  "topic": "${topic}",
  "hook": "<hook text>",
  "script": "<full narration>",
  "captions": ["seg1", "seg2", "seg3", "seg4", "seg5"]
}`;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function parseJson(raw: string): GeneratedScript {
  const cleaned = raw.replace(/```json|```/g, '').trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`Invalid JSON:\n${raw.slice(0, 300)}`);
  }
  const obj = parsed as Record<string, unknown>;
  if (
    typeof obj.topic !== 'string' ||
    typeof obj.hook !== 'string' ||
    typeof obj.script !== 'string' ||
    !Array.isArray(obj.captions)
  ) {
    throw new Error(`Missing required fields in: ${JSON.stringify(obj)}`);
  }
  return {
    topic: obj.topic,
    hook: obj.hook,
    script: obj.script,
    captions: obj.captions as string[],
  };
}

// ─── Manual mode ──────────────────────────────────────────────────────────────

function loadFromFile(filePath: string): GeneratedScript {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `SCRIPT_FILE not found: ${filePath}\n` +
      `Create it by pasting Claude's JSON response into that file.`
    );
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  const script = parseJson(raw);
  logger.info('Script loaded from file', { filePath, topic: script.topic });
  return script;
}

// ─── API mode (optional) ──────────────────────────────────────────────────────

async function generateViaApi(topic: string): Promise<GeneratedScript> {
  // Dynamic import so the SDK is only loaded when actually needed
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const { retry } = await import('../utils/helpers');

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  return retry(async () => {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: getPrompt(topic) }],
    });
    const text = message.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');
    return parseJson(text);
  }, 3, 2000);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * generateScript
 *
 * Priority:
 *  1. SCRIPT_FILE env var → load JSON from that file (manual mode)
 *  2. ANTHROPIC_API_KEY   → call the API automatically
 *  3. Neither set         → print the prompt and exit with instructions
 */
export async function generateScript(customTopic?: string): Promise<GeneratedScript> {
  // ── Manual mode ──────────────────────────────────────────────────────────
  const scriptFile = process.env.SCRIPT_FILE;
  if (scriptFile) {
    return loadFromFile(scriptFile);
  }

  // ── API mode ─────────────────────────────────────────────────────────────
  if (process.env.ANTHROPIC_API_KEY) {
    const topic = customTopic ?? pickTopic();
    logger.info('Generating script via Anthropic API', { topic });
    const script = await generateViaApi(topic);
    logger.info('Script generated', { topic: script.topic });
    return script;
  }

  // ── Neither configured ────────────────────────────────────────────────────
  const topic = customTopic ?? pickTopic();
  const prompt = getPrompt(topic);

  console.log('\n' + '─'.repeat(60));
  console.log('No ANTHROPIC_API_KEY or SCRIPT_FILE set.');
  console.log('Copy the prompt below into Claude, save the JSON');
  console.log('response to script.json, then re-run with:');
  console.log('  SCRIPT_FILE=script.json npm run generate');
  console.log('─'.repeat(60));
  console.log('\nPROMPT:\n');
  console.log(prompt);
  console.log('\n' + '─'.repeat(60) + '\n');

  throw new Error('Script generation requires SCRIPT_FILE or ANTHROPIC_API_KEY.');
}

// ─── Topic pool ───────────────────────────────────────────────────────────────

const TOPIC_POOL = [
  'The shocking truth about sleep you were never taught',
  '3 ancient productivity secrets used by Roman emperors',
  'Why your phone is secretly draining your energy',
  'The 5-minute morning routine that changes everything',
  'What billionaires do differently before 8am',
  'The psychology trick that instantly boosts confidence',
  'Why most people never achieve their goals (and how to fix it)',
  'Hidden signs you\'re smarter than you think',
  'The science behind why cold showers work',
  'How to rewire your brain for success in 21 days',
];

export function pickTopic(custom?: string): string {
  if (custom) return custom;
  return TOPIC_POOL[Math.floor(Math.random() * TOPIC_POOL.length)];
}
