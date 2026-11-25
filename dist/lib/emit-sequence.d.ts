import type { ToneEnv } from './tokens.ts';
import type { Theme, Roles } from './types/core.ts';
import type { LaidOutSequence } from './types/sequence-table-swimlane.ts';
export declare function renderSequence(band: LaidOutSequence, day: Theme, tones: ToneEnv, roles: Roles): string;
