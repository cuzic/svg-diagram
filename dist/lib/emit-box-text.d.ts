import type { ToneEnv } from './tokens.ts';
import type { Align, Theme } from './types/core.ts';
import type { LaidOutBanner, LaidOutBox } from './types/text-bands.ts';
export declare function boxTextPlacement(band: LaidOutBox | LaidOutBanner): {
    originX: number;
    originY: number;
    w: number;
    align: Align;
};
export declare function renderBoxText(band: LaidOutBox | LaidOutBanner, day: Theme, tones: ToneEnv): string;
