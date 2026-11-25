import type { DotsBand, DotsOpts, DotDatum } from '../types/people-dots.ts';
import type { Declares, HandleOf } from '../strict.ts';
export declare function dots<const Id extends string = never>(values: readonly DotDatum[], opts?: DotsOpts & {
    id?: Id;
}): DotsBand & Declares<Id> & HandleOf<Id>;
