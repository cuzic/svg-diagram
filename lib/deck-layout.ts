// Where everything goes on a 16:9 deck slide (ADR 0055, ADR 0056 D2): the heading and lead from the top, the source and callouts from the
// bottom, the figure scaled into what is left. One calculation for the PowerPoint writer (lib/pptx/deck.ts) and the slide SVG
// (lib/present/slide-svg.ts), so a slide shown by `serve` and the same slide in the .pptx sit the same. Pure: the widths come in as a function.
import {wrapText} from './wrap.ts';

/** The slide, in px at 96 dpi: 13.333 × 7.5 in, PowerPoint's 16:9. */
export const SLIDE_W = 1280, SLIDE_H = 720;
export const MARGIN_X = 56;
const TOP = 32, BOTTOM = 28, GAP = 16, FIG_PAD = 6;
/** A figure is never drawn larger than this many times its own size: past it the text looks shouted. */
export const MAX_FIGURE_SCALE = 1.25;
/** The smallest text (pt) a scaled figure may have before the slide is reported as hard to read. */
export const MIN_TEXT_PT = 9;
/** Line pitch as a multiple of the text size. */
export const LINE = 1.3;

/** Sizes in px, colours as RRGGBB. */
export const STYLE = {
  title: {size: 37, bold: true, color: '1F2328'},
  lead: {size: 19, bold: false, color: '5B6370'},
  callout: {size: 16, bold: false, color: '3A4A5A', strong: '1A2A3A', fill: 'EEF4FB', bar: '1F5FA8', padX: 16, padY: 8},
  source: {size: 13, bold: false, color: '6B7280'},
} as const;

/** The width of `text` in px at `size` px, bold or not, in the font the slide is measured with. */
export type TextWidth = (text: string, size: number, bold: boolean) => number;
export interface DeckCalloutIn {label?: string; text: string}
export interface DeckTextIn {title?: string; lead?: string; callouts?: readonly DeckCalloutIn[]; source?: string}
/** A column to place (ADR 0058): a figure (its laid-out size) or text, under an optional caption; `width` its share of the row. */
export interface ColumnIn {caption?: string; figure?: {w: number; h: number}; text?: string; width?: number}
/** Where a column's parts go: its caption, and its figure or its text (one block per paragraph); `noRoom` when its content does not fit. */
export interface ColumnPlace {x: number; width: number; caption: TextBlock | null; figure: FigurePlace | null; text: TextBlock[]; noRoom: boolean}

export interface Run {text: string; bold: boolean; color: string}
/** A text box: lines of runs, each line `pitch` px below the last, inside an inset. */
export interface TextBlock {kind: 'text'; name: string; x: number; y: number; width: number; size: number; pitch: number; lines: Run[][]; inset: {x: number; y: number}}
export interface RectBlock {kind: 'rect'; name: string; x: number; y: number; w: number; h: number; fill: string}
export type Block = TextBlock | RectBlock;
export interface FigurePlace {x: number; y: number; w: number; h: number; k: number}

export interface DeckLayout {
  /** The heading and lead, in that order. */
  top: TextBlock[];
  /** The source and then each callout from the last up, each as the blocks it is made of (a callout: its box, its bar, its text). */
  bottom: Block[][];
  /** Where the figure goes, when there is one and it has room. */
  figure: FigurePlace | null;
  /** The slide's text leaves the figure no room, or (without a figure) the text from the top runs into the text from the bottom. */
  noRoom: boolean;
  /** The columns, when the slide has them (ADR 0058). */
  columns: ColumnPlace[];
}

/** Between two columns, px. */
export const COLUMN_GAP = 24;
const CAPTION = {size: 16, bold: true, color: '1F2328'} as const;
const BULLET = /^(?:・|- )/;

/** `text` wrapped to `width` px. */
function wrapped(text: string, size: number, width: number, w: TextWidth, bold: boolean): string[] {
  return wrapText(text, {maxWidth: width, atomWidth: a => w(a, size, bold), mode: 'phrase'});
}

/** A callout's text split into lines, each line's runs: the label's characters plain, the rest bold. */
function calloutLines(c: DeckCalloutIn, width: number, w: TextWidth): Run[][] {
  const st = STYLE.callout, label = c.label ?? '', all = label + c.text;
  let at = 0;
  return wrapped(all, st.size, width, w, true).map(line => {
    const start = Math.max(at, all.indexOf(line, at));
    at = start + line.length;
    const cut = Math.min(line.length, Math.max(0, label.length - start));
    return [
      ...(cut > 0 ? [{text: line.slice(0, cut), bold: false, color: st.color}] : []),
      ...(cut < line.length ? [{text: line.slice(cut), bold: true, color: st.strong}] : []),
    ];
  });
}

const textBlock = (name: string, x: number, y: number, width: number, size: number, lines: Run[][], inset = {x: 0, y: 0}): TextBlock =>
  ({kind: 'text', name, x, y, width, size, pitch: Math.round(size * LINE), lines, inset});

