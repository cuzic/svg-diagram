import type { BoxInput, Declares, HandleOf } from '../strict.ts';
import type { BoxBand } from '../types/text-bands.ts';
export declare function box<const Id extends string = never>(opts: BoxInput<Id>): BoxBand & Declares<Id> & HandleOf<Id>;
