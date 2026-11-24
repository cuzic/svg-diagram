import {escapeHtmlText as esc, type FontBox, type HtmlBandAdapter} from './html-adapter.ts';
import {PALETTE, runColorOf} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import {resolveBoxStyle} from './emit-common.ts';
import {visibleAt} from './reveal-visibility.ts';
import {BOX_PAD_X, BOX_PAD_Y} from './layout-util.ts';
import type {LaidOutGroup} from './types/containers.ts';
import type {Theme, Align, EmphasisTone, Rect} from './types/core.ts';
import type {LaidOutBox, LaidOutBanner, LaidOutCaption, WrappedRun, Span} from './types/text-bands.ts';
import {must} from './must.ts';
import {px} from './html-document.ts';

// emit.ts snaps shapes (not text) to a 4px grid; the same here, so a box sits where its SVG twin does
const snap4 = (n: number): number => Math.round(n / 4) * 4;

function spans(sp: Span[], run: WrappedRun, color: string, day: Theme, tones: ToneEnv, dim?: boolean): string {
  return sp.map(s => {
    const fill = !dim && s.tone ? runColorOf(tones, s.tone, undefined, day) : color;
    const style = `${s.bold && run.weight !== 700 ? 'font-weight:700;' : ''}${fill !== color ? `color:${fill};` : ''}`;
    return style ? `<span style="${style}">${esc(s.text)}</span>` : esc(s.text);
  }).join('');
}

function textRuns(runs: WrappedRun[], o: {originX: number; originY: number; w: number; align: Align; day: Theme; tones: ToneEnv; fb: FontBox; dim?: boolean; boxTone?: EmphasisTone}): string {
  const out: string[] = [];
  for (const run of runs) {
    const color = o.dim ? PALETTE.muted : runColorOf(o.tones, run.tone, o.boxTone, o.day);
    const indent = run.indent ?? 0;
    const {ascent, descent} = o.fb(run.size, run.weight, run.mono);
    run.lines.forEach((line, i) => {
      const top = o.originY + must(run.lineYs[i]) - ascent; // one y per line
      const lineSpans = run.lineSpans?.[i];
      const content = lineSpans ? spans(lineSpans, run, color, o.day, o.tones, o.dim) : esc(line).trim();
      out.push(`<div class="sd-t${run.mono ? ' sd-m' : ''}" style="left:${px(o.originX + indent)};top:${px(top)};width:${px(o.w - indent)};text-align:${o.align};font-size:${run.size}px;font-weight:${run.weight};line-height:${ascent + descent}px;color:${color}">${content}</div>`);
    });
  }
  return out.join('');
}

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

function caption(b: LaidOutCaption, day: Theme, tones: ToneEnv, fb: FontBox): string {
  return textRuns(b.wrappedRuns, {originX: b.x, originY: b.y, w: b.w, align: b.align ?? 'center', day, tones, fb, dim: b.dim});
}

function group(b: LaidOutGroup, day: Theme, tones: ToneEnv, _fb: FontBox): string {
  return b.frame === false ? '' : shape(b, b, day, tones, 'muted');
}

export const boxHtml: HtmlBandAdapter<'box'> = {
  type: 'box',
  accepts: b => b.step == null && !b.icon && !b.tagBox && !b.stamp,
  render: box,
};
export const captionHtml: HtmlBandAdapter<'caption'> = {type: 'caption', accepts: b => !b.tagBox, render: caption};
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
