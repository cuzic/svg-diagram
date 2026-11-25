import {band} from '../band-def.ts';
import type {WithBandDef} from '../band-def.ts';
import {math as build} from '../dsl/math.ts';
import {mathDefinition} from '../math-band-definition.ts';
import type {LaidOutMath, MathOpts} from '../types/math.ts';

/** Convert TeX with the optional MathJax dependency and attach its SVG layout. */
export function math<const Id extends string = never>(tex: string, opts?: MathOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutMath> {
  const data = build<Id>(tex, opts);
  return band<typeof data, LaidOutMath>(mathDefinition, data);
}
