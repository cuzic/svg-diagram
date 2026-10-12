// Vertical-stack layout engine. Top-level bands (caption/box/banner/row/
// grid/spacer/raw/connect) are stacked with an auto-advancing y cursor —
// nothing in this file ever asks a caller for a y coordinate. row() and
// grid() additionally distribute width across their children (by flex
// ratio, or fixed width block-centered) and give every child in the same
// row/grid-row a shared height (the tallest child's own required height),
// matching how every hand-authored diagram in this deck aligns box borders
// across a row.
//
// Two passes: measure every string this diagram uses in ONE Chromium round
// trip (widths are computed structurally first, without needing text
// metrics — flex/grid math is pure arithmetic), then walk bands top-to-
// bottom deriving heights bottom-up (wrapped line count -> block height ->
// row height -> cursor advance) and assigning x/y. connect() bands don't
// consume vertical space; they're resolved in a final pass once every named
// anchor (any box/child with an explicit `id`) has a known rect.

import {splitAtoms, textWidth} from './atoms.ts';
import {wrapAtoms, wrapStyledAtoms} from './wrap.ts';
import {assertSpans} from './rich.ts';
import {collectTextRequests, layoutSequence, layoutTable} from './seq-table.ts';
import {layoutPlane, planeTexts} from './plane.ts';
import {barsTexts, layoutBars} from './bars.ts';
import {dotsTexts, layoutDots, layoutPeople, peopleTexts} from './people.ts';
import {layoutTimeline, timelineTexts} from './timeline.ts';
import {collectTextRequests as wfTextRequests, layoutWireframe, layoutScreens} from './wireframe.ts';
import type {
  DiagramData, Roles, LaidOutDiagram, LaidOutBand, LaidOutConnect, LaidOutGroup, LaidOutLegendItem, LaidOutLane, LaidOutPhase,
  LaidOutSwimlane, LaidOutPyramidLayer, LaidOutRow, RowArrow, Band, CaptionBand, BoxBand, BannerBand, RowBand, GridBand, GroupBand,
  ConnectBand, ConnectRef, Bend, BoxChrome, TextRun, WrappedRun, WidthOf, FontFamily, FontWeight, MeasureRequest, Measured, Point, Rect, Side, Span, TextTone,
} from './types.ts';
import {PALETTE, SHADES, isSolidTone, CONNECT_LABEL_SIZE, TAG_SIZE, blendLuminance, bestTextColor, paintOf} from './tokens.ts';

export const LINE_HEIGHT_EM = 1.4;   // vertical spacing between wrapped lines within one text block
export const BOX_PAD_X = 20;
export const BOX_PAD_Y = 16;
export const BOX_INNER_GAP = 8;      // vertical gap between title/body/note runs within one box

// box({step}) badge geometry — a solid-fill numbered circle sitting on the
// title's own baseline (cy = titleBaselineY - STEP_BADGE_BASELINE_OFFSET,
// matching the offset every hand-authored "① foo" box in this deck already
// used between its badge circle and its own number glyph's baseline).
export const STEP_BADGE_R = 15;
const STEP_BADGE_GAP = 10;
export const STEP_BADGE_BASELINE_OFFSET = 6;
const STEP_INDENT = 2 * STEP_BADGE_R + STEP_BADGE_GAP; // how far the title's first line is pushed right to clear the badge

// box({icon}): an SVG icon drawn ICON_SIZE px square at the box's top-left; every text run is pushed right to clear it.
export const ICON_SIZE = 32;
const ICON_INDENT = ICON_SIZE + 12;
const ICON_H = ICON_SIZE; // the icon is at least this tall, so a one-line box still holds it

type Requests = Map<string, MeasureRequest>;

/** A band after placeBoxLike(): its own fields plus geometry, wrapped text and (maybe) the tag pill. */
type Placed<B> = B & Rect & {wrappedRuns: WrappedRun[]; tagBox?: Rect; inkBox?: Rect};

/** `run` with the pieces of its text attached, when it has any (a plain run stays exactly as it was). */
function withSpans(run: TextRun, spans: Span[] | undefined): TextRun {
  if (!spans) return run;
  assertSpans(run.text, spans, `text "${run.text.slice(0, 20)}"`); // add() takes a band as it is: hand-made spans may not match
  if (run.nowrap) throw new Error(`"${run.text.slice(0, 20)}" cannot have spans: a stat value is one unbroken string`);
  return {...run, spans};
}

function textRuns(band: Band, roles: Roles): TextRun[] {
  switch (band.type) {
    case 'caption':
      return [withSpans({text: band.text, size: roles[band.role ?? 'label'], weight: band.bold ? 700 : 400, mono: !!band.mono, tone: band.tone}, band.spans?.text)];
    case 'banner': {
      const runs: TextRun[] = [withSpans({text: band.headline, size: roles[band.headlineRole ?? 'banner'], weight: 700, mono: false, tone: band.headlineTone}, band.spans?.headline)];
      if (band.sub) runs.push(withSpans({text: band.sub, size: roles.note, weight: 400, mono: false, tone: band.subTone ?? (isSolidTone(band.tone) ? undefined : 'muted')}, band.spans?.sub));
      return runs;
    }
    case 'box': {
      const runs: TextRun[] = [];
      const iconIndent = band.icon ? {indent: ICON_INDENT} : {}; // (spread, so a box without an icon gets no new field)
      if (band.title) runs.push(withSpans({text: band.title, size: roles.title, weight: 700, mono: !!band.titleMono, tone: band.titleTone, indent: band.step != null ? STEP_INDENT : band.icon ? ICON_INDENT : 0}, band.spans?.title));
      if (band.body) runs.push(withSpans({text: band.body, size: roles.body, weight: 400, mono: !!band.bodyMono, tone: band.bodyTone, ...iconIndent}, band.spans?.body));
      if (band.lines) for (const l of band.lines) {
        const line: Exclude<typeof l, string> = typeof l === 'string' ? {text: l} : l;
        runs.push(withSpans({text: line.text, size: roles[line.role ?? 'body'], weight: line.bold ? 700 : 400, mono: !!line.mono, tone: line.tone, nowrap: band.statValue === line.text && runs.length === 0, ...iconIndent}, line.spans));
      }
      if (band.note) runs.push(withSpans({text: band.note, size: roles.note, weight: 400, mono: false, tone: band.noteTone ?? (isSolidTone(band.tone) ? undefined : 'muted'), ...iconIndent}, band.spans?.note));
      return runs;
    }
    default:
      return [];
  }
}

/** An atom of a run's text with the weight (and tone) it is drawn in; `glue`: it continues the atom before it (see wrapStyledAtoms). */
export interface StyledAtom {text: string; weight: FontWeight; tone?: TextTone; glue?: boolean}

/**
 * The atoms of a run, each with its own weight: the ONE place a run is cut up for measuring, wrapping and the width of a line,
 * so what is registered is what is looked up. The plain text is cut as ever (splitAtoms); an atom that a span boundary falls
 * inside ('API' | 's') is cut there into pieces, each continuing the one before it, so it is measured per piece but never
 * broken between lines.
 */
export function styledAtoms(run: TextRun): StyledAtom[] {
  const atoms = splitAtoms(run.text);
  if (!run.spans) return atoms.map(text => ({text, weight: run.weight}));
  const spanAt: number[] = [];
  run.spans.forEach((sp, i) => { for (let k = 0; k < sp.text.length; k++) spanAt.push(i); });
  const out: StyledAtom[] = [];
  let at = 0;
  for (const atom of atoms) {
    for (let from = 0, to = 1; from < atom.length; from = to, to = from + 1) {
      const i = spanAt[at + from];
      while (to < atom.length && spanAt[at + to] === i) to++;
      const sp = run.spans[i];
      out.push({text: atom.slice(from, to), weight: sp.bold ? 700 : run.weight, tone: sp.tone, ...(from > 0 ? {glue: true} : {})});
    }
    at += atom.length;
  }
  return out;
}

