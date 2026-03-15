/**
 * ProgressBar.tsx
 *
 * A thin animated progress bar at the bottom of the frame showing
 * how far through the video the viewer is. Common in viral TikTok content
 * as a subtle "watch till the end" hook.
 */

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';

interface ProgressBarProps {
  color?: string;
  height?: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  color = '#FE2C55', // TikTok red
  height = 6,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();

  const progress = frame / (durationInFrames - 1);
  const widthPercent = Math.min(progress * 100, 100);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        pointerEvents: 'none',
      }}
    >
      {/* Track */}
      <div
        style={{
          width: '100%',
          height,
          backgroundColor: 'rgba(255,255,255,0.25)',
          position: 'relative',
        }}
      >
        {/* Fill */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${widthPercent}%`,
            backgroundColor: color,
            borderRadius: '0 4px 4px 0',
            // Subtle glow
            boxShadow: `0 0 8px 2px ${color}88`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
