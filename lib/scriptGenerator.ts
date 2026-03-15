/**
 * scriptGenerator.ts
 *
 * Generates a TikTok video script using Claude (claude-opus-4-6).
 * Prompted to return a strict JSON object with topic, hook, script, and captions.
 * The script is sized to produce 20–40 seconds of spoken narration.
 */

import Anthropic from '@anthropic-ai/sdk';
import { logger } from '@/utils/logger';
import { retry } from '@/utils/helpers';

// ─── Output type ──────────────────────────────────────────────────────────────

export interface GeneratedScript {
  topic: string;
  hook: string;       // attention-grabbing first line (≤15 words)
  script: string;     // full narration text (60–90 words → 20–40 s at 130 wpm)
  captions: string[]; // short segments for subtitle overlays
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

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(topic: string): string {
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
    throw new Error(`Claude returned invalid JSON:\n${raw.slice(0, 300)}`);
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

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateScript(customTopic?: string): Promise<GeneratedScript> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set.');

  const topic = pickTopic(customTopic);
  logger.info('Generating script with Claude', { topic });

  const client = new Anthropic({ apiKey });

  const script = await retry(async () => {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: buildPrompt(topic) }],
    });

    const text = message.content
      .filter((c) => c.type === 'text')
      .map((c) => (c as { type: 'text'; text: string }).text)
      .join('');

    return parseJson(text);
  }, 3, 2000);

  logger.info('Script generated', {
    topic: script.topic,
    wordCount: script.script.split(' ').length,
  });
  return script;
}
