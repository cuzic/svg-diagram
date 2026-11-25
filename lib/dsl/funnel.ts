import {funnelBand} from '../flow-funnel.ts';
import type {FunnelBand, FunnelOpts, FunnelStage} from '../flow-shapes.ts';
import {withHandle} from './shared.ts';
import type {ShapeExtra} from './flow-types.ts';

/** A narrowing stack of funnel stages. `scale: 'value'` uses each stage value; `showRate` prints conversion from the preceding stage. */
export function funnel<const Id extends string = never, const I extends readonly FunnelStage[] = readonly FunnelStage[]>(stages: I, opts?: FunnelOpts & {id?: Id}): ShapeExtra<FunnelBand, Id, I> { return withHandle(funnelBand(stages, opts), opts?.id) as ShapeExtra<FunnelBand, Id, I>; }
