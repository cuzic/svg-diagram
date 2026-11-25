import type { ArrowDiagramOpts } from '../../dsl/diagrams.ts';
import type { ArrowActivity } from '../../qc.ts';
export type { ArrowDiagramOpts, ArrowActivity };
export declare function arrowDiagram(activities: readonly ArrowActivity[], opts?: ArrowDiagramOpts): (import("../../band-def.ts").WithBandDef<import("../../dsl-pure.ts").CaptionBand, import("../../dsl-pure.ts").LaidOutCaption> | import("../../band-def.ts").WithBandDef<import("../../dsl-pure.ts").StatesBand, import("../../dsl-pure.ts").LaidOutStates>)[];