/** The pieces of one wrapped line (neighbouring atoms of one weight and tone make one span). */
function lineSpans(run: TextRun, atoms: StyledAtom[]): Span[] {
  const out: Span[] = [];
  for (const a of atoms) {
    const bold = a.weight !== run.weight, last = out[out.length - 1];
    if (last && !!last.bold === bold && last.tone === a.tone) last.text += a.text;
    else out.push({text: a.text, ...(bold ? {bold: true} : {}), ...(a.tone ? {tone: a.tone} : {})});
  }
  return out;
}

/** Width of line `i` of a wrapped run: its atoms' widths added (the pieces of a line with spans, each in its own weight). */
function lineWidth(widthOf: WidthOf, run: WrappedRun, i: number): number {
  const font = run.mono ? 'mono' : 'sans';
  return run.lineSpans
    ? run.lineSpans[i].reduce((w, sp) => w + textWidth(widthOf, sp.text, run.size, sp.bold ? 700 : run.weight, font), 0)
    : textWidth(widthOf, run.lines[i], run.size, run.weight, font);
}

// Registers every atom this band's text runs need, at the given wrap width,
// into `requests` (for the single batched measureAll call) — width doesn't
// affect *what* needs measuring (that's per-atom, not per-line), so this can
// run before measurement even for row/grid children whose width was just
// computed structurally.
const TAG_H = 24, TAG_PAD_X = 8;
const STAMP_H = 24, STAMP_GAP = 6, STAMP_PAD_X = 6; // the stamp chip and the strip reserved for it under the content
export const stampChipW = (widthOf: WidthOf, text: string, roles: Roles): number => textWidth(widthOf, text, roles.note, 400) + 2 * STAMP_PAD_X;
export const LEGEND_SWATCH_W = 36, LEGEND_ITEM_GAP = 28, LEGEND_ROW_H = 24;

function registerAtoms(requests: Requests, text: string, size: number, weight: number, font: FontFamily = 'sans') {
  for (const atom of splitAtoms(text)) {
    const key = `${atom} ${size} ${weight} ${font}`;
    if (!requests.has(key)) requests.set(key, {text: atom, size, weight, font});
  }
}

// group() title is laid out as a left-aligned bold caption inside the frame.
function groupTitleBand(band: GroupBand): CaptionBand {
  return {type: 'caption', text: band.title as string, ...(band.spans?.title ? {spans: {text: band.spans.title}} : {}), align: band.titleAlign ?? 'left', role: 'title', bold: true, tone: band.titleTone ?? (band.tone === 'accent' ? 'accent' : 'text'), mono: false};
}

function registerRequests(requests: Requests, band: Band, roles: Roles) {
  if ('tag' in band && band.tag) registerAtoms(requests, band.tag, (roles.tag ?? TAG_SIZE), 700);
  if ('stamp' in band && band.stamp) registerAtoms(requests, band.stamp, roles.note, 400);
  for (const run of textRuns(band, roles)) {
    const font = run.mono ? 'mono' : 'sans';
    for (const {text, weight} of styledAtoms(run)) {
      const key = `${text} ${run.size} ${weight} ${font}`;
      if (!requests.has(key)) requests.set(key, {text, size: run.size, weight, font});
    }
  }
}

// Wraps a box-like band's text runs at `wrapWidth` (content width, i.e.
// already excluding BOX_PAD_X*2) and returns {wrappedRuns, textHeight}.
function layoutBoxContent(band: Band, wrapWidth: number, widthOf: WidthOf, roles: Roles): {wrappedRuns: WrappedRun[]; textHeight: number} {
  let relY = 0;
  const wrappedRuns = textRuns(band, roles).map((run): WrappedRun => {
    const font = run.mono ? 'mono' : 'sans';
    const indent = run.indent ?? 0;
    const atomLines = run.nowrap ? null : wrapStyledAtoms(styledAtoms(run), {maxWidth: wrapWidth - indent, atomWidth: a => widthOf(a.text, run.size, a.weight, font)});
    const lines = atomLines ? atomLines.map(l => l.map(a => a.text).join('')) : [run.text];
    const lineYs = lines.map(() => {
      relY += run.size;
      const y = relY;
      relY += run.size * (LINE_HEIGHT_EM - 1);
      return y;
    });
    relY += BOX_INNER_GAP;
    return {...run, lines, lineYs, ...(run.spans && atomLines ? {lineSpans: atomLines.map(l => lineSpans(run, l))} : {})};
  });
  const textHeight = Math.max(0, relY - BOX_INNER_GAP);
  return {wrappedRuns, textHeight};
}

type SlotSizing = {span?: number; col?: number};
/** 1-based column and span of each row child on an N-column grid: `col` defaults to the column after the previous child. */
function colSlots(children: SlotSizing[]): {col: number; span: number}[] {
  let next = 1;
  return children.map(c => { const span = c.span ?? 1, col = c.col ?? next; next = col + span; return {col, span}; });
}

// Structural width distribution for row()/grid() — pure arithmetic, no text
// metrics needed, so this can run in the same pass that registers measure
// requests (a child's wrap width must be known before we know what to wrap).
function rowChildGeometry(band: Pick<RowBand, 'cols' | 'gap' | 'justify' | 'itemWidth'> & {children: {span?: number; col?: number; flex?: number; width?: number; title?: string; id?: string}[]}, contentWidth: number) {
  const n = band.children.length;
  const gap = band.gap;
  if (band.cols) {
    // Shared column grid: every row declaring the same `cols` + `gap` gets
    // identical column edges, so a box spanning columns 1-2 sits exactly
    // above two boxes in columns 1 and 2 of the next row.
    const cw = (contentWidth - (band.cols - 1) * gap) / band.cols;
    let next = 1;
    const widths: number[] = [], xOffsets: number[] = [];
    for (const c of band.children) {
      const span = c.span ?? 1;
      const col = c.col ?? next;
      if (col < 1 || col + span - 1 > band.cols) throw new Error(`row({cols: ${band.cols}}): child "${c.title ?? c.id ?? '(box)'}" at col ${col} span ${span} falls outside the ${band.cols} columns`);
      widths.push(span * cw + (span - 1) * gap);
      xOffsets.push((col - 1) * (cw + gap));
      next = col + span;
    }
    return {widths, xOffsets};
  }
  if (band.justify === 'stretch') {
    const avail = contentWidth - (n - 1) * gap;
    const flexSum = band.children.reduce((s, c) => s + (c.flex ?? 1), 0);
    const widths = band.children.map(c => avail * (c.flex ?? 1) / flexSum);
    const xOffsets: number[] = [];
    let x = 0;
    for (const w of widths) { xOffsets.push(x); x += w + gap; }
    return {widths, xOffsets};
  }
  // fixed-width children, block start- or center-aligned
  const widths = band.children.map(c => c.width ?? band.itemWidth ?? 160);
  const blockWidth = widths.reduce((s, w) => s + w, 0) + (n - 1) * gap;
  const start = band.justify === 'center' ? (contentWidth - blockWidth) / 2 : 0;
  const xOffsets: number[] = [];
  let x = start;
  for (const w of widths) { xOffsets.push(x); x += w + gap; }
  return {widths, xOffsets};
}