/**
 * The slide's blocks and the figure's place. `figure` is the figure's laid-out size in px, when the slide has one. `columns` (ADR 0058) share
 * the room the figure would have, side by side; `scale` 'same' puts every column figure at one scale.
 */
export function planDeckLayout(s: DeckTextIn, figure: {w: number; h: number} | undefined, w: TextWidth, columns?: readonly ColumnIn[], scale: 'each' | 'same' = 'each'): DeckLayout {
  const width = SLIDE_W - 2 * MARGIN_X;
  const top: TextBlock[] = [], bottom: Block[][] = [];
  let y = TOP;
  if (s.title) {
    const st = STYLE.title, lines = wrapped(s.title, st.size, width, w, st.bold);
    top.push(textBlock('title', MARGIN_X, y, width, st.size, lines.map(t => [{text: t, bold: st.bold, color: st.color}])));
    y += lines.length * Math.round(st.size * LINE) + 6;
  }
  if (s.lead) {
    const st = STYLE.lead, lines = wrapped(s.lead, st.size, width, w, st.bold);
    top.push(textBlock('lead', MARGIN_X, y, width, st.size, lines.map(t => [{text: t, bold: false, color: st.color}])));
    y += lines.length * Math.round(st.size * LINE);
  }
  let low = SLIDE_H - BOTTOM;
  if (s.source) {
    const st = STYLE.source, lines = wrapped(s.source, st.size, width, w, false), h = lines.length * Math.round(st.size * LINE);
    low -= h;
    bottom.push([textBlock('source', MARGIN_X, low, width, st.size, lines.map(t => [{text: t, bold: false, color: st.color}]))]);
    low -= 10;
  }
  for (const c of [...(s.callouts ?? [])].reverse()) {
    const st = STYLE.callout, lines = calloutLines(c, width - 4 - 2 * st.padX, w);
    const h = lines.length * Math.round(st.size * LINE) + 2 * st.padY;
    low -= h;
    bottom.push([
      {kind: 'rect', name: 'callout box', x: MARGIN_X, y: low, w: width, h, fill: st.fill},
      {kind: 'rect', name: 'callout bar', x: MARGIN_X, y: low, w: 4, h, fill: st.bar},
      textBlock(c.label ? `callout: ${c.label}` : 'callout', MARGIN_X + 4, low, width - 4, st.size, lines, {x: st.padX, y: st.padY}),
    ]);
    low -= 10;
  }
  let place: FigurePlace | null = null, noRoom = false;
  if (columns?.length) {
    const roomTop = y + (s.title || s.lead ? GAP : 0) + FIG_PAD, roomH = low - (bottom.length ? GAP - 10 : 0) - roomTop - FIG_PAD;
    return {top, bottom, figure: null, noRoom: roomH < 48, columns: planColumns(columns, roomTop, roomH, w, scale)};
  }
  if (figure) {
    // FIG_PAD on each side: a figure's ink may reach a few px past its laid-out size (a shadow, a label's overhang)
    const roomTop = y + (s.title || s.lead ? GAP : 0) + FIG_PAD, roomH = low - (bottom.length ? GAP - 10 : 0) - roomTop - FIG_PAD;
    const k = Math.min(width / figure.w, roomH / figure.h, MAX_FIGURE_SCALE);
    if (!(k > 0) || roomH < 48) noRoom = true;
    else {
      const fw = figure.w * k, fh = figure.h * k;
      place = {x: MARGIN_X + (width - fw) / 2, y: roomTop + (roomH - fh) / 2, w: fw, h: fh, k};
    }
  } else if (y > low + 10) noRoom = true;
  return {top, bottom, figure: place, noRoom, columns: []};
}

/** Each column's width in px: the row (the slide less its margins and the gaps) shared by the columns' `width`. */
export function columnWidths(columns: readonly {width?: number}[]): number[] {
  const shares = columns.map(c => c.width ?? 1), total = shares.reduce((a, b) => a + b, 0);
  const inner = SLIDE_W - 2 * MARGIN_X - COLUMN_GAP * (columns.length - 1);
  return shares.map(share => inner * share / total);
}

/** The scale a column figure laid out at its column's width is drawn at: 14 px text comes out at 9 pt (ADR 0059). */
export const COLUMN_FIGURE_SCALE = 0.86;
/** The width a spec figure with no `width` of its own is laid out at in a column `px` wide (ADR 0059), within the spec's range. */
export const columnLayoutWidth = (px: number, range: {min: number; max: number}): number => Math.max(range.min, Math.min(range.max, Math.round(px / COLUMN_FIGURE_SCALE)));

