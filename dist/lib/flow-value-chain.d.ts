import type { FontFamily, Roles } from './types/core.ts';
import type { FlowStep, ValueChainOpts, ValueChainBand, LaidOutFlowShape } from './flow-types.ts';
import type { AnchorFn, Texts } from './flow-layout-core.ts';
export declare function valueChainBand(parts: {
    support?: readonly (string | FlowStep)[];
    primary: readonly (string | FlowStep)[];
}, opts?: ValueChainOpts): ValueChainBand;
export declare function valueChainTexts(b: ValueChainBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutValueChain(b: ValueChainBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn): void;
