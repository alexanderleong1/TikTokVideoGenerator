/**
 * voiceGenerator.ts
 *
 * Free Microsoft Edge TTS via a Python helper script that uses the edge-tts
 * package's streaming API with WordBoundary events for per-word timing.
 *
 * Requires: pip3 install edge-tts
 *
 * Popular voices (set EDGE_TTS_VOICE in .env):
 *   en-US-AriaNeural   — warm, conversational female (default)
 *   en-US-GuyNeural    — energetic male
 *   en-US-JennyNeural  — friendly female
 *   en-GB-SoniaNeural  — British female
 */

import path from 'path';
import { spawnSync } from 'child_process';
import { tmpFilePath } from '../utils/helpers';
import { logger } from '../utils/logger';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface VoiceGenerationResult {
  audioPath: string;
  durationSeconds: number;
  wordTimings: WordTiming[];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function generateVoice(script: string): Promise<VoiceGenerationResult> {
  const voice = process.env.EDGE_TTS_VOICE ?? 'en-US-AriaNeural';
  const audioPath = tmpFilePath('mp3');
  const ttsScript = path.resolve(process.cwd(), 'scripts/tts.py');

  logger.info('Generating voice via edge-tts (Python)', { voice });

  const result = spawnSync(
    'python3',
    [ttsScript, voice, audioPath, script],
    { timeout: 60_000, encoding: 'utf-8' },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`edge-tts failed (exit ${result.status}): ${result.stderr}`);
  }

  // stdout contains JSON array of word timings
  let wordTimings: WordTiming[] = [];
  try {
    wordTimings = JSON.parse(result.stdout.trim());
  } catch {
    logger.warn('Could not parse word timings from tts.py output');
  }

  const durationSeconds = wordTimings.length > 0
    ? Math.ceil(wordTimings[wordTimings.length - 1].endMs / 1000) + 1
    : Math.round((script.trim().split(/\s+/).length / 130) * 60);

  logger.info('Voice narration saved', { audioPath, words: wordTimings.length, durationSeconds });

  return { audioPath, durationSeconds, wordTimings };
}