/** The columns side by side in the room (top, height) the slide's text leaves. */
function planColumns(columns: readonly ColumnIn[], top: number, height: number, w: TextWidth, scale: 'each' | 'same'): ColumnPlace[] {
  const widths = columnWidths(columns);
  let x = MARGIN_X;
  const cols = columns.map((c, j) => {
    const width = widths[j] ?? 0, at = x;
    x += width + COLUMN_GAP;
    const lines = c.caption ? wrapped(c.caption, CAPTION.size, width, w, CAPTION.bold) : [];
    return {c, x: at, width, caption: lines.length ? textBlock('column caption', at, top, width, CAPTION.size, lines.map(t => [{text: t, bold: true, color: CAPTION.color}])) : null};
  });
  // the contents start on one line across the columns (under the tallest caption), so a figure is compared with its neighbour from the top
  const captionH = Math.max(0, ...cols.map(k => k.caption ? k.caption.lines.length * k.caption.pitch + 6 : 0));
  const contentTop = top + captionH, contentH = height - captionH;
  const fits = cols.map(k => k.c.figure ? Math.min(k.width / k.c.figure.w, contentH / k.c.figure.h, MAX_FIGURE_SCALE) : 0);
  const common = Math.min(...fits.filter((_, j) => cols[j]?.c.figure));
  return cols.map((k, j): ColumnPlace => {
    if (k.c.figure) {
      const kk = scale === 'same' ? common : fits[j] ?? 0;
      if (!(kk > 0) || contentH < 48) return {x: k.x, width: k.width, caption: k.caption, figure: null, text: [], noRoom: true};
      const fw = k.c.figure.w * kk, fh = k.c.figure.h * kk;
      return {x: k.x, width: k.width, caption: k.caption, figure: {x: k.x + (k.width - fw) / 2, y: contentTop, w: fw, h: fh, k: kk}, text: [], noRoom: false};
    }
    // text: a paragraph a line of the input; a bullet's following lines hang under its text, not under the bullet
    const st = STYLE.lead, pitch = Math.round(st.size * LINE), blocks: TextBlock[] = [];
    let yy = contentTop;
    for (const para of (k.c.text ?? '').split(/\r\n|\r|\n/)) {
      if (!para.trim()) { yy += Math.round(pitch / 2); continue; }
      const bullet = BULLET.exec(para), body = bullet ? para.slice(bullet[0].length).trimStart() : para;
      const indent = bullet ? w('・', st.size, false) : 0;
      const lines = wrapped(body, st.size, k.width - indent, w, false);
      if (bullet) blocks.push(textBlock('column bullet', k.x, yy, indent, st.size, [[{text: '・', bold: false, color: '1F2328'}]]));
      blocks.push(textBlock('column text', k.x + indent, yy, k.width - indent, st.size, lines.map(t => [{text: t, bold: false, color: '1F2328'}])));
      yy += lines.length * pitch + 4;
    }
    return {x: k.x, width: k.width, caption: k.caption, figure: null, text: blocks, noRoom: yy - 4 > contentTop + contentH};
  });
}

/** Every text of the slide that is measured, at its size and weight: for a shell that measures in a batch first. */
export function deckTexts(s: DeckTextIn & {columns?: readonly {caption?: string; text?: string}[]}): {text: string; size: number; bold: boolean}[] {
  return [
    ...(s.columns ?? []).flatMap(c => [
      ...(c.caption ? [{text: c.caption, size: CAPTION.size, bold: CAPTION.bold}] : []),
      ...(c.text ? [{text: c.text.replace(/\r\n|\r|\n/g, ' '), size: STYLE.lead.size, bold: false}, {text: '・', size: STYLE.lead.size, bold: false}] : []),
    ]),
    ...(s.title ? [{text: s.title, size: STYLE.title.size, bold: STYLE.title.bold}] : []),
    ...(s.lead ? [{text: s.lead, size: STYLE.lead.size, bold: false}] : []),
    ...(s.source ? [{text: s.source, size: STYLE.source.size, bold: false}] : []),
    ...(s.callouts ?? []).map(c => ({text: (c.label ?? '') + c.text, size: STYLE.callout.size, bold: true})),
  ];
}

/** Why a slide could not be made, for a slide with or without a figure. */
export const roomMessage = (hasFigure: boolean): string => hasFigure
  ? 'the heading, lead, callouts and source leave no room for the figure: shorten them, or put the figure on a slide of its own'
  : 'the heading and lead run into the callouts and source: shorten them, or split the slide';

/** A warning for a slide whose figure's smallest text is under MIN_TEXT_PT, or null. */
export function smallTextWarning(p: {scale: number | null; minTextPt: number | null}): string | null {
  if (p.minTextPt === null || p.scale === null || p.minTextPt >= MIN_TEXT_PT) return null;
  const how = p.scale < 1 ? `scaled to ${Math.round(p.scale * 100)}% to fit the slide, its` : 'its';
  return `${how} smallest text is ${p.minTextPt.toFixed(1)}pt (under ${MIN_TEXT_PT}pt): split the figure, or move text off the slide`;
}
