import type { Declares, HandleOf } from '../strict.ts';
import type { PlaneBand, PlaneOpts } from '../types/figures.ts';
export declare function plane<const Id extends string = never>(opts: PlaneOpts & {
    id?: Id;
}): PlaneBand & Declares<Id> & HandleOf<Id>;
