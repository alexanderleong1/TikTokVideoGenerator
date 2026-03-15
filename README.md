# TikTok Video Generator

Automated AI pipeline that generates vertical TikTok videos and posts them twice per day.

## Pipeline

```
Claude (script) → ElevenLabs (voice) → Pexels/Pixabay (footage) → Remotion (render) → TikTok API (upload)
```

## Project Structure

```
├── lib/
│   ├── pipeline.ts          # Main orchestrator — call generateTikTokVideo()
│   ├── scriptGenerator.ts   # Claude script generation
│   ├── voiceGenerator.ts    # ElevenLabs TTS
│   ├── stockFootage.ts      # Pexels / Pixabay video fetching
│   ├── videoRenderer.ts     # Remotion server-side renderer
│   ├── tiktokUploader.ts    # TikTok Content Posting API
│   └── supabase.ts          # DB client + typed helpers
├── remotion/
│   ├── index.ts             # Remotion entry point
│   ├── Root.tsx             # Composition registry
│   ├── TikTokVideo.tsx      # Main 1080×1920 composition
│   └── components/
│       ├── BackgroundVideo.tsx
│       ├── HookText.tsx
│       ├── Captions.tsx
│       └── ProgressBar.tsx
├── jobs/
│   └── scheduler.ts         # node-cron — runs at 09:00 and 18:00
├── scripts/
│   ├── generate-video.ts    # One-shot manual trigger
│   └── setup-db.ts          # Create Supabase tables
└── utils/
    ├── logger.ts             # Structured logger → Supabase logs table
    └── helpers.ts            # retry, tmpFilePath, sleep, etc.
```

## Prerequisites

- Node.js 18+
- FFmpeg installed (`brew install ffmpeg` / `apt install ffmpeg`)
- Supabase project
- API keys (see below)

## Setup

```bash
# 1. Clone and install
git clone <repo>
cd tiktok-video-generator
npm install

# 2. Configure environment
cp .env.example .env
# Fill in all keys in .env

# 3. Create database tables
npm run setup:db

# 4. Test the pipeline (skips TikTok upload)
npm run generate:dry

# 5. Full run with upload
npm run generate

# 6. Start the scheduler (posts at 09:00 and 18:00)
npm run scheduler
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | ✅ | Claude API key |
| `ELEVENLABS_API_KEY` | ✅ | ElevenLabs TTS key |
| `ELEVENLABS_VOICE_ID` | | Defaults to Rachel |
| `PEXELS_API_KEY` | ✅ | Stock footage |
| `PIXABAY_API_KEY` | | Fallback stock footage |
| `TIKTOK_ACCESS_TOKEN` | ✅ | TikTok Content API token |
| `TIKTOK_CLIENT_KEY` | ✅ | TikTok app client key |
| `TIKTOK_CLIENT_SECRET` | ✅ | TikTok app client secret |
| `SUPABASE_URL` | ✅ | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase service-role key |
| `SCHEDULER_TZ` | | Cron timezone (default: `America/New_York`) |
| `TMP_DIR` | | Scratch files dir (default: `/tmp/tiktok-generator`) |

## One-off Commands

```bash
# Custom topic
TOPIC="Why cold showers change your brain" npm run generate

# Skip upload (render test)
SKIP_UPLOAD=true npm run generate

# Preview Remotion composition locally
npm run remotion:preview

# Keep scheduler alive with PM2
pm2 start "npm run scheduler" --name tiktok-scheduler
```

## Database Schema

```sql
-- videos: one row per generated video
id, topic, hook, script, captions, video_url,
tiktok_publish_id, status, error_message, created_at, updated_at

-- logs: structured pipeline logs
id, level, message, context, created_at
```

Statuses: `pending → generating → rendering → uploading → posted | failed`