function gridChildGeometry(band: GridBand, contentWidth: number) {
  const cols = band.cols;
  const gap = band.gap;
  const cellWidth = (contentWidth - (cols - 1) * gap) / cols;
  return {cellWidth};
}

/**
 * diagram({sourceLine}) is always the last band: left-aligned, muted, note size, whatever was add()ed and in whatever order.
 * Returns a copy (the input is not changed); without a sourceLine, the input itself.
 */
function withSourceLine(d: DiagramData): DiagramData {
  return d.sourceLine === undefined ? d : {...d, bands: [...d.bands, {type: 'caption', text: d.sourceLine, align: 'left', role: 'note', tone: 'muted', bold: false, mono: false, sourceLine: true}]};
}

/** Pass 1: every atom this diagram needs measured, at the font sizes of `roles`. Pure: no measuring happens here. */
export function collectMeasures(data: DiagramData, roles: Roles): Requests {
  const d = withSourceLine(data);
  const requests: Requests = new Map();
  const registerBand = (band: Band): void => {
    if (band.type === 'group') {
      if (band.stamp) registerAtoms(requests, band.stamp, roles.note, 400);
      if (band.title) registerRequests(requests, groupTitleBand(band), roles);
      for (const child of band.children) registerBand(child);
    } else if (band.type === 'swimlane') {
      for (const l of band.lanes) registerAtoms(requests, l.label, roles.title, 700);
      for (const p of band.phases ?? []) registerAtoms(requests, p.label, roles.note, 700);
      for (const st of band.steps) registerRequests(requests, st, roles);
    } else if (band.type === 'sequence' || band.type === 'table') {
      for (const [text, size, weight, font] of collectTextRequests(band, roles)) registerAtoms(requests, text, size, weight, font);
    } else if (band.type === 'wireframe' || band.type === 'screens') {
      for (const [text, size, weight, font] of wfTextRequests(band)) registerAtoms(requests, text, size, weight, font);
    } else if (band.type === 'legend') {
      for (const item of band.items) registerAtoms(requests, item.label, roles.note, 400);
    } else if (band.type === 'grouprow') {
      for (const child of band.children) registerBand(child);
    } else if (band.type === 'row') {
      for (const child of band.children) registerRequests(requests, child, roles);
    } else if (band.type === 'grid') {
      for (const child of band.children) registerRequests(requests, child, roles);
    } else if (band.type === 'connect' && band.label) {
      // connect() labels are single-line, always the 'note' role at plain
      // weight (see emit.ts's renderConnect) — registered here so their
      // real width is known before layoutDiagram resolves the connect,
      // instead of guessed at draw time.
      registerAtoms(requests, band.label, (roles.connectLabel ?? CONNECT_LABEL_SIZE), 400);
    } else if (band.type === 'pyramid') {
      for (const layer of band.layers) {
        for (const atom of splitAtoms(layer.text)) {
          const key = `${atom} ${roles.title} 700 sans`;
          if (!requests.has(key)) requests.set(key, {text: atom, size: roles.title, weight: 700, font: 'sans'});
        }
      }
    } else if (band.type === 'plane') {
      for (const [text, size, weight, font] of planeTexts(band, roles)) registerAtoms(requests, text, size, weight, font);
    } else if (band.type === 'bars') {
      for (const [text, size, weight, font] of barsTexts(band, roles)) registerAtoms(requests, text, size, weight, font);
    } else if (band.type === 'people') {
      for (const [text, size, weight, font] of peopleTexts(band, roles)) registerAtoms(requests, text, size, weight, font);
    } else if (band.type === 'dots') {
      for (const [text, size, weight, font] of dotsTexts(band, roles)) registerAtoms(requests, text, size, weight, font);
    } else if (band.type === 'timeline') {
      for (const [text, size, weight, font] of timelineTexts(band)) registerAtoms(requests, text, size, weight, font);
    } else if (band.type === 'curve') {
      for (const label of [band.yTopLabel, band.yBottomLabel, band.xLabel]) {
        if (!label) continue;
        for (const atom of splitAtoms(label)) {
          const key = `${atom} ${roles.note} 400 sans`;
          if (!requests.has(key)) requests.set(key, {text: atom, size: roles.note, weight: 400, font: 'sans'});
        }
      }
    } else {
      registerRequests(requests, band, roles);
    }
  };
  for (const band of d.bands) registerBand(band);
  return requests;
}

/**
 * The width lookup over what measureAll(collectMeasures(...)) returned. An atom that was never registered measures 0 wide,
 * silently (a line then overflows its box); with `strict` that is an error. The caller reads SVG_DIAGRAM_STRICT_WIDTH
 * (layout itself touches no environment).
 */
export function widthOfMeasured(measured: Map<string, Measured>, strict: boolean): WidthOf {
  return (atom, size, weight, font) => {
    const m = measured.get(`${atom} ${size} ${weight} ${font}`);
    if (m) return m.w;
    if (strict) throw new Error(`layout: "${atom}" (${size}px, ${weight}, ${font}) was not registered for measuring, so its width would be 0 (SVG_DIAGRAM_STRICT_WIDTH is set)`);
    return 0;
  };
}

