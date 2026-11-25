import type { FontFamily, Roles } from './types/core.ts';
import type { FlowStep, CycleOpts, CycleBand, LaidOutFlowShape } from './flow-types.ts';
import type { AnchorFn, Texts } from './flow-layout-core.ts';
export declare function cycleBand(steps: readonly FlowStep[], opts?: CycleOpts): CycleBand;
export declare function cycleTexts(b: CycleBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutCycleShape(b: CycleBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn, roles: Roles): void;
