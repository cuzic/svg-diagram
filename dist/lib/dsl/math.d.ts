import type { Declares, HandleOf } from '../strict.ts';
import type { MathBand, MathOpts } from '../types/math.ts';
export declare function math<const Id extends string = never>(tex: string, opts?: MathOpts & {
    id?: Id;
}): MathBand & Declares<Id> & HandleOf<Id>;
