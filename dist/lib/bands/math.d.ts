import type { WithBandDef } from '../band-def.ts';
import { math as build } from '../dsl/math.ts';
import type { LaidOutMath, MathOpts } from '../types/math.ts';
/** Convert TeX with the optional MathJax dependency and attach its SVG layout. */
export declare function math<const Id extends string = never>(tex: string, opts?: MathOpts & {
    id?: Id;
}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutMath>;
