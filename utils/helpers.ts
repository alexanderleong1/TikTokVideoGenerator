/**
 * helpers.ts
 *
 * Generic utility functions used across the pipeline.
 */

import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

/** Ensure a directory exists, creating it recursively if needed. */
export function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/** Return the tmp directory, creating it if absent. */
export function getTmpDir(): string {
  const dir = process.env.TMP_DIR ?? '/tmp/tiktok-generator';
  ensureDir(dir);
  return dir;
}

/** Generate a unique file path in the tmp directory. */
export function tmpFilePath(ext: string): string {
  return path.join(getTmpDir(), `${uuidv4()}.${ext}`);
}

/** Sleep for `ms` milliseconds. */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Clamp a number between min and max. */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** Retry an async function up to `maxAttempts` times with exponential back-off. */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        const delay = baseDelayMs * 2 ** (attempt - 1);
        await sleep(delay);
      }
    }
  }
  throw lastError;
}

/** Safely delete a file, ignoring errors if it doesn't exist. */
export function safeUnlink(filePath: string): void {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // ignore
  }
}

/** Convert seconds to Remotion frame count at 30 fps. */
export function secondsToFrames(seconds: number, fps = 30): number {
  return Math.round(seconds * fps);
}
