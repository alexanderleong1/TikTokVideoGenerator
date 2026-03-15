/**
 * setup-db.ts
 *
 * Creates the required Supabase tables using the service-role client.
 * Run once after setting up your Supabase project:
 *
 *   npm run setup:db
 *
 * Safe to re-run — uses CREATE TABLE IF NOT EXISTS.
 */

import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !key) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(url, key);

const SQL = `
-- Videos table: one row per generated video
CREATE TABLE IF NOT EXISTS videos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic              TEXT NOT NULL,
  hook               TEXT NOT NULL,
  script             TEXT NOT NULL,
  captions           JSONB NOT NULL DEFAULT '[]',
  video_url          TEXT,
  tiktok_publish_id  TEXT,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending','generating','rendering','uploading','posted','failed')),
  error_message      TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Logs table: structured log entries from the pipeline
CREATE TABLE IF NOT EXISTS logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  level      TEXT NOT NULL CHECK (level IN ('info','warn','error','debug')),
  message    TEXT NOT NULL,
  context    JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for quick status queries
CREATE INDEX IF NOT EXISTS videos_status_idx ON videos (status);
CREATE INDEX IF NOT EXISTS videos_created_at_idx ON videos (created_at DESC);
CREATE INDEX IF NOT EXISTS logs_created_at_idx ON logs (created_at DESC);
CREATE INDEX IF NOT EXISTS logs_level_idx ON logs (level);
`;

async function main(): Promise<void> {
  console.log('Setting up Supabase tables...');

  const { error } = await supabase.rpc('exec_sql', { sql: SQL }).single();

  // exec_sql RPC may not exist — fall back to raw REST if needed
  if (error) {
    console.log('exec_sql RPC unavailable; run the SQL manually in the Supabase dashboard.');
    console.log('\nSQL to run:\n');
    console.log(SQL);
    console.log('\nOr enable the pg_tle extension and create the exec_sql function.');
  } else {
    console.log('✅ Tables created successfully.');
  }
}

main().catch((err) => {
  console.error('Setup failed:', err);
  process.exit(1);
});
