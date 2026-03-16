/**
 * BackgroundVideo.tsx
 *
 * Renders a looping stock video as the full-bleed background layer.
 * Uses Remotion's <OffthreadVideo> which is more reliable than <Video>
 * for server-side rendering because it doesn't depend on browser APIs.
 */

import React from 'react';
import { AbsoluteFill, Loop, OffthreadVideo } from 'remotion';

interface BackgroundVideoProps {
  src: string; // URL or staticFile path to the stock footage
}

export const BackgroundVideo: React.FC<BackgroundVideoProps> = ({ src }) => {
  return (
    <AbsoluteFill>
      {/* Loop the stock clip so it covers the full audio duration */}
      <Loop durationInFrames={300}>
        <OffthreadVideo
          src={src}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
          muted
        />
      </Loop>
      {/* Dark gradient overlay to ensure text readability */}
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.1) 40%, rgba(0,0,0,0.55) 100%)',
        }}
      />
    </AbsoluteFill>
  );
};
