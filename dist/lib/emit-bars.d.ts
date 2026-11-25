import type { SpotlightHooks } from './band-def.ts';
import type { LaidOutBars, BarsBand } from './types/bars.ts';
import type { Theme } from './types/core.ts';
export declare function renderBars(b: LaidOutBars, day: Theme, stage?: number, dimFill?: boolean): string;
export declare const barsSpotlight: SpotlightHooks<BarsBand, LaidOutBars>;
