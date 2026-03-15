/**
 * HookText.tsx
 *
 * Displays the hook headline in the top third of the frame.
 * Animates in with a spring for a punchy entrance, then fades out
 * after 3 seconds so it doesn't block the captions.
 */

import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

interface HookTextProps {
  text: string;
}

export const HookText: React.FC<HookTextProps> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  // Spring scale-in on first frame
  const scale = spring({
    frame,
    fps,
    config: { damping: 14, stiffness: 180 },
    durationInFrames: 20,
  });

  // Fade out between second 3 and second 4
  const opacity = interpolate(
    frame,
    [fps * 3, fps * 4],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-start',
        alignItems: 'center',
        paddingTop: 120,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          textAlign: 'center',
          fontFamily: '"Inter", "Arial Black", sans-serif',
          fontWeight: 900,
          fontSize: 64,
          lineHeight: 1.1,
          color: '#FFFFFF',
          textShadow: '0 4px 24px rgba(0,0,0,0.8), 0 2px 8px rgba(0,0,0,0.9)',
          // TikTok-style yellow outline effect
          WebkitTextStroke: '2px rgba(0,0,0,0.6)',
          letterSpacing: '-1px',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};
