// Serializes a layoutDiagram() result into an HTML fragment: boxes, banners, group frames and every line of text are
// absolutely positioned elements styled by CSS; everything CSS cannot draw (connectors, arrowheads, tables, curves, wireframes …)
// is the SVG emit.ts already makes, laid over the same canvas in one inline <svg class="sd-ov">.
//
// Same geometry as the SVG: layout.ts has already broken every text into lines and placed each baseline, so a line is one element
// with white-space: pre — the browser never re-wraps it. A line's top is its baseline minus the font's ascent (its line-height is
// ascent + descent), which is how the baseline lands where the <text> of the SVG puts it.
import {PALETTE, FONT_STACKS, ROLES, runColorOf, textColorOf, isSolidTone, colorOf, toneStyle, recolor} from './tokens.ts';
import {textBox} from './font-metrics.ts';
import {emitSvg, resolveBoxStyle} from './emit.ts';
import {shapesToCss} from './svg-to-css.ts';
import {visibleAt} from './reveal.ts';
import {BOX_PAD_X, BOX_PAD_Y} from './layout.ts';
import type {LaidOutTable, LaidOutDiagram, LaidOutBand, LaidOutBox, LaidOutBanner, LaidOutCaption, LaidOutGroup, WrappedRun, Theme, Align, EmphasisTone, Rect, Span} from './types.ts';

// like SVG text, runs of white space are one space
const collapse = (s: string): string => s.replace(/\s+/g, ' ');
const esc = (s: string): string => collapse(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c] as string);
const px = (n: number): string => `${+n.toFixed(2)}px`;
// emit.ts snaps shapes (not text) to a 4px grid; the same here, so a box sits where its SVG twin does
const snap4 = (n: number): number => Math.round(n / 4) * 4;

// ascent / descent of the primary sans font at a size (a browser without that font falls back; the difference is a pixel or two)
const boxMemo = new Map<string, {ascent: number; descent: number}>();
function metrics(size: number, weight: number, mono: boolean): {ascent: number; descent: number} {
  const key = `${mono}|${size}|${weight}`;
  let m = boxMemo.get(key);
  if (!m) {
    try { const b = textBox('あ', mono ? 'mono' : 'sans', size, weight); m = {ascent: b.ascent, descent: b.descent}; }
    catch { m = {ascent: Math.round(size * 0.88), descent: Math.round(size * 0.24)}; }
    boxMemo.set(key, m);
  }
  return m;
}

function spans(sp: Span[], run: WrappedRun, color: string, day: Theme, dim?: boolean): string {
  return sp.map(s => {
    const fill = !dim && s.tone ? runColorOf(s.tone, undefined, day) : color;
    const style = `${s.bold && run.weight !== 700 ? 'font-weight:700;' : ''}${fill !== color ? `color:${fill};` : ''}`;
    return style ? `<span style="${style}">${esc(s.text)}</span>` : esc(s.text);
  }).join('');
}

function textRuns(runs: WrappedRun[], o: {originX: number; originY: number; w: number; align: Align; day: Theme; dim?: boolean; boxTone?: EmphasisTone}): string {
  const out: string[] = [];
  for (const run of runs) {
    const color = o.dim ? PALETTE.muted : runColorOf(run.tone, o.boxTone, o.day);
    const indent = run.indent ?? 0;
    const {ascent, descent} = metrics(run.size, run.weight, run.mono);
    run.lines.forEach((line, i) => {
      const top = o.originY + run.lineYs[i] - ascent;
      const content = run.lineSpans ? spans(run.lineSpans[i], run, color, o.day, o.dim) : esc(line).trim();
      out.push(`<div class="sd-t${run.mono ? ' sd-m' : ''}" style="left:${px(o.originX + indent)};top:${px(top)};width:${px(o.w - indent)};text-align:${o.align};font-size:${run.size}px;font-weight:${run.weight};line-height:${ascent + descent}px;color:${color}">${content}</div>`);
    });
  }
  return out.join('');
}

function shape(r: Rect, o: {tone?: EmphasisTone; dashed?: boolean; dim?: boolean}, day: Theme, fallbackTone: EmphasisTone): string {
  const st = resolveBoxStyle(o.tone ?? fallbackTone, day, o.dashed);
  let {fill, stroke} = st;
  let line = st.dashed ? 'dashed' : 'solid';
  if (o.dim) { fill = PALETTE.bg; stroke = PALETTE.muted; line = 'dotted'; }
  // The SVG strokes 2.5px centred on the edge: the outer edge is 1.25px out, the outer radius 8 + 1.25. A CSS border is rounded to
  // whole device pixels (2.5px draws as 2px), so a solid outline is an inset box-shadow, which is not; a dashed one has to be a border.
  const outline = line === 'solid' ? `box-shadow:inset 0 0 0 2.5px ${stroke}` : `border:2.5px ${line} ${stroke}`;
  return `<div class="sd-b" style="left:${px(snap4(r.x) - 1.25)};top:${px(snap4(r.y) - 1.25)};width:${px(snap4(r.w) + 2.5)};height:${px(snap4(r.h) + 2.5)};background:${fill};${outline}"></div>`;
}

