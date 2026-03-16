/**
 * videoRenderer.ts
 *
 * Renders the final TikTok video using Remotion's server-side renderer.
 *
 * Flow:
 *  1. Bundle the Remotion composition (webpack build)
 *  2. Select the "TikTokVideo" composition
 *  3. Render to MP4 (H.264, 1080×1920, 30 fps)
 *  4. Return the path to the rendered file
 *
 * This runs in a Node.js context (API route or scheduler), NOT the browser.
 *
 * Docs: https://www.remotion.dev/docs/renderer
 */

import { mkdirSync, copyFileSync, unlinkSync } from 'fs';
import path from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { logger } from '../utils/logger';
import { secondsToFrames } from '../utils/helpers';
import type { WordTiming } from './voiceGenerator';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RenderInput {
  topic: string;
  hook: string;
  script: string;
  wordTimings: WordTiming[];
  audioPath: string;           // path to the MP3 narration
  backgroundVideoUrl: string;  // direct URL of the stock footage
  durationSeconds: number;     // total video duration
}

export interface RenderResult {
  videoPath: string; // absolute path to the rendered MP4
}

// ─── Renderer ─────────────────────────────────────────────────────────────────

/**
 * renderVideo
 *
 * Bundles and renders the Remotion composition server-side.
 * Returns the path to the output MP4.
 */
export async function renderVideo(input: RenderInput): Promise<RenderResult> {
  logger.info('Starting video render', {
    topic: input.topic,
    durationSeconds: input.durationSeconds,
  });

  // Save to ./output/ so it's easy to find and open locally
  const outputDir = path.resolve(process.cwd(), 'output');
  mkdirSync(outputDir, { recursive: true });
  const slug = input.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
  const outputPath = path.join(outputDir, `${slug}-${Date.now()}.mp4`);
  const fps = 30;
  const durationInFrames = secondsToFrames(input.durationSeconds, fps);

  const audioFilename = `audio-${Date.now()}.mp3`;

  // 1. Bundle the Remotion entry file
  const compositionRoot = path.resolve(process.cwd(), 'remotion/index.ts');

  logger.info('Bundling Remotion composition...');
  const bundled = await bundle({
    entryPoint: compositionRoot,
    webpackOverride: (config) => config,
  });

  // Remotion's HTTP server serves files from the bundle temp dir.
  // Copy audio there so Chrome can fetch it at /audio-<ts>.mp3.
  const bundleAudioPath = path.join(bundled, audioFilename);
  copyFileSync(input.audioPath, bundleAudioPath);

  try {
    const props = buildInputProps(input, audioFilename, durationInFrames, fps);

    // 2. Select the composition we want to render
    const composition = await selectComposition({
      serveUrl: bundled,
      id: 'TikTokVideo',
      inputProps: props,
    });

    // 3. Render to MP4
    logger.info('Rendering video frames...', { frames: durationInFrames });
    await renderMedia({
      composition,
      serveUrl: bundled,
      codec: 'h264',
      outputLocation: outputPath,
      inputProps: props,
      chromiumOptions: { disableWebSecurity: true },
      onProgress: ({ progress }) => {
        logger.debug('Render progress', { progress: `${Math.round(progress * 100)}%` });
      },
    });
  } finally {
    // Clean up the copied audio from the bundle dir
    try { unlinkSync(bundleAudioPath); } catch { /* ignore */ }
  }

  logger.info('Video render complete', { outputPath });
  return { videoPath: outputPath };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Builds the props object passed into the Remotion composition.
 * These map to the `TikTokVideoProps` interface in TikTokVideo.tsx.
 */
function buildInputProps(
  input: RenderInput,
  audioFilename: string,
  durationInFrames: number,
  fps: number,
): Record<string, unknown> {
  return {
    topic: input.topic,
    hook: input.hook,
    wordTimings: input.wordTimings,
    audioPath: audioFilename,
    backgroundVideoUrl: input.backgroundVideoUrl,
    durationInFrames,
    fps,
  };
}
