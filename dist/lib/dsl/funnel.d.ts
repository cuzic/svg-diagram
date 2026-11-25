import type { FunnelBand, FunnelOpts, FunnelStage } from '../flow-shapes.ts';
import type { ShapeExtra } from './flow-types.ts';
/** A narrowing stack of funnel stages. `scale: 'value'` uses each stage value; `showRate` prints conversion from the preceding stage. */
export declare function funnel<const Id extends string = never, const I extends readonly FunnelStage[] = readonly FunnelStage[]>(stages: I, opts?: FunnelOpts & {
    id?: Id;
}): ShapeExtra<FunnelBand, Id, I>;
