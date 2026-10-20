// Serializes a layoutDiagram() result into an HTML fragment: boxes, banners, group frames and every line of text are
// absolutely positioned elements styled by CSS; everything CSS cannot draw (connectors, arrowheads, tables, curves, wireframes …)
// is the SVG emit.ts already makes, laid over the same canvas in one inline <svg class="sd-ov">.
//
// Same geometry as the SVG: layout.ts has already broken every text into lines and placed each baseline, so a line is one element
// with white-space: pre — the browser never re-wraps it. A line's top is its baseline minus the font's ascent (its line-height is
// ascent + descent), which is how the baseline lands where the <text> of the SVG puts it.
import {PALETTE, FONT_STACKS, runColorOf, textColorOf, isSolidTone, colorOf, toneStyle, recolor, toneEnv} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import {createHash} from 'node:crypto';
import {emitSvg, resolveBoxStyle} from './emit.ts';
import {shapesToCss} from './svg-to-css.ts';
import {visibleAt} from './reveal.ts';
import {BOX_PAD_X, BOX_PAD_Y} from './layout-util.ts';
import type {LaidOutGroup} from './types/containers.ts';
import type {Theme, Align, EmphasisTone, Rect, Roles} from './types/core.ts';
import type {LaidOutDiagram, LaidOutBand} from './types/index.ts';
import type {LaidOutTable} from './types/sequence-table-swimlane.ts';
import type {LaidOutBox, LaidOutBanner, LaidOutCaption, WrappedRun, Span} from './types/text-bands.ts';

import {must} from './must.ts';
// like SVG text, runs of white space are one space (XML white space only: U+3000 and NBSP are characters, not white space)
const collapse = (s: string): string => s.replace(/[ \t\r\n]+/g, ' ');
const esc = (s: string): string => collapse(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c] as string);
const px = (n: number): string => `${+n.toFixed(2)}px`;
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
      const top = o.originY + run.lineYs[i] - ascent;
      const content = run.lineSpans ? spans(run.lineSpans[i], run, color, o.day, o.tones, o.dim) : esc(line).trim();
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

function group(b: LaidOutGroup, day: Theme, tones: ToneEnv, fb: FontBox): string {
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

// What this file draws as HTML. A box with a step badge / icon / tag / stamp carries SVG-only decorations, so it stays SVG as a whole.
function native(b: LaidOutBand): boolean {
  switch (b.type) {
    case 'caption': return !b.tagBox;
    case 'box': return b.step == null && !b.icon && !b.tagBox && !b.stamp;
    case 'banner': return !b.tagBox && !b.stamp;
    case 'group': return !b.stamp;
    // a row's arrows are SVG paths, so only an arrow-less row (and a grid) can go over whole
    case 'table': return true;
    case 'row': return b.arrows.length === 0 && b.children.every(c => native(c));
    case 'grid': return b.children.every(c => native(c));
    default: return false;
  }
}

function render(b: LaidOutBand, day: Theme, tones: ToneEnv, fb: FontBox, roles: Roles, stage?: number): string {
  switch (b.type) {
    case 'table': return table(b, day, tones, fb, roles);
    case 'row': case 'grid': return b.children.filter(c => visibleAt(c, stage)).map(c => box(c, day, tones, fb)).join('');
    case 'caption': return caption(b, day, tones, fb);
    case 'box': return box(b, day, tones, fb);
    case 'banner': return banner(b, day, tones, fb);
    case 'group': return group(b, day, tones, fb);
    default: return '';
  }
}

// Every <text> the SVG emitter writes has the same few attributes (x, y = baseline, text-anchor, class, font-size, font-weight, fill) and
// at most <tspan>s for an emoji or a bold / coloured piece, so the text of any part can become the same absolutely placed line the native
// bands use. The shapes (lines, arrowheads, curves) stay SVG; the words are HTML, selectable and searchable.
const attrOf = (attrs: string, name: string): string | undefined => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];

function textsToHtml(fb: FontBox, svg: string): {svg: string; html: string} {
  const out: string[] = [];
  const rest = svg.replace(/[ \t]*<text\b([^>]*)>([\s\S]*?)<\/text>\n?/g, (_m, attrs: string, inner: string) => {
    const size = Number(attrOf(attrs, 'font-size') ?? 16), weight = Number(attrOf(attrs, 'font-weight') ?? 400);
    const mono = attrOf(attrs, 'class') === 'mono', anchor = attrOf(attrs, 'text-anchor');
    const {ascent, descent} = fb(size, weight, mono);
    // SVG collapses runs of white space (and the line break after a tag); white-space: pre would keep them
    const content = inner.replace(/[ \t\r\n]+/g, ' ')
      .replace(/<tspan class="emoji">/g, '<span class="sd-e">')
      .replace(/<tspan font-weight="(\d+)"(?: fill="([^"]+)")?>/g, (_t, w: string, f?: string) => `<span style="font-weight:${w}${f ? `;color:${f}` : ''}">`)
      .replace(/<tspan fill="([^"]+)">/g, (_t, f: string) => `<span style="color:${f}">`)
      .replace(/<\/tspan>/g, '</span>');
    const cls = `sd-t${mono ? ' sd-m' : ''}${anchor === 'middle' ? ' sd-am' : anchor === 'end' ? ' sd-ae' : ''}`;
    out.push(`<div class="${cls}" style="left:${px(Number(attrOf(attrs, 'x')))};top:${px(Number(attrOf(attrs, 'y')) - ascent)};font-size:${size}px;font-weight:${weight};line-height:${ascent + descent}px;color:${attrOf(attrs, 'fill') ?? PALETTE.text}">${content}</div>`);
    return '';
  });
  return {svg: rest, html: out.join('')};
}