function box(b: LaidOutBox, day: Theme): string {
  const px_ = b.padX ?? BOX_PAD_X, py = b.padY ?? BOX_PAD_Y;
  return shape(b, b, day, 'plain') + textRuns(b.wrappedRuns, {originX: b.x + px_, originY: b.y + py, w: b.w - 2 * px_, align: b.align ?? 'left', day, dim: b.dim, boxTone: b.tone});
}

function banner(b: LaidOutBanner, day: Theme): string {
  const px_ = b.padX ?? BOX_PAD_X, py = b.padY ?? BOX_PAD_Y;
  return shape(b, b, day, 'accent') + textRuns(b.wrappedRuns, {originX: b.x + px_, originY: b.y + py, w: b.w - 2 * px_, align: b.align ?? 'center', day, dim: b.dim, boxTone: b.tone});
}

function caption(b: LaidOutCaption, day: Theme): string {
  return textRuns(b.wrappedRuns, {originX: b.x, originY: b.y, w: b.w, align: b.align ?? 'center', day, dim: b.dim});
}

function group(b: LaidOutGroup, day: Theme): string {
  return b.frame === false ? '' : shape(b, b, day, 'muted');
}

// One line of text at an absolute spot: `baseline` is where the glyphs sit (as the SVG <text> y would be), relative to the parent.
function lineDiv(o: {left: number; baseline: number; width: number; align: Align; size: number; weight: number; mono: boolean; color: string; html: string}): string {
  const {ascent, descent} = metrics(o.size, o.weight, o.mono);
  return `<div class="sd-t${o.mono ? ' sd-m' : ''}" style="left:${px(o.left)};top:${px(o.baseline - ascent)};width:${px(o.width)};text-align:${o.align};font-size:${o.size}px;font-weight:${o.weight};line-height:${ascent + descent}px;color:${o.color}">${o.html}</div>`;
}

// A real <table> (header cells are <th>, so assistive technology reads rows and columns) with fixed column widths and row heights;
// the text of a cell is pre-broken lines placed over its box. Rounded corners come from a clipping wrapper, the outline from an overlay.
function table(b: LaidOutTable, day: Theme): string {
  const R = 8, LH = 1.4;
  const first = b.rows[0];
  const y0 = first.y, y1 = b.rows[b.rows.length - 1].y + b.rows[b.rows.length - 1].h;
  const firstBody = b.rows.findIndex(r => !r.header);
  const rule = `2px solid ${PALETTE.border}`;
  const cols = b.colW.map(w => `<col style="width:${px(w)}">`).join('');
  const rows = b.rows.map((row, i) => {
    const bg = row.header ? PALETTE[day].soft : row.tone ? resolveBoxStyle(row.tone, day).fill : PALETTE.bg;
    const cells = row.cells.map((c, j) => {
      const tag = row.header ? 'th' : b.rowHeader && j === 0 ? 'th' : 'td';
      const scope = tag === 'th' ? ` scope="${row.header ? 'col' : 'row'}"` : '';
      const heading = b.rowHeader && !row.header && j === 0;
      const left = c.align === 'center' ? 0 : c.align === 'right' ? 0 : 12;
      const right = c.align === 'right' ? 12 : 0;
      // a collapsed border takes half its width out of the cell on each side it has: shift the text back by that much
      const edge = j === 1 && b.rowHeader && i >= firstBody && firstBody >= 0 ? 3 : j > 0 ? 2 : 0;
      const topRule = i > 0 || b.titleBar ? 2 : 0;
      const lines = c.lines.map((l, k) => lineDiv({left: left - edge / 2, baseline: c.top - row.y - topRule / 2 + b.bodySize + k * b.bodySize * LH, width: c.w - left - right, align: c.align, size: b.bodySize, weight: c.bold ? 700 : 400, mono: c.mono, color: textColorOf(c.tone, day), html: esc(l)})).join('');
      const style = heading ? `background:${PALETTE[day].soft};` : '';
      const borderL = edge === 3 ? `border-left:3px solid ${PALETTE.text};` : edge ? `border-left:${rule};` : '';
      return `<${tag}${scope} style="${style}${borderL}">${lines}</${tag}>`;
    }).join('');
    return `<tr style="height:${px(row.h)};background:${bg};${i > 0 || b.titleBar ? `border-top:${rule};` : ''}">${cells}</tr>`;
  }).join('');
  const title = b.titleBar
    ? `<div class="sd-tb" style="left:${px(b.x)};top:${px(b.titleBar.y)};width:${px(b.w)};height:${px(b.titleBar.h)};background:${PALETTE[day].accent}">${b.titleBar.lines.map((l, k) => lineDiv({left: 12, baseline: 8 + ROLES.title + k * ROLES.title * LH, width: b.w - 24, align: 'left', size: ROLES.title, weight: 700, mono: false, color: PALETTE.bg, html: esc(l)})).join('')}</div>`
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

function render(b: LaidOutBand, day: Theme, stage?: number): string {
  switch (b.type) {
    case 'table': return table(b, day);
    case 'row': case 'grid': return b.children.filter(c => visibleAt(c, stage)).map(c => box(c, day)).join('');
    case 'caption': return caption(b, day);
    case 'box': return box(b, day);
    case 'banner': return banner(b, day);
    case 'group': return group(b, day);
    default: return '';
  }
}

// Every <text> the SVG emitter writes has the same few attributes (x, y = baseline, text-anchor, class, font-size, font-weight, fill) and
// at most <tspan>s for an emoji or a bold / coloured piece, so the text of any part can become the same absolutely placed line the native
// bands use. The shapes (lines, arrowheads, curves) stay SVG; the words are HTML, selectable and searchable.
const attrOf = (attrs: string, name: string): string | undefined => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs)?.[1];

