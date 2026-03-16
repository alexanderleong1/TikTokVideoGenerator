/**
 * Captions.tsx
 *
 * Renders one word at a time, timed to the audio narration.
 * Word timings come from edge-tts --write-subtitles (VTT format).
 */

import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { WordTiming } from '../TikTokVideo';

interface CaptionsProps {
  wordTimings: WordTiming[];
}

export const Captions: React.FC<CaptionsProps> = ({ wordTimings }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!wordTimings || wordTimings.length === 0) return null;

  const currentMs = (frame / fps) * 1000;

  // Find the active word
  let activeIndex = -1;
  for (let i = 0; i < wordTimings.length; i++) {
    if (currentMs >= wordTimings[i].startMs && currentMs < wordTimings[i].endMs) {
      activeIndex = i;
      break;
    }
  }

  if (activeIndex === -1) return null;

  const active = wordTimings[activeIndex];
  const startFrame = Math.floor((active.startMs / 1000) * fps);
  const localFrame = frame - startFrame;

  // Pop in with a spring scale
  const scale = spring({
    frame: localFrame,
    fps,
    config: { damping: 10, stiffness: 400, mass: 0.4 },
    from: 0.5,
    to: 1,
  });

  const opacity = interpolate(localFrame, [0, 3], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 220 }}
    >
      <div
        key={activeIndex}
        style={{
          textAlign: 'center',
          fontFamily: '"Inter", "Arial Black", sans-serif',
          fontWeight: 900,
          fontSize: 96,
          lineHeight: 1,
          color: '#FFFC00',
          textShadow: '0 4px 20px rgba(0,0,0,0.95), 0 1px 4px rgba(0,0,0,1)',
          WebkitTextStroke: '2px rgba(0,0,0,0.6)',
          textTransform: 'uppercase',
          opacity,
          transform: `scale(${scale})`,
          padding: '8px 28px',
          borderRadius: 14,
          background: 'rgba(0,0,0,0.3)',
        }}
      >
        {active.word}
      </div>
    </AbsoluteFill>
  );
};
