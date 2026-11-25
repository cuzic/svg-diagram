import type { SpotlightHooks } from './band-def.ts';
import type { ToneEnv } from './tokens.ts';
import type { Theme } from './types/core.ts';
import type { LaidOutQuadrant, QuadrantBand } from './quadrant.ts';
export declare function renderQuadrant(b: LaidOutQuadrant, day: Theme, tones: ToneEnv): string;
export declare const quadrantSpotlight: SpotlightHooks<QuadrantBand, LaidOutQuadrant>;
