import type { ToneEnv } from './tokens.ts';
import type { Theme, Roles } from './types/core.ts';
import type { LaidOutTable } from './types/sequence-table-swimlane.ts';
export declare function renderTable(band: LaidOutTable, day: Theme, tones: ToneEnv, roles: Roles): string;
