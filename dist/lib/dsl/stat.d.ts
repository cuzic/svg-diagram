import type { BoxBand, RichText, StatOpts } from '../types/text-bands.ts';
import type { Declares, HandleOf } from '../strict.ts';
/** A large, atomic value and its muted label. The result is an ordinary plain box, so it works in row(). */
export declare function stat<const Id extends string = never>(value: string | number, label: RichText, opts?: StatOpts & {
    id?: Id;
}): BoxBand & Declares<Id> & HandleOf<Id>;
