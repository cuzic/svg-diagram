import type { ToneEnv } from './tokens.ts';
import type { LaidOutGroup } from './types/containers.ts';
import type { Roles, Theme } from './types/core.ts';
export declare function renderGroup(band: LaidOutGroup, day: Theme, tones: ToneEnv, roles: Roles): string;
