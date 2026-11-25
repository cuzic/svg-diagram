import type { FontFamily, Roles } from './types/core.ts';
import type { FlowStep, ChevronOpts, ChevronBand, LaidOutFlowShape } from './flow-types.ts';
import type { AnchorFn, Texts } from './flow-layout-core.ts';
export declare function chevronBand(steps: readonly FlowStep[], opts?: ChevronOpts): ChevronBand;
export declare function chevronTexts(b: ChevronBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutChevron(b: ChevronBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn): void;
