/**
 * pipeline.ts
 *
 * Core pipeline: script → voice → footage → render → upload.
 * Supabase status tracking is used only if SUPABASE_URL is set.
 */

import { generateScript } from './scriptGenerator';
import { generateVoice } from './voiceGenerator';
import { fetchStockVideo } from './stockFootage';
import { renderVideo } from './videoRenderer';
import { uploadToTikTok } from './tiktokUploader';
import { logger } from '../utils/logger';
import { safeUnlink } from '../utils/helpers';

// ─── Optional DB helpers ──────────────────────────────────────────────────────

function dbEnabled(): boolean {
  return !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

async function dbCreate(data: { topic: string; hook: string; script: string; captions: string[] }): Promise<string | null> {
  if (!dbEnabled()) return null;
  const { createVideoRecord } = await import('./supabase');
  const record = await createVideoRecord(data);
  return record.id;
}

async function dbUpdate(id: string | null, updates: Record<string, unknown>): Promise<void> {
  if (!id || !dbEnabled()) return;
  const { updateVideoRecord } = await import('./supabase');
  await updateVideoRecord(id, updates as never);
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineOptions {
  customTopic?: string;
  skipUpload?: boolean;
}

export interface PipelineResult {
  videoId: string | null;
  topic: string;
  videoPath: string;
  publishId: string | null;
  status: string;
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

export async function generateTikTokVideo(
  options: PipelineOptions = {},
): Promise<PipelineResult> {
  let videoId: string | null = null;
  let audioPath: string | null = null;
  let renderedVideoPath: string | null = null;

  try {
    // Step 1: Script
    logger.info('Pipeline step 1/4: generating script');
    const script = await generateScript(options.customTopic);
    videoId = await dbCreate(script);

    // Step 2: Voice
    logger.info('Pipeline step 2/4: generating voice');
    // await dbUpdate(videoId, { status: 'generating' });
    const voice = await generateVoice(script.script);
    audioPath = voice.audioPath;

    // Step 3: Stock footage + render
    logger.info('Pipeline step 3/4: fetching footage & rendering');
    await dbUpdate(videoId, { status: 'rendering' });
    const stockVideo = await fetchStockVideo(script.topic);
    const rendered = await renderVideo({
      topic: script.topic,
      hook: script.hook,
      script: script.script,
      wordTimings: voice.wordTimings,
      audioPath: voice.audioPath,
      backgroundVideoUrl: stockVideo.url,
      durationSeconds: voice.durationSeconds ?? 30,
    });
    renderedVideoPath = rendered.videoPath;

    // Step 4: Upload
    let publishId: string | null = null;
    if (!options.skipUpload) {
      logger.info('Pipeline step 4/4: uploading to TikTok');
      await dbUpdate(videoId, { status: 'uploading', video_url: renderedVideoPath });
      const upload = await uploadToTikTok({
        videoPath: renderedVideoPath,
        title: `${script.hook} #shorts #viral`,
        description: `${script.topic}\n\n${script.captions.join(' · ')}`,
        privacyLevel: 'PUBLIC_TO_EVERYONE',
        disableComment: false,
        disableDuet: false,
      });
      publishId = upload.publishId;
      await dbUpdate(videoId, { status: 'posted', tiktok_publish_id: publishId });
      logger.info('Pipeline complete', { publishId });
    } else {
      await dbUpdate(videoId, { status: 'posted' });
      logger.info('Pipeline complete (upload skipped)');
    }

    return { videoId, topic: script.topic, videoPath: renderedVideoPath, publishId, status: 'posted' };

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Pipeline failed', { error: message });
    await dbUpdate(videoId, { status: 'failed', error_message: message }).catch(() => {});
    throw err;
  } finally {
    if (audioPath) safeUnlink(audioPath);
  }
}