/** Pass 2, synchronous: lay the diagram out with the widths already measured. */
export function layoutWith(data: DiagramData, roles: Roles, widthOf: WidthOf): LaidOutDiagram {
  const d = withSourceLine(data);
  const contentWidth = d.width - 2 * d.pad;

  // A labelled straight connector between two side-by-side children (right side -> left side) needs room in the gap
  // between them: a label wider than the gap lands on both boxes, or straddles the groups' frame lines. The row's gap grows to fit it.
  // A row on a shared column grid (`cols`) keeps its column edges aligned with the other rows of that grid, so the gap grows for
  // every row declaring the same `cols` + `gap` (the widest need wins), not for the one row that has the label.
  const labelled: ConnectBand[] = [];
  const collectConnects = (bs: Band[]): void => { for (const b of bs) { if (b.type === 'connect' && b.label && b.route === 'straight') labelled.push(b); else if ('children' in b && Array.isArray(b.children)) collectConnects(b.children as Band[]); } };
  collectConnects(d.bands);
  const idsIn = (b: Band, out = new Set<string>()): Set<string> => { const x = b as {id?: string; children?: unknown}; if (x.id) out.add(x.id); if (Array.isArray(x.children)) for (const c of x.children) idsIn(c as Band, out); return out; };
  const LABEL_MARGIN = 6; // clear space between a label and the boxes / frame lines on either side
  const MIN_CHILD_W = 80;
  type RowLike = {gap: number; cols?: number; justify?: string; children: (Band & SlotSizing)[]};
  // the gap one row needs for the labelled connectors between neighbours that sit side by side
  const gapNeeded = (band: RowLike): number => {
    if (!labelled.length) return band.gap;
    const kids = band.children.map(c => idsIn(c));
    const slots = band.cols ? colSlots(band.children) : null;
    let gap = band.gap;
    for (const c of labelled) {
      const f = parseRef(c.from), t = parseRef(c.to);
      const i = kids.findIndex(k => k.has(f.id)), j = kids.findIndex(k => k.has(t.id));
      if (i < 0 || j < 0 || Math.abs(i - j) !== 1 || !((i < j && f.side === 'right' && t.side === 'left') || (i > j && f.side === 'left' && t.side === 'right'))) continue;
      if (slots) { const [a, b] = i < j ? [slots[i], slots[j]] : [slots[j], slots[i]]; if (b.col !== a.col + a.span) continue; } // empty columns between them already leave room
      gap = Math.max(gap, Math.ceil(textWidth(widthOf, c.label as string, (roles.connectLabel ?? CONNECT_LABEL_SIZE), 400) + (c.chip ? 16 : 0) + 2 * LABEL_MARGIN));
    }
    return gap;
  };
  const sharedGaps = new Map<string, number>(); // `${cols}/${gap}` -> the gap every row of that column grid uses (filled just below)
  const gapForLabels = (band: RowLike, cw: number): number => {
    if (band.cols) return sharedGaps.get(`${band.cols}/${band.gap}`) ?? band.gap;
    if (band.justify !== 'stretch' || !labelled.length) return band.gap; // fixed-width rows would overflow the canvas
    const gap = gapNeeded(band);
    const maxGap = band.children.length > 1 ? (cw - band.children.length * MIN_CHILD_W) / (band.children.length - 1) : band.gap;
    return gap <= maxGap ? gap : band.gap; // would squeeze the children: keep the gap (verify reports the label that does not fit)
  };

  {
    const grids = new Map<string, {need: number; rows: {cw: number; spans: number[]}[]}>();
    const walk = (bs: Band[], cw: number): void => {
      for (const b of bs) {
        if (b.type === 'group') walk(b.children, cw - 2 * (b.pad ?? 16));
        else if ((b.type === 'row' || b.type === 'grouprow') && b.cols) {
          const key = `${b.cols}/${b.gap}`, g = grids.get(key) ?? {need: b.gap, rows: []};
          g.need = Math.max(g.need, gapNeeded(b as RowLike));
          g.rows.push({cw, spans: colSlots((b as RowLike).children).map(s => s.span)});
          grids.set(key, g);
          if (b.type === 'grouprow') { // (nested widths use the declared gap: the shared one is not known until every row has been seen)
            const {widths} = rowChildGeometry(b, cw);
            b.children.forEach((c, i) => { if (c.type === 'group') walk(c.children, widths[i] - 2 * (c.pad ?? 16)); });
          }
        } else if (b.type === 'grouprow') {
          const {widths} = rowChildGeometry({...b, gap: gapForLabels(b as RowLike, cw)}, cw); // the same gap the real pass will use
          b.children.forEach((c, i) => { if (c.type === 'group') walk(c.children, widths[i] - 2 * (c.pad ?? 16)); });
        }
      }
    };
    walk(d.bands, contentWidth);
    for (const [key, g] of grids) {
      const [cols, base] = key.split('/').map(Number);
      const width = (cw: number, span: number, gap: number) => span * ((cw - (cols - 1) * gap) / cols) + (span - 1) * gap;
      // growing must not squeeze a box: each child keeps >= 70% of its width (and >= 40px) or the gap stays as declared (verify reports the label)
      const fits = g.need === base || g.rows.every(r => r.spans.every(sp => width(r.cw, sp, g.need) >= Math.min(width(r.cw, sp, base), Math.max(40, 0.7 * width(r.cw, sp, base)))));
      sharedGaps.set(key, fits ? g.need : base);
    }
  }
  // ---- pass 2: layout top-to-bottom ----
  let cursorY = d.pad;
  const laidOut: LaidOutBand[] = [];
  const anchors = new Map<string, Rect>(); // id -> {x,y,w,h}
  const areaIds = new Set<string>();       // ids of rows and row columns: anchors that hold other boxes
  const claimed = (id: string, what: string): never => { throw new Error(`duplicate anchor id "${id}": ${what} — every id (and every row's "id#n" column ids) must be unique`); };
  const connects: LaidOutConnect[] = [];
  const deferred: ConnectBand[] = []; // connect()s that came before the boxes they name

  const placeBoxLike = <B extends CaptionBand | BoxBand | BannerBand>(band: B, x: number, y: number, w: number, isBoxLike: boolean): Placed<B> => {
    const chrome = band as BoxChrome; // caption has no padX / padY / tag / id: they read as undefined (its `tone` is a TextTone, unused here)
    const wrapWidth = isBoxLike ? w - 2 * (chrome.padX ?? BOX_PAD_X) : w;
    const content = layoutBoxContent(band, wrapWidth, widthOf, roles);
    const {wrappedRuns} = content;
    const textHeight = band.type === 'box' && band.icon ? Math.max(content.textHeight, ICON_H) : content.textHeight;
    const stamp = isBoxLike ? chrome.stamp : undefined;
    const stampW = stamp ? stampChipW(widthOf, stamp, roles) : undefined;
    if (stampW !== undefined && stampW > w - 16) throw new Error(`stamp "${stamp}" is wider than its box (${Math.round(w)}px): shorten it or widen the box`);
    const h = (isBoxLike ? textHeight + 2 * (chrome.padY ?? BOX_PAD_Y) : textHeight) + (stamp ? STAMP_H + STAMP_GAP : 0);
    const placed = {...band, x, y, w, h, wrappedRuns} as unknown as Placed<B>; // spreading a generic loses the intersection
    if (stampW !== undefined) (placed as Placed<B> & {stampW?: number}).stampW = stampW;
    if (band.type === 'box') {
      const overflow = wrappedRuns.filter(r => r.nowrap && textWidth(widthOf, r.text, r.size, r.weight, r.mono ? 'mono' : 'sans') > wrapWidth - (r.indent ?? 0) + 0.5).map(r => r.text);
      if (overflow.length) (placed as Placed<BoxBand> & {nowrapOverflow?: string[]}).nowrapOverflow = overflow;
    }
    if (chrome.tag) {
      const tw = textWidth(widthOf, chrome.tag, (roles.tag ?? TAG_SIZE), 700) + 2 * TAG_PAD_X;
      placed.tagBox = {x: chrome.tagAt === undefined ? x + w - tw - 12 : x + w * chrome.tagAt - tw / 2, y: y - TAG_H / 2, w: tw, h: TAG_H};
    }
    if (chrome.id && (areaIds.has(chrome.id) || anchors.has(chrome.id))) claimed(chrome.id, 'a box takes an id that another box, group or row already has');
    if (chrome.id) anchors.set(chrome.id, {x, y, w, h});
    return placed;
  };

  const stack = (bands: Band[], padX: number, cw: number): void => {
  for (const band of bands) {
    if (band.type === 'spacer') { cursorY += band.h; continue; }

    if (band.type === 'group') {
      const gp = band.pad ?? 16;
      const startY = cursorY;
      const frame: LaidOutGroup = {type: 'group', x: padX, y: startY, w: cw, h: 0, tone: band.tone, dashed: band.dashed, frame: band.frame, id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until})};
      laidOut.push(frame); // pushed first so the frame is drawn under its children
      cursorY += gp;
      if (band.title) {
        const t = placeBoxLike({...groupTitleBand(band), reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until})} as CaptionBand, padX + gp, cursorY, cw - 2 * gp, false);
        const inkW = Math.max(0, ...t.wrappedRuns.flatMap(r => r.lines.map((_, i) => lineWidth(widthOf, r, i))));
        const inkX = t.align === 'center' ? t.x + (t.w - inkW) / 2 : t.align === 'right' ? t.x + t.w - inkW : t.x;
        t.inkBox = {x: inkX, y: t.y, w: inkW, h: t.h};
        laidOut.push(t);
        cursorY += t.h + d.gap / 2;
      }
      stack(band.children, padX + gp, cw - 2 * gp);
      cursorY = cursorY - d.gap + gp;
      if (band.stamp) {
        frame.stamp = band.stamp;
        frame.stampW = stampChipW(widthOf, band.stamp, roles);
        if (frame.stampW > cw - 16) throw new Error(`stamp "${band.stamp}" is wider than its group (${Math.round(cw)}px): shorten it or widen the group`);
        cursorY += STAMP_H + STAMP_GAP;
      }
      frame.h = cursorY - startY;
      if (band.id) {
        if (anchors.has(band.id)) claimed(band.id, 'a group takes an id that another box, group or row already has');
        anchors.set(band.id, {x: frame.x, y: frame.y, w: frame.w, h: frame.h});
      }
      cursorY += d.gap;
      continue;
    }

    if (band.type === 'sequence' || band.type === 'table') {
      const placed = band.type === 'sequence' ? layoutSequence(band, padX, cursorY, cw, widthOf, roles) : layoutTable(band, padX, cursorY, cw, widthOf, roles);
      if (band.id) anchors.set(band.id, {x: placed.x, y: placed.y, w: placed.w, h: placed.h});
      laidOut.push(placed);
      cursorY += placed.h + d.gap;
      continue;
    }

    if (band.type === 'timeline') {
      const placed = layoutTimeline(band, padX, cursorY, cw, widthOf);
      if (band.id) {
        if (anchors.has(band.id)) claimed(band.id, 'a timeline takes an id that another anchor already has');
        anchors.set(band.id, {x: placed.x, y: placed.y, w: placed.w, h: placed.h});
      }
      laidOut.push(placed);
      cursorY += placed.h + d.gap;
      continue;
    }

    if (band.type === 'bars') {
      const placed = layoutBars(band, padX, cursorY, cw, widthOf, roles);
      if (band.id) {
        if (anchors.has(band.id)) claimed(band.id, 'a bars band takes an id that another anchor already has');
        anchors.set(band.id, {x: placed.x, y: placed.y, w: placed.w, h: placed.h});
      }
      for (const a of placed.anchors) {
        if (anchors.has(a.id)) claimed(a.id, 'a bar takes an id that another anchor already has');
        anchors.set(a.id, {x: a.x, y: a.y, w: a.w, h: a.h});
      }
      laidOut.push(placed);
      cursorY += placed.h + d.gap;
      continue;
    }

    if (band.type === 'people' || band.type === 'dots') {
      const placed = band.type === 'people' ? layoutPeople(band, padX, cursorY, cw, widthOf, d.day, roles) : layoutDots(band, padX, cursorY, cw, widthOf, d.day, roles);
      if (band.id) {
        if (anchors.has(band.id)) claimed(band.id, `a ${band.type} band takes an id that another anchor already has`);
        anchors.set(band.id, {x: placed.x, y: placed.y, w: placed.w, h: placed.h});
      }
      laidOut.push(placed);
      cursorY += placed.h + d.gap;
      continue;
    }

    if (band.type === 'wireframe' || band.type === 'screens') {
      const placed = band.type === 'wireframe' ? layoutWireframe(band, padX, cursorY, cw, widthOf) : layoutScreens(band, padX, cursorY, cw, widthOf);
      for (const a of placed.anchors) anchors.set(a.id, {x: a.x, y: a.y, w: a.w, h: a.h});
      laidOut.push(placed);
      cursorY += placed.h + d.gap;
      continue;
    }

    if (band.type === 'swimlane') {
      const labelW = band.labelW ?? 128, colGap = band.colGap ?? 28, padY = 14, padX2 = 14;
      const bodyX = padX + labelW, bodyW = cw - labelW;
      const colW = (bodyW - 2 * padX2 - (band.cols - 1) * colGap) / band.cols;
      if (colW < 60) throw new Error(`swimlane(): ${band.cols} columns leave only ${Math.round(colW)}px each — widen the diagram, shrink labelW, or use fewer columns`);
      const startY = cursorY;
      const wrapLines = (text: string, size: number, weight: number, maxW: number) => wrapAtoms(splitAtoms(text), {maxWidth: Math.max(20, maxW), atomWidth: (a: string) => widthOf(a, size, weight, 'sans')});
      // column-group headers across the top
      let phaseH = 0;
      const phases = (band.phases ?? []).map((ph): LaidOutPhase => {
        const x = bodyX + padX2 + (ph.from - 1) * (colW + colGap) - colGap / 2;
        const w = (ph.to - ph.from + 1) * (colW + colGap);
        const lines = wrapLines(ph.label, roles.note, 700, w - 16);
        phaseH = Math.max(phaseH, lines.length * roles.note * LINE_HEIGHT_EM + 16);
        return {x, w, lines};
      });
      // steps first at y=0 (heights depend on wrapping), then lanes get the tallest step
      const stepsPlaced = band.steps.map(st => {
        const x = bodyX + padX2 + (st.col - 1) * (colW + colGap);
        const w = st.span * colW + (st.span - 1) * colGap;
        return placeBoxLike({...st, padX: st.padX ?? 12, padY: st.padY ?? 10}, x, 0, w, true);
      });
      const laneIndex = new Map(band.lanes.map((l, i) => [l.id, i]));
      const rowGap = 12;
      let y = startY + phaseH;
      const lanes = band.lanes.map((lane, i): LaidOutLane => {
        const labelLines = wrapLines(lane.label, roles.title, 700, labelW - 24);
        const labelH = labelLines.length * roles.title * LINE_HEIGHT_EM;
        const mine = stepsPlaced.filter(s => laneIndex.get(s.lane) === i);
        const maxStep = Math.max(0, ...mine.map(s => s.h));
        const rows = 1 + Math.max(0, ...mine.map(s => s.row ?? 0));
        const blockH = rows * maxStep + (rows - 1) * rowGap;
        const h = Math.max(blockH, labelH) + 2 * padY;
        const out = {y, h, labelLines, labelTop: y + (h - labelH) / 2, tone: lane.tone, maxStep, blockTop: y + (h - blockH) / 2};
        y += h;
        return out;
      });
      const frame: LaidOutSwimlane = {type: 'swimlane', x: padX, y: startY, w: cw, h: y - startY, labelW, bodyX, phaseH, phases, lanes, id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until})};
      laidOut.push(frame); // before its steps so the lanes draw underneath
      if (band.id) {
        if (anchors.has(band.id)) claimed(band.id, 'a swimlane takes an id that another anchor already has');
        anchors.set(band.id, {x: frame.x, y: frame.y, w: frame.w, h: frame.h});
      }
      for (const st of stepsPlaced) {
        const ln = lanes[laneIndex.get(st.lane) as number]; // an unknown lane id throws here, as before
        st.y = ln.blockTop + (st.row ?? 0) * (ln.maxStep + rowGap) + (ln.maxStep - st.h) / 2;
        if (st.id) anchors.set(st.id, {x: st.x, y: st.y, w: st.w, h: st.h});
        if (st.tagBox) st.tagBox.y = st.y - st.tagBox.h / 2;
        laidOut.push(st);
      }
      cursorY = y + d.gap;
      continue;
    }

    if (band.type === 'legend') {
      const items = band.items.map(item => {
        const tw = textWidth(widthOf, item.label, roles.note, 400);
        return {...item, textW: tw, w: LEGEND_SWATCH_W + 8 + tw};
      });
      const rows: (typeof items)[] = [[]];
      let rowW = 0;
      for (const it of items) {
        const add = (rows.at(-1)!.length ? LEGEND_ITEM_GAP : 0) + it.w;
        if (rows.at(-1)!.length && rowW + add > cw) { rows.push([]); rowW = 0; }
        rowW += (rows.at(-1)!.length ? LEGEND_ITEM_GAP : 0) + it.w;
        rows.at(-1)!.push(it);
      }
      const placedItems: LaidOutLegendItem[] = [];
      rows.forEach((r, ri) => {
        const total = r.reduce((a, it) => a + it.w, 0) + (r.length - 1) * LEGEND_ITEM_GAP;
        let x = band.align === 'left' ? padX : padX + (cw - total) / 2;
        for (const it of r) { placedItems.push({...it, x, y: cursorY + ri * (LEGEND_ROW_H + 8)}); x += it.w + LEGEND_ITEM_GAP; }
      });
      const h = rows.length * LEGEND_ROW_H + (rows.length - 1) * 8;
      laidOut.push({type: 'legend', x: padX, y: cursorY, w: cw, h, items: placedItems});
      cursorY += h + d.gap;
      continue;
    }

    if (band.type === 'connect') {
      // Resolved immediately (not deferred) so a loop-under route can
      // reserve real vertical space for its dip + label — a zero-height
      // overlay resolved only after the whole stack is laid out would let
      // the return path silently collide with whatever comes next (this
      // was caught by lint-svg.ts's container-overflow check on the first
      // real test: a loop-under label overlapped the following banner).
      // When an anchor is not laid out yet (connect() declared before a box it
      // names) resolution waits until the whole stack is placed; such a
      // connector reserves no loop-under space.
      if (!anchors.has(parseRef(band.from).id) || !anchors.has(parseRef(band.to).id)) { deferred.push(band); continue; }
      const resolved = resolveConnect(band, anchors, areaIds, widthOf, roles);
      connects.push(resolved);
      if (band.route === 'loop-under') {
        const labelClearance = band.label ? 24 : 8;
        cursorY = Math.max(resolved.from.y, resolved.to.y, cursorY) + band.dip + labelClearance;
      }
      continue;
    }

    if (band.type === 'raw') {
      const placed = {...band, x: padX, y: cursorY, w: cw};
      if (band.id) anchors.set(band.id, {x: placed.x, y: placed.y, w: placed.w, h: placed.h});
      laidOut.push(placed);
      cursorY += band.h + (band.h > 0 ? d.gap : 0);
      continue;
    }

    // row({id}): the row itself is an anchor, and so is each of its columns (`id#5`, `id#5-6`; the n-th child on a row without `cols`).
    const registerRowSlots = (id: string | undefined, band: RowLike, rowTop: number, rowHeight: number, padX: number, cw: number, gap: number, placed: Rect[]): void => {
      if (!id) return;
      if (anchors.has(id)) claimed(id, 'a row takes an id that another box, group or row already has');
      anchors.set(id, {x: padX, y: rowTop, w: cw, h: rowHeight});
      areaIds.add(id);
      if (band.cols) {
        const cols = band.cols, colW = (cw - (cols - 1) * gap) / cols;
        for (let a = 1; a <= cols; a++) for (let b = a; b <= cols; b++) {
          const key = b === a ? `${id}#${a}` : `${id}#${a}-${b}`;
          if (anchors.has(key)) claimed(key, 'a row column collides with an existing id');
          anchors.set(key, {x: padX + (a - 1) * (colW + gap), y: rowTop, w: (b - a + 1) * colW + (b - a) * gap, h: rowHeight});
          areaIds.add(key);
        }
      } else {
        const put = (key: string, r: Rect) => { if (anchors.has(key)) claimed(key, 'a row column collides with an existing id'); anchors.set(key, r); areaIds.add(key); };
        placed.forEach((r, i) => put(`${id}#${i + 1}`, {x: r.x, y: rowTop, w: r.w, h: rowHeight}));
        for (let a = 0; a < placed.length; a++) for (let b = a + 1; b < placed.length; b++) put(`${id}#${a + 1}-${b + 1}`, {x: placed[a].x, y: rowTop, w: placed[b].x + placed[b].w - placed[a].x, h: rowHeight});
      }
    };

    if (band.type === 'grouprow') {
      // Each child is laid out as if stacked alone at its own x / width, all starting at the row's top; afterwards every
      // frame / box is stretched to the tallest one (a group's inner content keeps its natural height).
      const rowGap = gapForLabels(band, cw);
      const {widths, xOffsets} = rowChildGeometry({...band, gap: rowGap}, cw);
      const rowTop = cursorY;
      const stretch: ((h: number) => void)[] = [];
      let rowHeight = 0;
      band.children.forEach((child, i) => {
        cursorY = rowTop;
        const x = padX + xOffsets[i];
        if (child.type === 'box') {
          const c = placeBoxLike(child, x, rowTop, widths[i], true);
          const rw: LaidOutRow = {type: 'row', x, y: rowTop, w: widths[i], h: c.h, children: [c], arrows: []};
          laidOut.push(rw);
          rowHeight = Math.max(rowHeight, c.h);
          stretch.push(h => { c.h = rw.h = h; if (c.id) anchors.set(c.id, {x: c.x, y: c.y, w: c.w, h}); });
        } else {
          const frame = laidOut.length;
          stack([child], x, widths[i]);
          const f = laidOut[frame] as LaidOutGroup; // stack() pushes a group's frame first
          rowHeight = Math.max(rowHeight, f.h);
          stretch.push(h => { f.h = h; if (child.id) anchors.set(child.id, {x: f.x, y: f.y, w: f.w, h}); });
        }
      });
      stretch.forEach(s => s(rowHeight));
      registerRowSlots(band.id, band, rowTop, rowHeight, padX, cw, rowGap, widths.map((w, i) => ({x: padX + xOffsets[i], y: rowTop, w, h: rowHeight})));
      cursorY = rowTop + rowHeight + d.gap;
      continue;
    }

    if (band.type === 'row') {
      const rowGap = gapForLabels(band, cw);
      const {widths, xOffsets} = rowChildGeometry({...band, gap: rowGap}, cw);
      const placedChildren = band.children.map((child, i) =>
        placeBoxLike(child, padX + xOffsets[i], cursorY, widths[i], true));
      const rowHeight = Math.max(...placedChildren.map(c => c.h));
      for (const c of placedChildren) { c.h = rowHeight; if (c.id) anchors.set(c.id, {x: c.x, y: c.y, w: c.w, h: rowHeight}); }

      const arrows: RowArrow[] = [];
      if (band.arrows === 'between') {
        for (let i = 0; i < placedChildren.length - 1; i++) {
          const a = placedChildren[i], b = placedChildren[i + 1];
          const y = cursorY + rowHeight / 2;
          arrows.push({x1: a.x + a.w, y1: y, x2: b.x, y2: y});
        }
      }

      registerRowSlots(band.id, band, cursorY, rowHeight, padX, cw, rowGap, placedChildren);
      laidOut.push({type: 'row', id: band.id, x: padX, y: cursorY, w: cw, h: rowHeight, children: placedChildren, arrows});
      cursorY += rowHeight + d.gap;
      continue;
    }

    if (band.type === 'grid') {
      const gridStartY = cursorY;
      const {cellWidth} = gridChildGeometry(band, cw);
      const cols = band.cols;
      const placedRows: Placed<BoxBand>[] = [];
      for (let i = 0; i < band.children.length; i += cols) {
        const rowChildren = band.children.slice(i, i + cols);
        const placed = rowChildren.map((child, j) =>
          placeBoxLike(child, padX + j * (cellWidth + band.gap), cursorY, cellWidth, true));
        const rowHeight = Math.max(...placed.map(c => c.h));
        for (const c of placed) { c.h = rowHeight; if (c.id) anchors.set(c.id, {x: c.x, y: c.y, w: c.w, h: rowHeight}); }
        placedRows.push(...placed);
        cursorY += rowHeight + band.gap; // this row's gap; replaced by d.gap below after the loop
      }
      laidOut.push({type: 'grid', x: padX, y: gridStartY, w: cw, children: placedRows});
      cursorY += d.gap - band.gap; // swap the last grid-row's internal gap for the between-bands gap
      continue;
    }

    if (band.type === 'pyramid') {
      const paint = paintOf(d.appearance);
      const n = band.layers.length;
      const baseWidth = band.width ?? Math.min(cw, 520);
      const apexWidth = baseWidth * band.apexRatio;
      const layerH = band.layerHeight;
      const totalH = n * layerH;
      const cx = padX + cw / 2;
      const layersOut: LaidOutPyramidLayer[] = [];
      for (let i = 0; i < n; i++) { // i=0 is the bottom (widest) layer
        const bottomY = cursorY + totalH - i * layerH;
        const topY = bottomY - layerH;
        const bottomW = baseWidth - (baseWidth - apexWidth) * (i / n);
        const topW = baseWidth - (baseWidth - apexWidth) * ((i + 1) / n);
        // Opacity climbs bottom->top using SHADES (see tokens.ts) — the
        // apex (i = n-1) always gets SHADES[0] = fully opaque, matching
        // every hand-authored pyramid/funnel in this deck.
        const opacity = SHADES[Math.min(SHADES.length - 1, n - 1 - i)];
        // bg luminance is a real alpha-blend against white, so the text
        // color choice is provably safe (see tokens.ts's bestTextColor
        // doc comment) without needing a Playwright-rendered check.
        const bgLum = blendLuminance(paint(PALETTE.bg), paint(PALETTE[d.day].accent), opacity);
        const textColor = bestTextColor(bgLum, paint);
        // Wrapped at the narrower (top) edge of this layer, minus padding —
        // conservative since the layer is only wider than that going down,
        // so the label can never spill past the trapezoid's slanted sides.
        const wrapWidth = Math.max(40, topW - 24);
        const atomW = (atom: string) => widthOf(atom, roles.title, 700, 'sans');
        const lines = wrapAtoms(splitAtoms(band.layers[i].text), {maxWidth: wrapWidth, atomWidth: atomW});
        const midY = (topY + bottomY) / 2;
        const lineGap = roles.title * LINE_HEIGHT_EM;
        const textYs = lines.map((_, li) => Math.round(midY + (li - (lines.length - 1) / 2) * lineGap + roles.title * 0.35));
        layersOut.push({
          points: [[cx - bottomW / 2, bottomY], [cx + bottomW / 2, bottomY], [cx + topW / 2, topY], [cx - topW / 2, topY]],
          opacity, textColor, lines, textYs, cx,
        });
      }
      laidOut.push({type: 'pyramid', x: cx - baseWidth / 2, y: cursorY, w: baseWidth, h: totalH, day: d.day, layers: layersOut});
      cursorY += totalH + d.gap;
      continue;
    }

    if (band.type === 'plane') {
      const placed = layoutPlane(band, padX, cursorY, cw, widthOf, roles);
      if (band.id) {
        if (anchors.has(band.id)) claimed(band.id, 'a plane takes an id that another anchor already has');
        anchors.set(band.id, {x: placed.x, y: placed.y, w: placed.w, h: placed.h});
      }
      laidOut.push(placed);
      cursorY += placed.h + d.gap;
      continue;
    }

    if (band.type === 'curve') {
      const w = band.width ?? cw;
      const h = band.height;
      const x = padX + (cw - w) / 2;
      const y = cursorY;
      const AXIS_LABEL_W = 44, AXIS_BOTTOM_GAP = 28, TOP_PAD = 14, RIGHT_PAD = 8;
      const axisX = x + AXIS_LABEL_W;
      const axisRight = x + w - RIGHT_PAD;
      const axisTop = y + TOP_PAD;
      const axisBottom = y + h - AXIS_BOTTOM_GAP;
      const n = band.points.length;
      const points = band.points.map((p, i) => ({
        x: n === 1 ? axisX : axisX + i * (axisRight - axisX) / (n - 1),
        y: axisBottom - Math.max(0, Math.min(1, p.y)) * (axisBottom - axisTop),
        emphasis: p.emphasis,
        dropLine: !!p.dropLine,
      }));
      laidOut.push({
        type: 'curve', x, y, w, h, axisX, axisRight, axisTop, axisBottom, points,
        yTopLabel: band.yTopLabel, yBottomLabel: band.yBottomLabel, xLabel: band.xLabel,
      });
      cursorY += h + d.gap;
      continue;
    }

    // caption / box / banner
    const isBoxLike = band.type === 'box' || band.type === 'banner';
    const placed = placeBoxLike(band, padX, cursorY, cw, isBoxLike);
    laidOut.push(placed);
    cursorY += placed.h + d.gap;
  }
  };
  stack(d.bands, d.pad, contentWidth);
  for (const band of deferred) connects.push(resolveConnect(band, anchors, areaIds, widthOf, roles)); // throws "unknown anchor id" if it never appears

  const contentHeight = Math.round(cursorY - d.gap + d.pad);
  const canvasHeight = d.canvas ? Math.max(contentHeight, d.canvas.height) : contentHeight;

  return {...data, laidOut, canvasHeight, ...(data.canvas ? {contentHeight} : {}), connects, roles};
}

