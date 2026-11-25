import { DEF } from '../band-def.ts';
import type { BandDef, WithBandDef } from '../band-def.ts';
import type { Declares, IdsOf, Refers, RefsOf, RowHandleOf } from '../strict.ts';
import type { GroupBand, GroupRowBand, LaidOutRow, RowOpts } from '../types/containers.ts';
import type { BoxBand } from '../types/text-bands.ts';
export declare const groupRowDefinition: BandDef<GroupRowBand, LaidOutRow>;
export declare function groupRow<C extends (GroupBand | BoxBand) & {
    readonly [DEF]: object;
}, const Id extends string = never>(children: C[], opts?: RowOpts & {
    id?: Id;
}): WithBandDef<GroupRowBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & RowHandleOf<Id>, LaidOutRow>;
