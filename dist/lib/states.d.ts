import type { FontFamily, Roles, WidthOf, WrapEnv } from './types/core.ts';
import type { LaidOutStates, StatesBand } from './types/diagrams.ts';
export declare const STATE_ICON = 24;
export declare function statesTexts(band: StatesBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutStatesBand(band: StatesBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number): LaidOutStates;
