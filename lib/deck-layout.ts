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
}

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

/** The slide's blocks and the figure's place. `figure` is the figure's laid-out size in px, when the slide has one. */
export function planDeckLayout(s: DeckTextIn, figure: {w: number; h: number} | undefined, w: TextWidth): DeckLayout {
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
  return {top, bottom, figure: place, noRoom};
}

/** Every text of the slide that is measured, at its size and weight: for a shell that measures in a batch first. */
export function deckTexts(s: DeckTextIn): {text: string; size: number; bold: boolean}[] {
  return [
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
