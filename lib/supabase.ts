/**
 * supabase.ts
 *
 * Supabase client (service-role, server-only) + typed helpers for
 * the `videos` and `logs` tables.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VideoStatus =
  | 'pending'
  | 'generating'
  | 'rendering'
  | 'uploading'
  | 'posted'
  | 'failed';

export interface Video {
  id: string;
  topic: string;
  hook: string;
  script: string;
  captions: string[];
  video_url: string | null;
  tiktok_publish_id: string | null;
  status: VideoStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface Log {
  id: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context: Record<string, unknown> | null;
  created_at: string;
}

// ─── Client singleton ─────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!_client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
    }
    _client = createClient(url, key);
  }
  return _client;
}

// ─── Video helpers ────────────────────────────────────────────────────────────

export async function createVideoRecord(data: {
  topic: string;
  hook: string;
  script: string;
  captions: string[];
}): Promise<Video> {
  const { data: video, error } = await getClient()
    .from('videos')
    .insert({ ...data, status: 'pending' })
    .select()
    .single();

  if (error) throw new Error(`createVideoRecord failed: ${error.message}`);
  return video as Video;
}

export async function updateVideoRecord(
  id: string,
  updates: Partial<Omit<Video, 'id' | 'created_at'>>,
): Promise<void> {
  const { error } = await getClient()
    .from('videos')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(`updateVideoRecord(${id}) failed: ${error.message}`);
}

export async function listVideos(limit = 50): Promise<Video[]> {
  const { data, error } = await getClient()
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listVideos failed: ${error.message}`);
  return (data ?? []) as Video[];
}

export async function listLogs(limit = 100): Promise<Log[]> {
  const { data, error } = await getClient()
    .from('logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`listLogs failed: ${error.message}`);
  return (data ?? []) as Log[];
}
