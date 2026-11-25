import type { Declares, HandleOf, IdsOf, Refers, RefsOf } from '../strict.ts';
import type { GroupBand, GroupOpts } from '../types/containers.ts';
import type { Band } from '../types/index.ts';
export declare function group<C extends Band | Band[], const Id extends string = never>(children: C, opts?: GroupOpts & {
    id?: Id;
}): GroupBand & Declares<IdsOf<C> | Id> & Refers<RefsOf<C>> & HandleOf<Id>;
