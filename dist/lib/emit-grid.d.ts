import type { SpotlightHooks } from './band-def.ts';
import type { ToneEnv } from './tokens.ts';
import type { LaidOutGrid, GridBand } from './types/containers.ts';
import type { Roles, Theme } from './types/core.ts';
export declare function renderGrid(band: LaidOutGrid, day: Theme, tones: ToneEnv, roles: Roles, stage?: number): string;
export declare const gridSpotlight: SpotlightHooks<GridBand, LaidOutGrid>;
