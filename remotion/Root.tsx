/**
 * Root.tsx
 *
 * Registers Remotion compositions. Add new compositions here as the project grows.
 *
 * The <Composition> defaultProps are used by `remotion preview` for live preview.
 * In production the videoRenderer passes real props via `inputProps`.
 */

import React from 'react';
import { Composition } from 'remotion';
import { TikTokVideoComposition, TikTokVideoProps } from './TikTokVideo';

// Preview defaults (used by `npm run remotion:preview` only)
const PREVIEW_PROPS: TikTokVideoProps = {
  topic: 'The shocking truth about sleep',
  hook: 'You\'ve been sleeping WRONG your entire life...',
  wordTimings: [],
  audioPath: '',
  backgroundVideoUrl:
    'https://videos.pexels.com/video-files/856543/856543-hd_1080_1920_24fps.mp4',
  durationInFrames: 900, // 30 s at 30 fps
  fps: 30,
};

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="TikTokVideo"
        component={TikTokVideoComposition}
        durationInFrames={PREVIEW_PROPS.durationInFrames}
        fps={30}
        width={1080}
        height={1920}
        defaultProps={PREVIEW_PROPS}
        calculateMetadata={({ props }) => ({
          durationInFrames: props.durationInFrames as number,
          fps: props.fps as number,
        })}
      />
    </>
  );
};