// 'id', 'id:side', or 'id:side@t' — t (0..1) slides the anchor along that side
// (default 0.5) so several connectors can leave/enter the same side in parallel.
function parseRef(ref: string): ConnectRef {
  const [id, sideAt] = ref.split(':');
  const [side, at] = (sideAt ?? 'center').split('@');
  return {id, side, at: at === undefined ? 0.5 : Number(at)};
}

function anchorPoint(rect: Rect, side: string, at = 0.5): Point {
  switch (side) {
    case 'left': return {x: rect.x, y: rect.y + rect.h * at};
    case 'right': return {x: rect.x + rect.w, y: rect.y + rect.h * at};
    case 'top': return {x: rect.x + rect.w * at, y: rect.y};
    case 'bottom': return {x: rect.x + rect.w * at, y: rect.y + rect.h};
    default: return {x: rect.x + rect.w / 2, y: rect.y + rect.h / 2};
  }
}

// positions along a leg to try for a chip, nearest the middle first
const CHIP_TS = Array.from({length: 41}, (_, i) => 0.1 + i * 0.02).sort((a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5));
const CONNECT_STROKE_PAD = 3; // half-thickness allowance so a perfectly horizontal/vertical path segment still has a non-zero-area bbox to check

function segRect(x0: number, y0: number, x1: number, y1: number): Rect {
  const xa = Math.min(x0, x1), xb = Math.max(x0, x1);
  const ya = Math.min(y0, y1), yb = Math.max(y0, y1);
  return {x: xa - CONNECT_STROKE_PAD, y: ya - CONNECT_STROKE_PAD, w: (xb - xa) + 2 * CONNECT_STROKE_PAD, h: (yb - ya) + 2 * CONNECT_STROKE_PAD};
}

