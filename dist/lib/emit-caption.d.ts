import type { SpotlightHooks } from './band-def.ts';
import type { ToneEnv } from './tokens.ts';
import type { Align, Theme } from './types/core.ts';
import type { LaidOutCaption, CaptionBand } from './types/text-bands.ts';
export declare function captionTextPlacement(band: LaidOutCaption): {
    originX: number;
    originY: number;
    w: number;
    align: Align;
};
export declare function renderCaption(band: LaidOutCaption, day: Theme, tones: ToneEnv): string;
export declare const captionSpotlight: SpotlightHooks<CaptionBand, LaidOutCaption>;