const CSS = (id: string, transparent = false) => `
#${id} { position: relative; overflow: hidden; background: ${transparent ? 'transparent' : PALETTE.bg}; font-family: ${FONT_STACKS.sans}; }
#${id} .sd-b { position: absolute; box-sizing: border-box; border-radius: 9.25px; }
#${id} .sd-t { position: absolute; white-space: pre; }
#${id} .sd-m { font-family: ${FONT_STACKS.mono}; }
#${id} .sd-tbl { position: absolute; overflow: hidden; border-radius: 8px; }
#${id} .sd-tbl table { border-collapse: collapse; table-layout: fixed; }
#${id} .sd-tbl th, #${id} .sd-tbl td { position: relative; padding: 0; margin: 0; font-weight: 400; text-align: left; vertical-align: top; }
#${id} .sd-tb { position: absolute; border-radius: 8px 8px 0 0; }
#${id} .sd-s { position: absolute; box-sizing: border-box; }
#${id} .sd-g { position: absolute; left: 0; top: 0; width: 0; height: 0; overflow: visible; }
#${id} .sd-ov { position: absolute; left: 0; top: 0; pointer-events: none; }
#${id} .sd-am { transform: translateX(-50%); }
#${id} .sd-ae { transform: translateX(-100%); }
#${id} .sd-e { font-family: ${FONT_STACKS.emoji}; }
#${id} .sd-ov text { font-family: ${FONT_STACKS.sans}; }
#${id} .sd-ov .mono { font-family: ${FONT_STACKS.mono}; }
#${id} .sd-ov .emoji { font-family: ${FONT_STACKS.emoji}; }`;

/** A self-contained HTML fragment (a <div> and a <style>) for the diagram. `id` scopes the CSS (default: a hash of the content, so the same figure always gets the same id and two figures do not share one). */
export function emitHtml(d: LaidOutDiagram, opts: {reveal?: number; id?: string; fontBox: FontBox}): string {
  return emitHtmlWith(d, toneEnv(d.tones), opts);
}
// the inner emitSvg calls share d.tones, so they resolve the same env (toneEnv caches it by the overrides object)
function emitHtmlWith(d: LaidOutDiagram, tones: ToneEnv, opts: {reveal?: number; id?: string; fontBox: FontBox}): string {
  const {width, canvasHeight, day} = d, fb = opts.fontBox;
  const visible = d.laidOut.filter(b => visibleAt(b, opts.reveal));
  // The SVG draws the bands in order and the connectors on top; so does this: consecutive bands of one kind (drawn as HTML, as the SVG
  // of the emitter, or as the author's own raw SVG) are one piece, and the pieces go out in the order of the layout.
  const strip = (svg: string, cls: string) => svg
    .replace(/<rect x="0" y="0" width="\d+(?:\.\d+)?" height="\d+(?:\.\d+)?" fill="#[0-9a-f]{6}"\/>\s*/i, '')
    .replace(/<svg /, `<svg class="${cls}" `)
    .replace(/<style>[\s\S]*?<\/style>\s*/, '')
    .replace(/<metadata[\s\S]*?<\/metadata>\s*/, '').trim();
  // the shapes of a part stay SVG (as CSS where it can), its words are HTML; raw() is the author's SVG and stays whole
  const overlay = (bands: LaidOutBand[], connects: LaidOutDiagram['connects']): string => {
    const t = textsToHtml(fb, strip(emitSvg({...d, laidOut: bands, connects}, {reveal: opts.reveal, noRecolor: true}), 'sd-ov'));
    return shapesToCss(t.svg, 'sd-ov') + t.html;
  };
  // raw() is the author's SVG and wordart() is SVG-only art (outlines, turns, gradients, vertical glyphs: none of it is a CSS box): both stay whole
  const kindOf = (b: LaidOutBand) => native(b) ? 'html' : b.type === 'raw' || b.type === 'wordart' ? 'raw' : 'svg';
  let body = '';
  for (let i = 0; i < visible.length;) {
    const kind = kindOf(must(visible[i]));
    let j = i;
    while (j < visible.length && kindOf(must(visible[j])) === kind) j++;
    const run = visible.slice(i, j);
    if (kind === 'html') body += run.map(b => render(b, day, tones, fb, d.roles, opts.reveal)).join('');
    else if (kind === 'raw') body += strip(emitSvg({...d, laidOut: run, connects: []}, {reveal: opts.reveal, noRecolor: true}), 'sd-ov sd-raw');
    else body += overlay(run, []);
    i = j;
  }
  if (d.connects.some(c => visibleAt(c, opts.reveal))) body += overlay([], d.connects);
  const id = opts.id ?? `sd-${createHash('sha1').update(JSON.stringify([width, canvasHeight, d.transparent ?? false, d.appearance ?? null, body])).digest('hex').slice(0, 8)}`;
  return recolor(tones, `<style>${CSS(id, d.transparent)}\n</style>\n<div id="${id}" class="sd" style="width:${px(width)};height:${px(canvasHeight)}">${body}</div>\n`, d.appearance);
}
