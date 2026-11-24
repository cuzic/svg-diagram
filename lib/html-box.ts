import {textRuns} from './html-text-runs.ts';
import type {FontBox, HtmlBandAdapter} from './html-adapter.ts';
import {PALETTE} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import {resolveBoxStyle} from './emit-common.ts';
import {visibleAt} from './reveal-visibility.ts';
import {BOX_PAD_X, BOX_PAD_Y} from './layout-util.ts';
import type {LaidOutGroup} from './types/containers.ts';
import type {Theme, EmphasisTone, Rect} from './types/core.ts';
import type {LaidOutBox, LaidOutBanner} from './types/text-bands.ts';
import {px} from './html-document.ts';

// emit.ts snaps shapes (not text) to a 4px grid; the same here, so a box sits where its SVG twin does
const snap4 = (n: number): number => Math.round(n / 4) * 4;

function shape(r: Rect, o: {tone?: EmphasisTone; dashed?: boolean; dim?: boolean}, day: Theme, tones: ToneEnv, fallbackTone: EmphasisTone): string {
  const st = resolveBoxStyle(tones, o.tone ?? fallbackTone, day, o.dashed);
  let {fill, stroke} = st;
  let line = st.dashed ? 'dashed' : 'solid';
  if (o.dim) { fill = PALETTE.bg; stroke = PALETTE.muted; line = 'dotted'; }
  // The SVG strokes 2.5px centred on the edge: the outer edge is 1.25px out, the outer radius 8 + 1.25. A CSS border is rounded to
  // whole device pixels (2.5px draws as 2px), so a solid outline is an inset box-shadow, which is not; a dashed one has to be a border.
  const outline = line === 'solid' ? `box-shadow:inset 0 0 0 2.5px ${stroke}` : `border:2.5px ${line} ${stroke}`;
  return `<div class="sd-b" style="left:${px(snap4(r.x) - 1.25)};top:${px(snap4(r.y) - 1.25)};width:${px(snap4(r.x + r.w) - snap4(r.x) + 2.5)};height:${px(snap4(r.h) + 2.5)};background:${fill};${outline}"></div>`;
}

function box(b: LaidOutBox, day: Theme, tones: ToneEnv, fb: FontBox): string {
  const px_ = b.padX ?? BOX_PAD_X, py = b.padY ?? BOX_PAD_Y;
  return shape(b, b, day, tones, 'plain') + textRuns(b.wrappedRuns, {originX: b.x + px_, originY: b.y + py, w: b.w - 2 * px_, align: b.align ?? 'left', day, tones, fb, dim: b.dim, boxTone: b.tone});
}

function banner(b: LaidOutBanner, day: Theme, tones: ToneEnv, fb: FontBox): string {
  const px_ = b.padX ?? BOX_PAD_X, py = b.padY ?? BOX_PAD_Y;
  return shape(b, b, day, tones, 'accent') + textRuns(b.wrappedRuns, {originX: b.x + px_, originY: b.y + py, w: b.w - 2 * px_, align: b.align ?? 'center', day, tones, fb, dim: b.dim, boxTone: b.tone});
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
export const bannerHtml: HtmlBandAdapter<'banner'> = {type: 'banner', accepts: b => !b.tagBox && !b.stamp, render: banner};
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
