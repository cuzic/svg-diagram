import type { PeopleBand, PeopleOpts, DotsBand, DotsOpts, DotDatum } from '../types/people-dots.ts';
import type { Declares, HandleOf } from '../strict.ts';
export declare function people<const Id extends string = never>(total: number, count: number | readonly [number, number], opts?: PeopleOpts & {
    id?: Id;
}): PeopleBand & Declares<Id> & HandleOf<Id>;
export declare function dots<const Id extends string = never>(values: readonly DotDatum[], opts?: DotsOpts & {
    id?: Id;
}): DotsBand & Declares<Id> & HandleOf<Id>;
