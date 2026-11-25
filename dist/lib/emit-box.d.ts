import type { SpotlightHooks } from './band-def.ts';
import type { ToneEnv } from './tokens.ts';
import type { Roles, Theme } from './types/core.ts';
import type { LaidOutBox } from './types/text-bands.ts';
export declare function renderStepBadge(band: LaidOutBox, day: Theme, roles?: Roles): string;
export declare function renderBoxIcon(band: LaidOutBox, day: Theme, tones: ToneEnv): string;
export declare function renderTag(band: LaidOutBox, day: Theme, tones: ToneEnv, roles: Roles): string;
export declare function renderBox(band: LaidOutBox, day: Theme, tones: ToneEnv, roles: Roles): string;
export declare const boxSpotlight: SpotlightHooks<never, LaidOutBox>;
