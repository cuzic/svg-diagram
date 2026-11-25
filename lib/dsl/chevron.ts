import {chevronBand} from '../flow-chevron.ts';
import type {ChevronBand, ChevronOpts, FlowStep} from '../flow-shapes.ts';
import {withHandle} from './shared.ts';
import type {ShapeExtra} from './flow-types.ts';

/** A row or column of arrow-shaped process steps. Step ids are anchors for connect() and spotlight. */
export function chevron<const Id extends string = never, const I extends readonly FlowStep[] = readonly FlowStep[]>(steps: I, opts?: ChevronOpts & {id?: Id}): ShapeExtra<ChevronBand, Id, I> { return withHandle(chevronBand(steps, opts), opts?.id) as ShapeExtra<ChevronBand, Id, I>; }
