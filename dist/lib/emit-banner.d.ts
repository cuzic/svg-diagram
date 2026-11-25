import type { ToneEnv } from './tokens.ts';
import type { Roles, Theme } from './types/core.ts';
import type { LaidOutBanner } from './types/text-bands.ts';
export declare function renderBanner(band: LaidOutBanner, day: Theme, tones: ToneEnv, roles: Roles): string;
