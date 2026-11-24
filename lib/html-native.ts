import {PALETTE, runColorOf, textColorOf} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import {resolveBoxStyle} from './emit-common.ts';
import {visibleAt} from './reveal-visibility.ts';
import {BOX_PAD_X, BOX_PAD_Y} from './layout-util.ts';
import type {LaidOutGroup} from './types/containers.ts';
import type {Theme, Align, EmphasisTone, Rect, Roles} from './types/core.ts';
import type {LaidOutBand} from './types/index.ts';
import type {LaidOutTable} from './types/sequence-table-swimlane.ts';
import type {LaidOutBox, LaidOutBanner, LaidOutCaption, WrappedRun, Span} from './types/text-bands.ts';
import {must} from './must.ts';
import {px} from './html-document.ts';

// like SVG text, runs of white space are one space (XML white space only: U+3000 and NBSP are characters, not white space)
const collapse = (s: string): string => s.replace(/[ \t\r\n]+/g, ' ');
const esc = (s: string): string => collapse(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c] as string);
// emit.ts snaps shapes (not text) to a 4px grid; the same here, so a box sits where its SVG twin does
const snap4 = (n: number): number => Math.round(n / 4) * 4;

/** The ascent and descent of the primary font at a size: given by the shell (lib/font-box.ts), which reads the font files. */
export type FontBox = (size: number, weight: number, mono: boolean) => {ascent: number; descent: number};

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

// One line of text at an absolute spot: `baseline` is where the glyphs sit (as the SVG <text> y would be), relative to the parent.
function lineDiv(o: {fb: FontBox; left: number; baseline: number; width: number; align: Align; size: number; weight: number; mono: boolean; color: string; html: string}): string {
  const {ascent, descent} = o.fb(o.size, o.weight, o.mono);
  return `<div class="sd-t${o.mono ? ' sd-m' : ''}" style="left:${px(o.left)};top:${px(o.baseline - ascent)};width:${px(o.width)};text-align:${o.align};font-size:${o.size}px;font-weight:${o.weight};line-height:${ascent + descent}px;color:${o.color}">${o.html}</div>`;
}

