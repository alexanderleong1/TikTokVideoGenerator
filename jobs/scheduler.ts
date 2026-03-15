/**
 * scheduler.ts
 *
 * Runs generateTikTokVideo() automatically twice per day using node-cron.
 *
 * Schedule (America/New_York by default — change SCHEDULER_TZ env var):
 *   09:00 – morning post
 *   18:00 – evening post
 *
 * Run:
 *   npm run scheduler
 *
 * Keep alive with PM2 on a VPS:
 *   pm2 start "npm run scheduler" --name tiktok-scheduler
 */

import * as dotenv from 'dotenv';
dotenv.config();

import cron from 'node-cron';
import { generateTikTokVideo } from '../lib/pipeline';
import { logger } from '../utils/logger';

const TZ = process.env.SCHEDULER_TZ ?? 'America/New_York';

async function runPipeline(label: string): Promise<void> {
  logger.info(`Scheduler triggered: ${label}`);
  try {
    const result = await generateTikTokVideo();
    logger.info(`Scheduler job complete: ${label}`, {
      videoId: result.videoId,
      topic: result.topic,
      publishId: result.publishId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Log but don't rethrow — keep the cron process alive
    logger.error(`Scheduler job failed: ${label}`, { error: message });
  }
}

// Morning post — 09:00
cron.schedule('0 9 * * *', () => runPipeline('morning-post'), {
  scheduled: true,
  timezone: TZ,
});

// Evening post — 18:00
cron.schedule('0 18 * * *', () => runPipeline('evening-post'), {
  scheduled: true,
  timezone: TZ,
});

logger.info(`Scheduler started. Jobs at 09:00 and 18:00 (${TZ})`);
console.log('Scheduler running — press Ctrl+C to stop.');

process.on('SIGINT', () => { logger.info('Scheduler stopping'); process.exit(0); });
process.on('SIGTERM', () => { logger.info('Scheduler stopping'); process.exit(0); });
