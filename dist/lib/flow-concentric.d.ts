import type { FontFamily, Roles } from './types/core.ts';
import type { ConcentricRing, ConcentricOpts, ConcentricBand, LaidOutFlowShape } from './flow-types.ts';
import type { AnchorFn, Texts } from './flow-layout-core.ts';
export declare function concentricBand(rings: readonly ConcentricRing[] | number, opts?: ConcentricOpts): ConcentricBand;
export declare function concentricTexts(b: ConcentricBand, roles: Roles): [string, number, number, FontFamily][];
export declare function layoutConcentricShape(b: ConcentricBand, out: LaidOutFlowShape, t: Texts, anchor: AnchorFn, roles: Roles): void;