// Polyline the connector follows. 'straight' is a single segment; 'loop-under'
// is down/across/up; 'elbow' is orthogonal — vertical-horizontal-vertical when
// leaving a top/bottom side, horizontal-vertical-horizontal when leaving a
// left/right side (`bend`, 0..1, is where the middle leg sits between the two
// endpoints). Collinear/duplicate points are dropped so a degenerate elbow
// (aligned endpoints) is just a straight line.
function routePoints(band: ConnectBand, from: Point, to: Point, fromSide: string): Point[] {
  let pts: Point[];
  if (band.route === 'loop-under') {
    const midY = Math.max(from.y, to.y) + band.dip;
    pts = [from, {x: from.x, y: midY}, {x: to.x, y: midY}, to];
  } else if (band.route === 'elbow') {
    const vertical = fromSide === 'top' || fromSide === 'bottom' || (fromSide === 'center' && Math.abs(to.y - from.y) > Math.abs(to.x - from.x));
    if (vertical) {
      const midY = band.bend === 'end' ? to.y - Math.sign(to.y - from.y) * (band.bendOffset ?? 14) : band.bend === 'start' ? from.y + Math.sign(to.y - from.y) * (band.bendOffset ?? 14) : from.y + (to.y - from.y) * (band.bend as number); // 'auto' only reaches here from resolveConnect, which replaces the result
      pts = [from, {x: from.x, y: midY}, {x: to.x, y: midY}, to];
    } else {
      const midX = band.bend === 'end' ? to.x - Math.sign(to.x - from.x) * (band.bendOffset ?? 14) : band.bend === 'start' ? from.x + Math.sign(to.x - from.x) * (band.bendOffset ?? 14) : from.x + (to.x - from.x) * (band.bend as number);
      pts = [from, {x: midX, y: from.y}, {x: midX, y: to.y}, to];
    }
  } else {
    pts = [from, to];
  }
  return pts.filter((p, i) => i === 0 || p.x !== pts[i - 1].x || p.y !== pts[i - 1].y);
}

