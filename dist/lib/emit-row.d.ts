import type { SpotlightHooks } from './band-def.ts';
import type { SvgBandDefs } from './emit-svg-core.ts';
import type { ToneEnv } from './tokens.ts';
import type { LaidOutRow } from './types/containers.ts';
import type { Roles, Theme } from './types/core.ts';
export declare function rowSvgDefs(band: LaidOutRow): SvgBandDefs;
export declare function renderRow(band: LaidOutRow, day: Theme, tones: ToneEnv, roles: Roles, stage?: number): string;
export declare function rowSlot<T>(band: {
    id?: string;
    children: readonly T[];
}, id: string): T | undefined;
export declare const rowSpotlight: SpotlightHooks<never, LaidOutRow>;
