/**
 * remotion/index.ts
 *
 * Remotion entry point — registers all compositions.
 * This file is referenced by both:
 *  - `remotion preview` (local dev)
 *  - `renderVideo()` in lib/videoRenderer.ts (server-side render)
 */

import { registerRoot } from 'remotion';
import { Root } from './Root';

registerRoot(Root);
