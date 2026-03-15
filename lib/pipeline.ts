/**
 * pipeline.ts
 *
 * The core generateTikTokVideo() function — the single entry point for the
 * entire video generation pipeline.
 *
 * Steps:
 *  1. Generate topic + script (AI)
 *  2. Generate voice narration (ElevenLabs)
 *  3. Fetch background stock video (Pexels / Pixabay)
 *  4. Render final video (Remotion)
 *  5. Upload to TikTok
 *  6. Persist metadata to Supabase
 *
 * This function is called by:
 *  - jobs/scheduler.ts   (automated 2×/day)
 *  - app/api/generate/route.ts  (manual admin trigger)
 */

import { generateScript } from '@/lib/scriptGenerator';
import { generateVoice } from '@/lib/voiceGenerator';
import { fetchStockVideo } from '@/lib/stockFootage';
import { renderVideo } from '@/lib/videoRenderer';
import { uploadToTikTok } from '@/lib/tiktokUploader';
import {
  createVideoRecord,
  updateVideoRecord,
} from '@/lib/supabase';
import { logger } from '@/utils/logger';
import { safeUnlink } from '@/utils/helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PipelineOptions {
  /** Override the auto-picked topic. */
  customTopic?: string;
  /** Skip the TikTok upload step (useful for local testing). */
  skipUpload?: boolean;
}

export interface PipelineResult {
  videoId: string;
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
    // ── Step 1: Generate script ─────────────────────────────────────────────
    logger.info('Pipeline step 1/5: generating script');
    const script = await generateScript(options.customTopic);

    // Create DB record early so we can track status from here on
    const record = await createVideoRecord({
      topic: script.topic,
      hook: script.hook,
      script: script.script,
      captions: script.captions,
    });
    videoId = record.id;

    await updateVideoRecord(videoId, { status: 'generating' });

    // ── Step 2: Generate voice ──────────────────────────────────────────────
    logger.info('Pipeline step 2/5: generating voice', { videoId });
    const voice = await generateVoice(script.script);
    audioPath = voice.audioPath;

    // ── Step 3: Fetch stock footage ─────────────────────────────────────────
    logger.info('Pipeline step 3/5: fetching stock footage', { videoId });
    const stockVideo = await fetchStockVideo(script.topic);

    // ── Step 4: Render video ────────────────────────────────────────────────
    logger.info('Pipeline step 4/5: rendering video', { videoId });
    await updateVideoRecord(videoId, { status: 'rendering' });

    const durationSeconds = voice.durationSeconds ?? 30;
    const rendered = await renderVideo({
      topic: script.topic,
      hook: script.hook,
      script: script.script,
      captions: script.captions,
      audioPath: voice.audioPath,
      backgroundVideoUrl: stockVideo.url,
      durationSeconds,
    });
    renderedVideoPath = rendered.videoPath;

    await updateVideoRecord(videoId, {
      video_url: renderedVideoPath,
      status: 'uploading',
    });

    // ── Step 5: Upload to TikTok ────────────────────────────────────────────
    let publishId: string | null = null;

    if (!options.skipUpload) {
      logger.info('Pipeline step 5/5: uploading to TikTok', { videoId });

      const upload = await uploadToTikTok({
        videoPath: renderedVideoPath,
        title: `${script.hook} #shorts #viral`,
        description: `${script.topic}\n\n${script.captions.join(' · ')}`,
        privacyLevel: 'PUBLIC_TO_EVERYONE',
        disableComment: false,
        disableDuet: false,
      });

      publishId = upload.publishId;

      await updateVideoRecord(videoId, {
        tiktok_publish_id: publishId,
        status: 'posted',
      });

      logger.info('Pipeline complete', { videoId, publishId });
    } else {
      await updateVideoRecord(videoId, { status: 'posted' });
      logger.info('Pipeline complete (upload skipped)', { videoId });
    }

    return {
      videoId,
      topic: script.topic,
      videoPath: renderedVideoPath,
      publishId,
      status: 'posted',
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Pipeline failed', { videoId, error: message });

    if (videoId) {
      await updateVideoRecord(videoId, {
        status: 'failed',
        error_message: message,
      }).catch(() => {}); // don't throw from error handler
    }

    throw err;
  } finally {
    // Clean up temp files regardless of success/failure
    if (audioPath) safeUnlink(audioPath);
    // Note: we keep the rendered video on disk so it can be served/downloaded.
    // In production you would upload it to object storage (S3/GCS) and delete.
  }
}