// A real <table> (header cells are <th>, so assistive technology reads rows and columns) with fixed column widths and row heights;
// the text of a cell is pre-broken lines placed over its box. Rounded corners come from a clipping wrapper, the outline from an overlay.
function table(b: LaidOutTable, day: Theme, tones: ToneEnv, fb: FontBox, roles: Roles): string {
  const out = tablePlain(b, day, tones, fb, roles);
  // outside the spotlight: what emit.ts does to the SVG of a table: every colour but the page's becomes muted
  return b.dim ? out.replace(/#[0-9a-fA-F]{6}/g, c => c.toLowerCase() === PALETTE.bg.toLowerCase() ? c : PALETTE.muted) : out;
}

function tablePlain(b: LaidOutTable, day: Theme, tones: ToneEnv, fb: FontBox, roles: Roles): string {
  const R = 8, LH = 1.4;
  const first = must(b.rows[0]);
  const y0 = first.y, y1 = must(b.rows[b.rows.length - 1]).y + must(b.rows[b.rows.length - 1]).h;
  const firstBody = b.rows.findIndex(r => !r.header);
  const rule = `2px solid ${PALETTE.border}`;
  const cols = b.colW.map(w => `<col style="width:${px(w)}">`).join('');
  const rows = b.rows.map((row, i) => {
    const bg = row.header ? PALETTE[day].soft : row.tone ? resolveBoxStyle(tones, row.tone, day).fill : PALETTE.bg;
    const cells = row.cells.map((c, j) => {
      const tag = row.header ? 'th' : b.rowHeader && j === 0 ? 'th' : 'td';
      const scope = tag === 'th' ? ` scope="${row.header ? 'col' : 'row'}"` : '';
      const heading = b.rowHeader && !row.header && j === 0;
      const left = c.align === 'center' ? 0 : c.align === 'right' ? 0 : 12;
      const right = c.align === 'right' ? 12 : 0;
      // a collapsed border takes half its width out of the cell on each side it has: shift the text back by that much
      const edge = j === 1 && b.rowHeader && i >= firstBody && firstBody >= 0 ? 3 : j > 0 ? 2 : 0;
      const topRule = i > 0 || b.titleBar ? 2 : 0;
      const lines = c.lines.map((l, k) => lineDiv({fb, left: left - edge / 2, baseline: c.top - row.y - topRule / 2 + b.bodySize + k * b.bodySize * LH, width: c.w - left - right, align: c.align, size: b.bodySize, weight: c.bold ? 700 : 400, mono: c.mono, color: textColorOf(tones, c.tone, day), html: esc(l)})).join('');
      const style = heading ? `background:${PALETTE[day].soft};` : '';
      const borderL = edge === 3 ? `border-left:3px solid ${PALETTE.text};` : edge ? `border-left:${rule};` : '';
      return `<${tag}${scope} style="${style}${borderL}">${lines}</${tag}>`;
    }).join('');
    return `<tr style="height:${px(row.h)};background:${bg};${i > 0 || b.titleBar ? `border-top:${rule};` : ''}">${cells}</tr>`;
  }).join('');
  const title = b.titleBar
    ? `<div class="sd-tb" style="left:${px(b.x)};top:${px(b.titleBar.y)};width:${px(b.w)};height:${px(b.titleBar.h)};background:${PALETTE[day].accent}">${b.titleBar.lines.map((l, k) => lineDiv({fb, left: 12, baseline: 8 + roles.title + k * roles.title * LH, width: b.w - 24, align: 'left', size: roles.title, weight: 700, mono: false, color: PALETTE.bg, html: esc(l)})).join('')}</div>`
    : '';
    return `<div class="sd-tbl" style="left:${px(b.x)};top:${px(y0)};width:${px(b.w)};height:${px(y1 - y0)}${b.titleBar ? ';border-radius:0 0 8px 8px' : ''}"><table style="width:${px(b.w)}"><colgroup>${cols}</colgroup><tbody>${rows}</tbody></table></div>${title}<div class="sd-b" style="left:${px(b.x - 1.25)};top:${px(b.y - 1.25)};width:${px(b.w + 2.5)};height:${px(b.h + 2.5)};box-shadow:inset 0 0 0 2.5px ${PALETTE.text};border-radius:${R + 1.25}px"></div>`;
}

export interface HtmlBandAdapter<T extends LaidOutBand['type'] = LaidOutBand['type']> {
  readonly type: T;
  accepts(band: Extract<LaidOutBand, {type: T}>): boolean;
  render(band: Extract<LaidOutBand, {type: T}>, day: Theme, tones: ToneEnv, fb: FontBox, roles: Roles, stage?: number): string;
}

export type HtmlAdapters = {[T in LaidOutBand['type']]?: HtmlBandAdapter<T>};

export function htmlAdapterFor(adapters: HtmlAdapters, band: LaidOutBand): HtmlBandAdapter | undefined {
  // The lookup key couples each renderer's input type to the current band.
  const adapter = adapters[band.type];
  return adapter?.type === band.type ? adapter as HtmlBandAdapter : undefined;
}

export const boxHtml: HtmlBandAdapter<'box'> = {
  type: 'box',
  accepts: b => b.step == null && !b.icon && !b.tagBox && !b.stamp,
  render: box,
};
export const captionHtml: HtmlBandAdapter<'caption'> = {type: 'caption', accepts: b => !b.tagBox, render: caption};
export const bannerHtml: HtmlBandAdapter<'banner'> = {type: 'banner', accepts: b => !b.tagBox && !b.stamp, render: banner};
export const groupHtml: HtmlBandAdapter<'group'> = {type: 'group', accepts: b => !b.stamp, render: group};
export const tableHtml: HtmlBandAdapter<'table'> = {type: 'table', accepts: () => true, render: table};
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
