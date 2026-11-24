import {shape} from './html-frame.ts';
import {textRuns} from './html-text-runs.ts';
import type {FontBox, HtmlBandAdapter} from './html-adapter.ts';
import type {ToneEnv} from './tokens.ts';
import {BOX_PAD_X, BOX_PAD_Y} from './layout-util.ts';
import type {Theme} from './types/core.ts';
import type {LaidOutBox} from './types/text-bands.ts';

function box(b: LaidOutBox, day: Theme, tones: ToneEnv, fb: FontBox): string {
  const px_ = b.padX ?? BOX_PAD_X, py = b.padY ?? BOX_PAD_Y;
  return shape(b, b, day, tones, 'plain') + textRuns(b.wrappedRuns, {originX: b.x + px_, originY: b.y + py, w: b.w - 2 * px_, align: b.align ?? 'left', day, tones, fb, dim: b.dim, boxTone: b.tone});
}

export const boxHtml: HtmlBandAdapter<'box'> = {
  type: 'box',
  accepts: b => b.step == null && !b.icon && !b.tagBox && !b.stamp,
  render: box,
};
