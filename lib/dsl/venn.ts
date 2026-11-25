import {vennBand} from '../flow-venn.ts';
import type {VennBand, VennOpts, VennSet} from '../flow-shapes.ts';
import {withHandle} from './shared.ts';
import type {ShapeExtra} from './flow-types.ts';

/** A two- or three-set Venn diagram. Dashed outlines supplement translucent colours, so sets are not distinguished by colour alone. */
export function venn<const Id extends string = never, const I extends readonly VennSet[] = readonly VennSet[]>(sets: I, opts?: VennOpts & {id?: Id}): ShapeExtra<VennBand, Id, I> { return withHandle(vennBand(sets, opts), opts?.id) as ShapeExtra<VennBand, Id, I>; }
