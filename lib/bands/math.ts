import {oneLine} from '../diagram-description.ts';
import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {math as build} from '../dsl/math.ts';
import {renderMath} from '../emit-math.ts';
import {snapGrid} from '../layout-util.ts';
import {layoutMath} from '../math.ts';
import type {LaidOutMath, MathBand, MathOpts} from '../types/math.ts';

const definition = {
  type: 'math',
  describe: data => ['math', `数式: ${oneLine(data.alt)}`],
  layout(data, {x, y, w, roles, theme, tones}) {
    const laid = layoutMath(data, x, snapGrid(y), w, roles[data.role], theme, tones);
    return {laid, h: laid.h};
  },
  emit: renderMath,
} satisfies BandDef<MathBand, LaidOutMath>;

/** Convert TeX with the optional MathJax dependency and attach its SVG layout. */
export function math<const Id extends string = never>(tex: string, opts?: MathOpts & {id?: Id}): WithBandDef<ReturnType<typeof build<Id>>, LaidOutMath> {
  const data = build<Id>(tex, opts);
  return band<typeof data, LaidOutMath>(definition, data);
}
