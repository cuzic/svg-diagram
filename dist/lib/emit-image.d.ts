import type { SpotlightHooks } from './band-def.ts';
import type { ToneEnv } from './tokens.ts';
import type { Theme } from './types/core.ts';
import type { LaidOutImage, ImageBand } from './types/image.ts';
export declare function renderImage(b: LaidOutImage, day: Theme, tones: ToneEnv, stage?: number): string;
export declare const imageSpotlight: SpotlightHooks<ImageBand, LaidOutImage>;
