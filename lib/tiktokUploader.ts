/**
 * tiktokUploader.ts
 *
 * Uploads a rendered MP4 to TikTok using the Content Posting API v2.
 *
 * Flow (per TikTok docs):
 *  Step 1 — POST /v2/post/publish/video/init/   → get upload_url + publish_id
 *  Step 2 — PUT {upload_url}                    → stream the video binary
 *  Step 3 — GET /v2/post/publish/status/fetch/  → poll until status = PUBLISH_COMPLETE
 *
 * Docs: https://developers.tiktok.com/doc/content-posting-api-get-started
 */

import fs from 'fs';
import axios from 'axios';
import { logger } from '@/utils/logger';
import { retry, sleep } from '@/utils/helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UploadOptions {
  videoPath: string;
  title: string;
  description?: string;
  privacyLevel?: 'PUBLIC_TO_EVERYONE' | 'MUTUAL_FOLLOW_FRIENDS' | 'FOLLOWER_OF_CREATOR' | 'SELF_ONLY';
  disableComment?: boolean;
  disableDuet?: boolean;
  disableStitch?: boolean;
}

export interface UploadResult {
  publishId: string;
  status: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIKTOK_BASE = 'https://open.tiktokapis.com';
const CHUNK_SIZE = 10 * 1024 * 1024; // 10 MB chunks

// ─── Step 1: Initialise upload ────────────────────────────────────────────────

interface InitResponse {
  data: {
    publish_id: string;
    upload_url: string;
  };
  error: {
    code: string;
    message: string;
  };
}

async function initUpload(options: UploadOptions): Promise<{ publishId: string; uploadUrl: string }> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  if (!accessToken) throw new Error('TIKTOK_ACCESS_TOKEN is not set.');

  const videoSize = fs.statSync(options.videoPath).size;

  const body = {
    post_info: {
      title: options.title.slice(0, 150), // TikTok max title length
      description: (options.description ?? '').slice(0, 2200),
      privacy_level: options.privacyLevel ?? 'PUBLIC_TO_EVERYONE',
      disable_comment: options.disableComment ?? false,
      disable_duet: options.disableDuet ?? false,
      disable_stitch: options.disableStitch ?? false,
    },
    source_info: {
      source: 'FILE_UPLOAD',
      video_size: videoSize,
      chunk_size: CHUNK_SIZE,
      total_chunk_count: Math.ceil(videoSize / CHUNK_SIZE),
    },
  };

  const response = await axios.post<InitResponse>(
    `${TIKTOK_BASE}/v2/post/publish/video/init/`,
    body,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json; charset=UTF-8',
      },
    },
  );

  const { data, error } = response.data;

  if (error?.code && error.code !== 'ok') {
    throw new Error(`TikTok init failed: ${error.code} – ${error.message}`);
  }

  return { publishId: data.publish_id, uploadUrl: data.upload_url };
}

// ─── Step 2: Upload video in chunks ───────────────────────────────────────────

async function uploadChunks(videoPath: string, uploadUrl: string): Promise<void> {
  const videoBuffer = fs.readFileSync(videoPath);
  const totalSize = videoBuffer.length;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);

  logger.info('Uploading video to TikTok', { totalSize, totalChunks });

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const chunk = videoBuffer.slice(start, end);

    await retry(
      async () => {
        await axios.put(uploadUrl, chunk, {
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Range': `bytes ${start}-${end - 1}/${totalSize}`,
            'Content-Length': chunk.length,
          },
          timeout: 120_000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        });
      },
      3,
      2000,
    );

    logger.debug('Chunk uploaded', { chunk: `${i + 1}/${totalChunks}` });
  }
}

// ─── Step 3: Poll for publish status ─────────────────────────────────────────

interface StatusResponse {
  data: {
    status: string; // PROCESSING_UPLOAD | SEND_TO_USER_INBOX | PUBLISH_COMPLETE | FAILED
    fail_reason?: string;
    publicaly_available_post_id?: string[];
  };
  error: { code: string; message: string };
}

async function pollPublishStatus(publishId: string, maxAttempts = 20): Promise<string> {
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN!;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    await sleep(6_000); // poll every 6 seconds

    const response = await axios.post<StatusResponse>(
      `${TIKTOK_BASE}/v2/post/publish/status/fetch/`,
      { publish_id: publishId },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json; charset=UTF-8',
        },
      },
    );

    const { data, error } = response.data;

    if (error?.code && error.code !== 'ok') {
      throw new Error(`TikTok status check failed: ${error.code} – ${error.message}`);
    }

    logger.info('TikTok publish status', { publishId, status: data.status, attempt });

    if (data.status === 'PUBLISH_COMPLETE') return data.status;
    if (data.status === 'FAILED') {
      throw new Error(`TikTok publish failed: ${data.fail_reason ?? 'unknown reason'}`);
    }
  }

  throw new Error(`TikTok publish timed out after ${maxAttempts} status checks.`);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * uploadToTikTok
 *
 * Full upload pipeline: init → chunk upload → status poll.
 * Returns the publish_id and final status.
 */
export async function uploadToTikTok(options: UploadOptions): Promise<UploadResult> {
  logger.info('Starting TikTok upload', { title: options.title, videoPath: options.videoPath });

  // Step 1
  const { publishId, uploadUrl } = await initUpload(options);
  logger.info('TikTok upload initialised', { publishId });

  // Step 2
  await uploadChunks(options.videoPath, uploadUrl);
  logger.info('Video chunks uploaded', { publishId });

  // Step 3
  const status = await pollPublishStatus(publishId);
  logger.info('TikTok video published', { publishId, status });

  return { publishId, status };
}
