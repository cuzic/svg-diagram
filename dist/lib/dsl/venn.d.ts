import type { VennBand, VennOpts, VennSet } from '../flow-shapes.ts';
import type { ShapeExtra } from './flow-types.ts';
/** A two- or three-set Venn diagram. Dashed outlines supplement translucent colours, so sets are not distinguished by colour alone. */
export declare function venn<const Id extends string = never, const I extends readonly VennSet[] = readonly VennSet[]>(sets: I, opts?: VennOpts & {
    id?: Id;
}): ShapeExtra<VennBand, Id, I>;