// The path's ink as a list of thin segment rects rather than one bounding
// box — a loop-under/elbow path's bbox would cover empty space that other
// boxes legitimately occupy.
function pathSegments(points: Point[]): Rect[] {
  const segs: Rect[] = [];
  for (let i = 0; i < points.length - 1; i++) segs.push(segRect(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y));
  return segs;
}

function resolveConnect(band: ConnectBand, anchors: Map<string, Rect>, areaIds: Set<string>, widthOf: WidthOf, roles: Roles): LaidOutConnect {
  const fromRef = parseRef(band.from), toRef = parseRef(band.to);
  const fromRect = anchors.get(fromRef.id);
  const toRect = anchors.get(toRef.id);
  if (!fromRect) throw new Error(`connect(): unknown anchor id "${fromRef.id}" (give the source box an id: '${fromRef.id}')`);
  if (!toRect) throw new Error(`connect(): unknown anchor id "${toRef.id}" (give the target box an id: '${toRef.id}')`);
  const from = anchorPoint(fromRect, fromRef.side, fromRef.at);
  const to = anchorPoint(toRect, toRef.side, toRef.at);
  let points = routePoints(band, from, to, fromRef.side);
  if (band.route === 'elbow' && band.bend === 'auto') {
    // Pick the first bend whose path stays clear of every box except the two it joins.
    const inside = (r: Rect, a?: Rect) => !!a && Math.min(r.x + r.w, a.x + a.w) - Math.max(r.x, a.x) > 0.5 && Math.min(r.y + r.h, a.y + a.h) - Math.max(r.y, a.y) > 0.5;
    const fromArea = areaIds.has(fromRef.id) ? fromRect : undefined, toArea = areaIds.has(toRef.id) ? toRect : undefined; // the boxes inside a row / column end belong to that end
    const others = [...anchors.entries()].filter(([id, r]) => id !== fromRef.id && id !== toRef.id && !areaIds.has(id) && !inside(r, fromArea) && !inside(r, toArea)).map(([, r]) => r);
    const clear = (pts: Point[]) => pathSegments(pts).every(seg => others.every(r => {
      const ox = Math.min(seg.x + seg.w, r.x + r.w) - Math.max(seg.x, r.x);
      const oy = Math.min(seg.y + seg.h, r.y + r.h) - Math.max(seg.y, r.y);
      return ox <= 0.5 || oy <= 0.5;
    }));
    const cands = (['end', 'start', 0.5, 0.25, 0.75] as Bend[]).map(b => routePoints({...band, bend: b}, from, to, fromRef.side));
    points = cands.find(clear) ?? cands[0];
  }
  const segments = pathSegments(points);

  let labelX: number | undefined, labelY: number | undefined, labelBox: Rect | undefined, chipBox: Rect | undefined;
  if (band.label) {
    const labelWidth = textWidth(widthOf, band.label, (roles.connectLabel ?? CONNECT_LABEL_SIZE), 400);
    const dy = band.chip ? 5 : -6; // a chip sits ON the line; a plain label sits above it
    if (band.route === 'elbow' && points.length === 4) {
      // vertical-first: label rides the middle (horizontal) leg; horizontal-
      // first: it rides the first leg, so a fan of branches from one box
      // gets labels at distinct x positions.
      const [a, b, c2] = points;
      const [p, q] = a.x === b.x ? [b, c2] : [a, b];
      labelX = Math.round((p.x + q.x) / 2);
      labelY = Math.round(p.y + dy);
      // A chip sits on the longest leg, at the first spot along it where the pill touches neither endpoint box.
      if (band.chip && points.length === 4) {
        const cw2 = labelWidth + 16;
        const legs: {p0: Point; p1: Point; len: number}[] = [];
        for (let i = 0; i < points.length - 1; i++) {
          const p0 = points[i], p1 = points[i + 1];
          legs.push({p0, p1, len: Math.abs(p1.x - p0.x) + Math.abs(p1.y - p0.y)});
        }
        legs.sort((x, y) => y.len - x.len);
        const hit = (r: Rect, bx: Rect) => !(bx.x + bx.w <= r.x || r.x + r.w <= bx.x || bx.y + bx.h <= r.y || r.y + r.h <= bx.y);
        let pick: {mx: number; my: number} | null = null;
        for (const l of legs) {
          if (l.len < 24) continue;
          for (const t of CHIP_TS) {
            const mx = l.p0.x + (l.p1.x - l.p0.x) * t, my = l.p0.y + (l.p1.y - l.p0.y) * t;
            const bx = {x: mx - cw2 / 2, y: my - 12, w: cw2, h: 24};
            if (!hit(fromRect, bx) && !hit(toRect, bx)) { pick = {mx, my}; break; }
          }
          if (pick) break;
        }
        if (pick) { labelX = Math.round(pick.mx); labelY = Math.round(pick.my + dy); }
      }
    } else {
      const t = band.labelAt ?? 0.5;
      labelX = Math.round(from.x + (to.x - from.x) * t);
      labelY = Math.round((band.route === 'loop-under' ? Math.max(from.y, to.y) + band.dip : from.y + (to.y - from.y) * t) + dy);
    }
    labelBox = {x: labelX - labelWidth / 2, y: labelY - (roles.connectLabel ?? CONNECT_LABEL_SIZE), w: labelWidth, h: (roles.connectLabel ?? CONNECT_LABEL_SIZE) + 4};
    if (band.chip) {
      chipBox = {x: labelX - (labelWidth + 16) / 2, y: labelY - 17, w: labelWidth + 16, h: 24};
      labelBox = chipBox;
    }
  }

  // fromLabel/toLabel preserve the original "id:side" strings for error
  // messages — `from`/`to` themselves get overwritten by the spread below
  // with the resolved {x,y} points emit.ts's renderConnectPath needs.
  return {...band, from, to, fromId: fromRef.id, toId: toRef.id, fromArea: areaIds.has(fromRef.id) ? fromRect : undefined, toArea: areaIds.has(toRef.id) ? toRect : undefined, fromLabel: band.from, toLabel: band.to, points, pathSegments: segments, labelX, labelY, labelBox, chipBox};
}
