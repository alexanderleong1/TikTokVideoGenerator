/**
 * logger.ts
 *
 * Structured logger that:
 *  - prints to stdout (always)
 *  - persists entries to the Supabase `logs` table (best-effort, never throws)
 */

import { createClient } from '@supabase/supabase-js';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug';

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function persist(level: LogLevel, message: string, context?: Record<string, unknown>): Promise<void> {
  try {
    const db = getSupabase();
    if (!db) return;
    await db.from('logs').insert({ level, message, context: context ?? null });
  } catch {
    // Never throw from the logger
  }
}

function fmt(level: LogLevel, message: string, context?: Record<string, unknown>): string {
  const ts = new Date().toISOString();
  const ctx = context ? ` ${JSON.stringify(context)}` : '';
  return `[${ts}] [${level.toUpperCase().padEnd(5)}] ${message}${ctx}`;
}

export const logger = {
  info(message: string, context?: Record<string, unknown>) {
    console.log(fmt('info', message, context));
    persist('info', message, context);
  },
  warn(message: string, context?: Record<string, unknown>) {
    console.warn(fmt('warn', message, context));
    persist('warn', message, context);
  },
  error(message: string, context?: Record<string, unknown>) {
    console.error(fmt('error', message, context));
    persist('error', message, context);
  },
  debug(message: string, context?: Record<string, unknown>) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(fmt('debug', message, context));
      persist('debug', message, context);
    }
  },
};
