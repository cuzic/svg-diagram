import type { ToneEnv } from './tokens.ts';
import type { Theme } from './types/core.ts';
import type { LaidOutPlane } from './types/figures.ts';
export declare function renderPlane(b: LaidOutPlane, day: Theme, tones: ToneEnv, stage?: number): string;
