/**
 * voiceGenerator.ts
 *
 * Converts text to an MP3 voice narration using the ElevenLabs API.
 *
 * The generated audio file is saved to the tmp directory and its path is
 * returned. The caller is responsible for cleaning it up after rendering.
 *
 * Docs: https://elevenlabs.io/docs/api-reference/text-to-speech
 */

import fs from 'fs';
import axios from 'axios';
import { logger } from '@/utils/logger';
import { tmpFilePath, retry } from '@/utils/helpers';

// ─── Constants ────────────────────────────────────────────────────────────────

const ELEVENLABS_BASE = 'https://api.elevenlabs.io/v1';

// Default voice: "Rachel" – natural, clear American English
const DEFAULT_VOICE_ID = '21m00Tcm4TlvDq8ikWAM';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface VoiceGenerationResult {
  audioPath: string;    // absolute path to the saved MP3
  durationSeconds: number | null; // estimated from word count; exact after FFprobe
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Rough estimate: average English speaking pace ≈ 130 words per minute */
function estimateDuration(text: string): number {
  const wordCount = text.trim().split(/\s+/).length;
  return Math.round((wordCount / 130) * 60);
}

// ─── Main function ────────────────────────────────────────────────────────────

/**
 * generateVoice
 *
 * Calls ElevenLabs TTS and saves the MP3 to disk.
 * Returns the file path and an estimated duration in seconds.
 */
export async function generateVoice(script: string): Promise<VoiceGenerationResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) throw new Error('ELEVENLABS_API_KEY is not set.');

  const voiceId = process.env.ELEVENLABS_VOICE_ID ?? DEFAULT_VOICE_ID;
  const outputPath = tmpFilePath('mp3');

  logger.info('Generating voice narration', { voiceId, charCount: script.length });

  const doRequest = async () => {
    const response = await axios.post(
      `${ELEVENLABS_BASE}/text-to-speech/${voiceId}`,
      {
        text: script,
        model_id: 'eleven_turbo_v2',          // fast + high quality
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.3,
          use_speaker_boost: true,
        },
      },
      {
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/mpeg',
        },
        responseType: 'arraybuffer',
        timeout: 60_000,
      },
    );

    return response.data as ArrayBuffer;
  };

  const audioData = await retry(doRequest, 3, 2000);

  // Write the binary audio data to a temp file
  fs.writeFileSync(outputPath, Buffer.from(audioData));

  const durationSeconds = estimateDuration(script);

  logger.info('Voice narration saved', { outputPath, estimatedDuration: durationSeconds });

  return { audioPath: outputPath, durationSeconds };
}
