import type { FontFamily, Roles } from './types/core.ts';
import type { FunnelStage, FunnelOpts, FunnelBand, LaidOutFlowShape } from './flow-types.ts';
import type { AnchorFn, Texts } from './flow-layout-core.ts';
export declare function funnelBand(stages: readonly FunnelStage[], opts?: FunnelOpts): FunnelBand;
export declare function funnelTexts(b: FunnelBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutFunnel(b: FunnelBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn, roles: Roles): void;
