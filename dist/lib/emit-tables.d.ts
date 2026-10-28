import type { ToneEnv } from './tokens.ts';
import type { Theme, Roles } from './types/core.ts';
import type { LaidOutSequence, LaidOutTable } from './types/sequence-table-swimlane.ts';
import type { Prim } from './types/wireframe-nodes.ts';
import type { LaidOutWireframe, LaidOutScreens } from './types/wireframe.ts';
export declare function renderSequence(band: LaidOutSequence, day: Theme, tones: ToneEnv, roles: Roles): string;
export declare function renderTable(band: LaidOutTable, day: Theme, tones: ToneEnv, roles: Roles): string;
export type PaintPrim = Exclude<Prim, {
    k: 'text' | 'badge' | 'pill';
}>;
export declare function renderPrims(b: LaidOutWireframe | LaidOutScreens, day: Theme): string;
