/**
 * stockFootage.ts
 *
 * Fetches a relevant vertical stock video URL from Pexels or Pixabay.
 *
 * Priority:
 *  1. Pexels (higher quality, better search)
 *  2. Pixabay (fallback)
 *
 * Returns a direct video URL that Remotion can use as a background source.
 */

import axios from 'axios';
import { logger } from '../utils/logger';
import { retry } from '../utils/helpers';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StockVideo {
  url: string;           // direct MP4 download URL
  width: number;
  height: number;
  provider: 'pexels' | 'pixabay';
  thumbnailUrl: string;
}

// ─── Pexels ───────────────────────────────────────────────────────────────────

interface PexelsVideoFile {
  link: string;
  width: number;
  height: number;
  quality: string;
  file_type: string;
}

interface PexelsVideo {
  video_files: PexelsVideoFile[];
  image: string; // thumbnail
}

interface PexelsSearchResponse {
  videos: PexelsVideo[];
}

async function fetchFromPexels(query: string): Promise<StockVideo | null> {
  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) return null;

  const response = await axios.get<PexelsSearchResponse>(
    'https://api.pexels.com/videos/search',
    {
      headers: { Authorization: apiKey },
      params: {
        query,
        per_page: 20,
        orientation: 'portrait',
        size: 'medium',
      },
      timeout: 15_000,
    },
  );

  const videos = response.data.videos ?? [];
  if (videos.length === 0) return null;

  // Pick a random video from the results for variety
  const video = videos[Math.floor(Math.random() * videos.length)];

  // Prefer HD portrait files
  const file =
    video.video_files.find(
      (f) => f.quality === 'hd' && f.height > f.width,
    ) ??
    video.video_files.find((f) => f.height > f.width) ??
    video.video_files[0];

  if (!file) return null;

  return {
    url: file.link,
    width: file.width,
    height: file.height,
    provider: 'pexels',
    thumbnailUrl: video.image,
  };
}

// ─── Pixabay ──────────────────────────────────────────────────────────────────

interface PixabayHit {
  videos: {
    medium: { url: string; width: number; height: number };
    large: { url: string; width: number; height: number };
  };
  previewURL: string;
}

interface PixabaySearchResponse {
  hits: PixabayHit[];
}

async function fetchFromPixabay(query: string): Promise<StockVideo | null> {
  const apiKey = process.env.PIXABAY_API_KEY;
  if (!apiKey) return null;

  const response = await axios.get<PixabaySearchResponse>(
    'https://pixabay.com/api/videos/',
    {
      params: {
        key: apiKey,
        q: query,
        per_page: 10,
        video_type: 'film',
      },
      timeout: 15_000,
    },
  );

  const hits = response.data.hits ?? [];
  if (hits.length === 0) return null;

  const hit = hits[Math.floor(Math.random() * hits.length)];
  const file = hit.videos.large ?? hit.videos.medium;

  return {
    url: file.url,
    width: file.width,
    height: file.height,
    provider: 'pixabay',
    thumbnailUrl: hit.previewURL,
  };
}

// ─── Keyword extractor ────────────────────────────────────────────────────────

/**
 * Derives a stock-footage search query from the script topic.
 * Strips filler words and keeps the most visual nouns/adjectives.
 */
function topicToSearchQuery(topic: string): string {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'you', 'your', 'that',
    'this', 'these', 'those', 'why', 'how', 'what', 'when', 'where', 'who',
    'never', 'always', 'ever', 'about', 'more', 'most', 'some', 'any',
  ]);

  const words = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  // Take up to 3 keywords, then exclude faces/people
  const keywords = words.slice(0, 3).join(' ') || 'nature landscape';
  return `${keywords} no people`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * fetchStockVideo
 *
 * Returns a vertical stock video URL relevant to the given topic.
 * Tries Pexels first, then Pixabay as fallback.
 */
export async function fetchStockVideo(topic: string): Promise<StockVideo> {
  const query = topicToSearchQuery(topic);
  logger.info('Fetching stock footage', { topic, query });

  const fetch = async (): Promise<StockVideo> => {
    const pexels = await fetchFromPexels(query).catch(() => null);
    if (pexels) return pexels;

    const pixabay = await fetchFromPixabay(query).catch(() => null);
    if (pixabay) return pixabay;

    // Hard fallback: a reliable public domain video
    logger.warn('No stock footage found, using fallback', { query });
    return {
      url: 'https://videos.pexels.com/video-files/856543/856543-hd_1080_1920_24fps.mp4',
      width: 1080,
      height: 1920,
      provider: 'pexels',
      thumbnailUrl: '',
    };
  };

  const result = await retry(fetch, 2, 1000);
  logger.info('Stock footage fetched', { provider: result.provider, url: result.url });
  return result;
}
