import type { Declares, IdsOf, RowHandleOf } from '../strict.ts';
import type { RowBand, RowOpts } from '../types/containers.ts';
import type { BoxBand } from '../types/text-bands.ts';
export declare function boxRow<C extends BoxBand, const Id extends string = never>(children: C[], opts?: RowOpts & {
    id?: Id;
}): RowBand & Declares<IdsOf<C> | Id> & RowHandleOf<Id>;
export declare function buildBoxRow(children: BoxBand[], opts: RowOpts): RowBand;
