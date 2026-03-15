/**
 * Captions.tsx
 *
 * Renders animated subtitle captions in the lower third of the frame.
 *
 * Each caption segment is displayed for an equal slice of the total duration
 * and animates in with a slide-up + fade-in effect.
 *
 * For production-grade word-level caption sync you would pass timestamp data
 * from ElevenLabs' /timestamps endpoint; this implementation uses equal-time
 * splitting which works well for 20–40 second clips.
 */

import React from 'react';
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

interface CaptionsProps {
  captions: string[];
}

export const Captions: React.FC<CaptionsProps> = ({ captions }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  if (!captions || captions.length === 0) return null;

  // Divide the video duration equally among captions,
  // leaving a small lead-in so they appear after the hook fades
  const leadInFrames = Math.round(fps * 1.5); // 1.5 s after start
  const usableFrames = durationInFrames - leadInFrames;
  const framesPerCaption = Math.floor(usableFrames / captions.length);

  // Determine which caption is active
  const adjustedFrame = frame - leadInFrames;
  const currentIndex =
    adjustedFrame < 0
      ? -1
      : Math.min(Math.floor(adjustedFrame / framesPerCaption), captions.length - 1);

  if (currentIndex < 0) return null;

  const captionText = captions[currentIndex];
  const captionStartFrame = leadInFrames + currentIndex * framesPerCaption;

  // Local frame within the current caption segment
  const localFrame = frame - captionStartFrame;

  // Slide-up spring
  const translateY = spring({
    frame: localFrame,
    fps,
    config: { damping: 16, stiffness: 200 },
    durationInFrames: 12,
    from: 30,
    to: 0,
  });

  // Fade in quickly, fade out near the end of the segment
  const fadeInOpacity = interpolate(localFrame, [0, 8], [0, 1], {
    extrapolateRight: 'clamp',
  });
  const fadeOutOpacity = interpolate(
    localFrame,
    [framesPerCaption - 10, framesPerCaption],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const opacity = Math.min(fadeInOpacity, fadeOutOpacity);

  return (
    <AbsoluteFill
      style={{
        justifyContent: 'flex-end',
        alignItems: 'center',
        paddingBottom: 200, // above the progress bar
      }}
    >
      <div
        key={currentIndex} // re-mount on caption change for clean animation
        style={{
          maxWidth: '88%',
          textAlign: 'center',
          fontFamily: '"Inter", "Arial Black", sans-serif',
          fontWeight: 800,
          fontSize: 56,
          lineHeight: 1.2,
          color: '#FFFC00', // TikTok signature yellow
          textShadow: '0 3px 16px rgba(0,0,0,0.9), 0 1px 4px rgba(0,0,0,1)',
          WebkitTextStroke: '1.5px rgba(0,0,0,0.7)',
          opacity,
          transform: `translateY(${translateY}px)`,
          padding: '12px 24px',
          borderRadius: 12,
          background: 'rgba(0,0,0,0.25)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {captionText}
      </div>
    </AbsoluteFill>
  );
};
