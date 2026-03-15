/**
 * generate-video.ts
 *
 * One-shot CLI script to manually trigger the full pipeline.
 *
 * Usage:
 *   npm run generate
 *   TOPIC="Why cold showers work" npm run generate
 *   SKIP_UPLOAD=true npm run generate   # render only, skip TikTok upload
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { generateTikTokVideo } from '../lib/pipeline';
import { logger } from '../utils/logger';

async function main(): Promise<void> {
  const customTopic = process.env.TOPIC;
  const skipUpload = process.env.SKIP_UPLOAD === 'true';

  logger.info('Manual generation started', { customTopic, skipUpload });

  const result = await generateTikTokVideo({ customTopic, skipUpload });

  console.log('\n✅ Done!');
  console.log(`   Video ID:   ${result.videoId}`);
  console.log(`   Topic:      ${result.topic}`);
  console.log(`   Video path: ${result.videoPath}`);
  console.log(`   Publish ID: ${result.publishId ?? '(skipped)'}`);
  console.log(`   Status:     ${result.status}`);
}

main().catch((err) => {
  console.error('Fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
