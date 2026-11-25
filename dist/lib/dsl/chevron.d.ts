import type { ChevronBand, ChevronOpts, FlowStep } from '../flow-shapes.ts';
import type { ShapeExtra } from './flow-types.ts';
/** A row or column of arrow-shaped process steps. Step ids are anchors for connect() and spotlight. */
export declare function chevron<const Id extends string = never, const I extends readonly FlowStep[] = readonly FlowStep[]>(steps: I, opts?: ChevronOpts & {
    id?: Id;
}): ShapeExtra<ChevronBand, Id, I>;
