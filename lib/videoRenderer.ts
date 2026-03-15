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

import path from 'path';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { logger } from '@/utils/logger';
import { tmpFilePath, secondsToFrames } from '@/utils/helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RenderInput {
  topic: string;
  hook: string;
  script: string;
  captions: string[];
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

  const outputPath = tmpFilePath('mp4');
  const fps = 30;
  const durationInFrames = secondsToFrames(input.durationSeconds, fps);

  // 1. Bundle the Remotion entry file
  //    The entry file exports all compositions via <Composition> components.
  const compositionRoot = path.resolve(process.cwd(), 'remotion/index.ts');

  logger.info('Bundling Remotion composition...');
  const bundled = await bundle({
    entryPoint: compositionRoot,
    // Pass env variables so the Remotion composition can access them if needed
    webpackOverride: (config) => config,
  });

  // 2. Select the composition we want to render
  const composition = await selectComposition({
    serveUrl: bundled,
    id: 'TikTokVideo',
    inputProps: buildInputProps(input, durationInFrames, fps),
  });

  // 3. Render to MP4
  logger.info('Rendering video frames...', { frames: durationInFrames });
  await renderMedia({
    composition,
    serveUrl: bundled,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: buildInputProps(input, durationInFrames, fps),
    // 1080×1920 portrait
    chromiumOptions: { disableWebSecurity: true },
    onProgress: ({ progress }) => {
      logger.debug('Render progress', { progress: `${Math.round(progress * 100)}%` });
    },
  });

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
  durationInFrames: number,
  fps: number,
): Record<string, unknown> {
  return {
    topic: input.topic,
    hook: input.hook,
    captions: input.captions,
    audioPath: input.audioPath,
    backgroundVideoUrl: input.backgroundVideoUrl,
    durationInFrames,
    fps,
  };
}
