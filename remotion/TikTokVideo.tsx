/**
 * TikTokVideo.tsx
 *
 * The main Remotion composition that assembles all layers into a
 * 1080×1920 portrait TikTok video.
 *
 * Layer order (bottom → top):
 *  1. BackgroundVideo  — full-bleed stock footage
 *  2. HookText         — punchy headline (top third, fades after 4 s)
 *  3. Captions         — animated subtitles (lower third)
 *  4. ProgressBar      — thin progress indicator (very bottom)
 *
 * Audio:
 *  The <Audio> component plays the ElevenLabs MP3 narration.
 *  Stock footage is muted inside BackgroundVideo.
 */

import React from 'react';
import { AbsoluteFill, Audio, Composition, useVideoConfig } from 'remotion';
import { BackgroundVideo } from './components/BackgroundVideo';
import { HookText } from './components/HookText';
import { Captions } from './components/Captions';
import { ProgressBar } from './components/ProgressBar';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WordTiming {
  word: string;
  startMs: number;
  endMs: number;
}

export interface TikTokVideoProps {
  topic: string;
  hook: string;
  wordTimings: WordTiming[];
  audioPath: string;
  backgroundVideoUrl: string;
  durationInFrames: number;
  fps: number;
}

// ─── Composition ──────────────────────────────────────────────────────────────

export const TikTokVideoComposition: React.FC<TikTokVideoProps> = ({
  hook,
  wordTimings,
  audioPath,
  backgroundVideoUrl,
}) => {
  return (
    <AbsoluteFill style={{ backgroundColor: '#000' }}>
      <BackgroundVideo src={backgroundVideoUrl} />
      <HookText text={hook} />
      <Captions wordTimings={wordTimings} />
      <ProgressBar />
      <Audio src={audioPath} />
    </AbsoluteFill>
  );
};
