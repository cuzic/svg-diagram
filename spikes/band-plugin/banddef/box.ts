// `svg-diagram/bands/box` in prototype form: the REAL text layout (layoutBoxContent) and the REAL emitter (renderBox) behind one BandDef.
// Reduced: no icon / step / tag / stamp placement (those are more of placeBoxLike's body, which would move into this file). The DSL box()
// constructor is NOT used: lib/dsl/text-bands.ts imports walkBands from rules.ts (the 93 KB rules module) and toc.ts, which is part of why a box
// pulls the whole library today.
import {layoutBoxContent, styledAtoms, textRuns} from '../../../lib/layout-text.ts';
import {renderBox} from '../../../lib/emit-boxes.ts';
import {BOX_PAD_X, BOX_PAD_Y} from '../../../lib/layout-util.ts';
import {NO_TONES} from '../../../lib/tokens.ts';
import type {BoxBand, LaidOutBox} from '../../../lib/types/text-bands.ts';
import {band, defineBand} from './band-def.ts';

export const boxDef = defineBand<BoxBand, LaidOutBox>({
  type: 'box',
  measure: (d, m) => { for (const run of textRuns(d as never, m.roles)) for (const a of styledAtoms(run)) m.atoms(a.text, run.size, a.weight, run.mono ? 'mono' : 'sans'); },
  layout: (d, env) => {
    const wrapWidth = env.w - 2 * (d.padX ?? BOX_PAD_X);
    const c = layoutBoxContent(d as never, wrapWidth, env.widthOf, env.roles, 'phrase');
    const h = c.textHeight + 2 * (d.padY ?? BOX_PAD_Y);
    const laid = {...d, x: env.x, y: env.y, w: env.w, h, wrappedRuns: c.wrappedRuns} as LaidOutBox;
    return {laid, h, ...(d.id ? {anchors: [{id: d.id, x: env.x, y: env.y, w: env.w, h}]} : {})};
  },
  emit: (laid, env) => renderBox(laid, 'blue' as never, NO_TONES, env.roles),
});
export const box = (data: Pick<BoxBand, 'title' | 'body'> & {id?: string; tone?: BoxBand['tone']}) => band(boxDef, {type: 'box', ...data} as BoxBand, data.id);
