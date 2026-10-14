// Geometry constants and structural helpers shared by the layout passes (measure, layout handlers, connector resolution, emit):
// box padding, icon / step-badge sizes, the row() / grid() width distribution and the group title caption. No text metrics, no state.

import {textWidth} from './atoms.ts';
import type {DiagramData, Roles, WidthOf, Rect, CaptionBand, GroupBand, RowBand, GridBand} from './types.ts';

export const LINE_HEIGHT_EM = 1.4;   // vertical spacing between wrapped lines within one text block
export const BOX_PAD_X = 20;
export const BOX_PAD_Y = 16;
export const BOX_INNER_GAP = 8;      // vertical gap between title/body/note runs within one box

// box({step}) badge geometry — a solid-fill numbered circle sitting on the
// title's own baseline (cy = titleBaselineY - STEP_BADGE_BASELINE_OFFSET,
// matching the offset every hand-authored "① foo" box in this deck already
// used between its badge circle and its own number glyph's baseline).
export const STEP_BADGE_R = 15;
export const STEP_BADGE_GAP = 10;
export const STEP_BADGE_BASELINE_OFFSET = 6;
export const STEP_INDENT = 2 * STEP_BADGE_R + STEP_BADGE_GAP; // how far the title's first line is pushed right to clear the badge

// box({icon}): an SVG icon drawn ICON_SIZE px square at the box's top-left; every text run is pushed right to clear it.
export const ICON_SIZE = 32;
export const ICON_INDENT = ICON_SIZE + 12;
export const ICON_H = ICON_SIZE; // the icon is at least this tall, so a one-line box still holds it
// box({icon, iconAt: 'top'}): the icon is centred above the text (node()); the text starts below it
export const TOP_ICON_SIZE = 48;
export const TOP_ICON_GAP = 8;
export const topIcon = (band: {icon?: string; iconAt?: string}): boolean => band.icon !== undefined && band.iconAt === 'top';
/** What connect() joins to: the box — but for a node (icon above its text) the icon, so an arrow meets the picture, not its label. */
export function anchorRect(c: Rect & {type?: string; icon?: string; iconAt?: string; iconSize?: number; padY?: number}, h: number = c.h): Rect {
  if (c.type !== 'box' || !topIcon(c)) return {x: c.x, y: c.y, w: c.w, h};
  const size = c.iconSize ?? TOP_ICON_SIZE;
  return {x: c.x + c.w / 2 - size / 2 - 4, y: c.y + (c.padY ?? BOX_PAD_Y), w: size + 8, h: size};
}

export const TAG_H = 24;
export const TAG_PAD_X = 8;
/** The narrowest a canvas() region may be (px): below it a title breaks a character or two per line. */
export const CANVAS_MIN_REGION_W = 96;
export const STAMP_H = 24, STAMP_GAP = 6;
const STAMP_PAD_X = 6; // the stamp chip and the strip reserved for it under the content
export const stampChipW = (widthOf: WidthOf, text: string, roles: Roles): number => textWidth(widthOf, text, roles.note, 400) + 2 * STAMP_PAD_X;
export const LEGEND_SWATCH_W = 36, LEGEND_ITEM_GAP = 28, LEGEND_ROW_H = 24;

// group() title is laid out as a left-aligned bold caption inside the frame.
export function groupTitleBand(band: GroupBand): CaptionBand {
  return {type: 'caption', text: band.title as string, ...(band.spans?.title ? {spans: {text: band.spans.title}} : {}), align: band.titleAlign ?? 'left', role: 'title', bold: true, tone: band.titleTone ?? (band.tone === 'accent' ? 'accent' : 'text'), mono: false};
}

type SlotSizing = {span?: number; col?: number};
/** 1-based column and span of each row child on an N-column grid: `col` defaults to the column after the previous child. */
export function colSlots(children: SlotSizing[]): {col: number; span: number}[] {
  let next = 1;
  return children.map(c => { const span = c.span ?? 1, col = c.col ?? next; next = col + span; return {col, span}; });
}

// Structural width distribution for row()/grid() — pure arithmetic, no text
// metrics needed, so this can run in the same pass that registers measure
// requests (a child's wrap width must be known before we know what to wrap).
/** swimlane({fit: 'shrink'}) leaves the lane label / gap sizes alone while every column is at least this wide. */
export const SWIMLANE_COMFY_COL = 112;

export function rowChildGeometry(band: Pick<RowBand, 'cols' | 'gap' | 'justify' | 'itemWidth'> & {children: {span?: number; col?: number; flex?: number; width?: number; title?: string; id?: string}[]}, contentWidth: number) {
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

export function gridChildGeometry(band: GridBand, contentWidth: number) {
  const cols = band.cols;
  const gap = band.gap;
  const cellWidth = (contentWidth - (cols - 1) * gap) / cols;
  return {cellWidth};
}

/**
 * diagram({sourceLine}) is always the last band: left-aligned, muted, note size, whatever was add()ed and in whatever order.
 * Returns a copy (the input is not changed); without a sourceLine, the input itself.
 */
export function withSourceLine(d: DiagramData): DiagramData {
  return d.sourceLine === undefined ? d : {...d, bands: [...d.bands, {type: 'caption', text: d.sourceLine, align: 'left', role: 'note', tone: 'muted', bold: false, mono: false, sourceLine: true}]};
}
