import type {BandDef} from './band-def.ts';
import {oneLine} from './diagram-description.ts';
import {renderMath} from './emit-math.ts';
import {snapGrid} from './layout-util.ts';
import {layoutMath} from './math.ts';
import type {LaidOutMath, MathBand} from './types/math.ts';

/** @internal Layout and emission of a formula that has already been converted to paths. */
export const mathDefinition: BandDef<MathBand, LaidOutMath> = {
  type: 'math',
  describe: data => ['math', `数式: ${oneLine(data.alt)}`],
  layout(data, {x, y, w, roles, theme, tones}) {
    const laid = layoutMath(data, x, snapGrid(y), w, roles[data.role], theme, tones);
    return {laid, h: laid.h};
  },
  emit: renderMath,
};
