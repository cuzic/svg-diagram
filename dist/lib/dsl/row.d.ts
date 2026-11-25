import type { AreasBand, ConnectBand, GridBand, GroupBand, RowBand, RowOpts, SpacerBand, GroupRowBand } from '../types/containers.ts';
import type { Band } from '../types/index.ts';
import type { BoxBand } from '../types/text-bands.ts';
import type { Declares, IdsOf, Refers, RefsOf, RowHandleOf } from '../strict.ts';
export declare function row<C extends BoxBand, const Id extends string = never>(children: C[], opts?: RowOpts & {
    id?: Id;
}): RowBand & Declares<IdsOf<C> | Id> & RowHandleOf<Id>;
export declare function row<C extends BoxBand | GroupBand, const Id extends string = never>(children: C[], opts?: RowOpts & {
    id?: Id;
}): GroupRowBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & RowHandleOf<Id>;
export declare function row<C extends BoxBand | GroupBand | Exclude<Band, ConnectBand | SpacerBand | RowBand | GroupRowBand | GridBand | AreasBand>, const Id extends string = never>(children: C[], opts?: RowOpts & {
    id?: Id;
}): GroupRowBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & RowHandleOf<Id>;
