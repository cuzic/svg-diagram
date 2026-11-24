import {shape} from './html-frame.ts';
import {textRuns} from './html-text-runs.ts';
import type {FontBox, HtmlBandAdapter} from './html-adapter.ts';
import type {ToneEnv} from './tokens.ts';
import {visibleAt} from './reveal-visibility.ts';
import {BOX_PAD_X, BOX_PAD_Y} from './layout-util.ts';
import type {LaidOutGroup} from './types/containers.ts';
import type {Theme} from './types/core.ts';
import type {LaidOutBox} from './types/text-bands.ts';

function box(b: LaidOutBox, day: Theme, tones: ToneEnv, fb: FontBox): string {
  const px_ = b.padX ?? BOX_PAD_X, py = b.padY ?? BOX_PAD_Y;
  return shape(b, b, day, tones, 'plain') + textRuns(b.wrappedRuns, {originX: b.x + px_, originY: b.y + py, w: b.w - 2 * px_, align: b.align ?? 'left', day, tones, fb, dim: b.dim, boxTone: b.tone});
}

function group(b: LaidOutGroup, day: Theme, tones: ToneEnv, _fb: FontBox): string {
  return b.frame === false ? '' : shape(b, b, day, tones, 'muted');
}

export const boxHtml: HtmlBandAdapter<'box'> = {
  type: 'box',
  accepts: b => b.step == null && !b.icon && !b.tagBox && !b.stamp,
  render: box,
};
export {captionHtml} from './html-caption.ts';
export {bannerHtml} from './html-banner.ts';
export const groupHtml: HtmlBandAdapter<'group'> = {type: 'group', accepts: b => !b.stamp, render: group};
export const rowHtml: HtmlBandAdapter<'row'> = {
  type: 'row',
  accepts: b => b.arrows.length === 0 && b.children.every(boxHtml.accepts),
  render: (b, day, tones, fb, _roles, stage) => b.children.filter(c => visibleAt(c, stage)).map(c => box(c, day, tones, fb)).join(''),
};
export const gridHtml: HtmlBandAdapter<'grid'> = {
  type: 'grid',
  accepts: b => b.children.every(boxHtml.accepts),
  render: (b, day, tones, fb, _roles, stage) => b.children.filter(c => visibleAt(c, stage)).map(c => box(c, day, tones, fb)).join(''),
};