function textsToHtml(svg: string): {svg: string; html: string} {
  const out: string[] = [];
  const rest = svg.replace(/[ \t]*<text\b([^>]*)>([\s\S]*?)<\/text>\n?/g, (_m, attrs: string, inner: string) => {
    const size = Number(attrOf(attrs, 'font-size') ?? 16), weight = Number(attrOf(attrs, 'font-weight') ?? 400);
    const mono = attrOf(attrs, 'class') === 'mono', anchor = attrOf(attrs, 'text-anchor');
    const {ascent, descent} = metrics(size, weight, mono);
    // SVG collapses runs of white space (and the line break after a tag); white-space: pre would keep them
    const content = inner.replace(/\s+/g, ' ')
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

let counter = 0;

/** A self-contained HTML fragment (a <div> and a <style>) for the diagram. `id` scopes the CSS (default: a counter). */
export function emitHtml(d: LaidOutDiagram, opts: {reveal?: number; id?: string} = {}): string {
  const {width, canvasHeight, day} = d;
  const id = opts.id ?? `sd-${++counter}`;
  const visible = d.laidOut.filter(b => visibleAt(b, opts.reveal));
  const html = visible.filter(native).map(b => render(b, day, opts.reveal)).join('');
  // the rest, plus every connector, is the SVG the other emitter draws: same function, minus the white background and the native bands
  // raw() is the author's own SVG (transforms, anything): it stays whole. Every other part keeps its shapes as SVG and gives its words to HTML.
  const strip = (svg: string, cls: string) => svg
    .replace(/<rect x="0" y="0" width="\d+(?:\.\d+)?" height="\d+(?:\.\d+)?" fill="#[0-9a-f]{6}"\/>\s*/i, '')
    .replace(/<svg /, `<svg class="${cls}" `)
    .replace(/<style>[\s\S]*?<\/style>\s*/, '')
    .replace(/<metadata[\s\S]*?<\/metadata>\s*/, '').trim();
  const rest = visible.filter(b => !native(b) && b.type !== 'raw'), raws = visible.filter(b => b.type === 'raw');
  let overlay = '', words = '';
  if (rest.length || d.connects.length) {
    const t = textsToHtml(strip(emitSvg({...d, laidOut: rest}, {reveal: opts.reveal, noRecolor: true}), 'sd-ov'));
    overlay = shapesToCss(t.svg, 'sd-ov'); words = t.html;
  }
  if (raws.length) overlay += strip(emitSvg({...d, laidOut: raws, connects: []}, {reveal: opts.reveal, noRecolor: true}), 'sd-ov sd-raw');
  return recolor(`<style>${CSS(id, d.transparent)}\n</style>\n<div id="${id}" class="sd" style="width:${px(width)};height:${px(canvasHeight)}">${html}${overlay}${words}</div>\n`, d.appearance);
}
