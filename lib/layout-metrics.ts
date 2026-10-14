// Layout quality metrics (ADR 0014 D4): pure functions over the laid-out bands that count how well a figure is aligned and spaced.
// They measure what is DRAWN (box / group edges go through the emitter's 4px snap, see emit-boxes.ts), return raw numbers with the thresholds
// they were judged against, and know nothing about severities or `accept` (lib/rules.ts layoutQualityRules does). Thresholds come from
// principles - the 4px grid, the 24px line height (twice that is 48px), 40% - not from the examples.
//
// Only the bands a generator places by rule are measured (box / group frames, row and grid children, quadrant cells). Auto-placed bands
// (layered diagrams, trees, mind maps) and hand-placed ones (raw, wireframe, plane) are left out: their gaps and offsets are the layout's own.

import {snap4} from './emit-common.ts';
import type {Rect} from './types/core.ts';
import type {LaidOutBand} from './types/index.ts';
import type {LaidOutBox} from './types/text-bands.ts';

export type LayoutRule = 'layout-sibling-size' | 'layout-edge-misalign' | 'layout-gutter-uneven' | 'layout-unused-space' | 'layout-figure-offset' | 'layout-figure-narrow' | 'layout-align-mixed';

/** One measured finding: the rule, a human message, and the numbers a machine reads (`--format json`). */
export interface LayoutMetric {
  rule: LayoutRule;
  message: string;
  data: {band?: string; measured: number; threshold: number; fix?: string};
}

// ---- thresholds (principles, not fitted to the examples) --------------------------------------------------------------------------
/** Sibling widths / edges that differ by 1..GRID px are one grid step off: the drawn result of rounding, not a design (0 = aligned; more = a different thing). */
export const GRID = 4;
/** Gaps between neighbours in a row that differ by this much or more look uneven. */
export const GUTTER_UNEVEN_PX = 2;
/** Free room under a frame's content: two text lines (2 x 24px) and 40% of the frame. */
export const UNUSED_MIN_PX = 48;
export const UNUSED_MIN_RATIO = 0.4;
/** Left and right margins of the whole figure that differ by this much or more (the figure sits to one side). */
export const FIGURE_OFFSET_PX = 48;
/** The content is narrower than this share of the figure width. */
export const FIGURE_NARROW_RATIO = 0.5;
/** Neighbours further apart than this are not one row. */
const NEIGHBOUR_MAX_GAP = 64;
/** The strip a stamp chip reserves under a frame's content (layout-util STAMP_H + STAMP_GAP). */
const STAMP_STRIP = 30;

interface Frame {
  kind: 'box' | 'group' | 'cell';
  /** snapped, as drawn */
  x: number; y: number; w: number; h: number;
  name: string;
  align?: string;
}
const right = (f: Rect): number => f.x + f.w;
const bottom = (f: Rect): number => f.y + f.h;
const near = (a: number, b: number): boolean => { const d = Math.abs(a - b); return d >= 1 && d <= GRID; };

function snapped(r: Rect): Rect {
  const x = snap4(r.x), y = snap4(r.y);
  return {x, y, w: snap4(r.x + r.w) - x, h: snap4(r.h)};
}
const where = (f: Rect): string => `x=${Math.round(f.x)} y=${Math.round(f.y)}`;
const boxName = (b: LaidOutBox): string => b.title ?? b.id ?? b.body?.toString().slice(0, 12) ?? 'box';

/** The box / group frames and quadrant cells of a laid-out diagram, in drawing order, with the rects the emitter draws. */
function framesOf(laidOut: LaidOutBand[]): Frame[] {
  const out: Frame[] = [];
  const addBox = (b: LaidOutBox): void => { out.push({kind: 'box', ...snapped(b), name: `「${boxName(b)}」`, align: b.align ?? (b.icon !== undefined && b.iconAt === 'top' ? 'center' : 'left')}); };
  for (const b of laidOut) {
    if (b.type === 'box') addBox(b);
    else if (b.type === 'group') { if (b.frame !== false) out.push({kind: 'group', ...snapped(b), name: b.id ? `group「${b.id}」` : 'group'}); }
    else if (b.type === 'row' || b.type === 'grid') b.children.forEach(addBox);
    else if (b.type === 'quadrant') for (const c of b.cells) out.push({kind: 'cell', ...snapped(c), name: 'quadrant のマス'});
  }
  return out;
}

/** Frames that sit side by side: the same drawn top, left to right, each starting at or after the previous one's right edge and within NEIGHBOUR_MAX_GAP. */
function runsOf(frames: Frame[]): Frame[][] {
  const byTop = new Map<number, Frame[]>();
  for (const f of frames) byTop.set(f.y, [...(byTop.get(f.y) ?? []), f]);
  const runs: Frame[][] = [];
  for (const row of byTop.values()) {
    const sorted = [...row].sort((a, b) => a.x - b.x);
    let run: Frame[] = [];
    for (const f of sorted) {
      const prev = run.at(-1);
      if (prev && f.x >= right(prev) && f.x - right(prev) <= NEIGHBOUR_MAX_GAP) run.push(f);
      else if (!prev || f.x >= right(prev)) { if (run.length > 1) runs.push(run); run = [f]; }
      // a frame that overlaps the previous one (a frame-less group's first child, a nested frame) is not its neighbour
    }
    if (run.length > 1) runs.push(run);
  }
  return runs;
}

function siblingSize(runs: Frame[][], out: LayoutMetric[]): void {
  for (const run of runs) {
    const ws = run.map(f => f.w), lo = Math.min(...ws), hi = Math.max(...ws);
    // a run that mixes widths further apart than the grid is a flex / span design; only the 1..GRID px differences are the defect
    if (hi === lo || run.some(f => run.some(g => f.w !== g.w && !near(f.w, g.w)))) continue;
    out.push({rule: 'layout-sibling-size', message: `横に並ぶ ${run.length} 枠（${where(run[0])}）の幅が ${ws.join(' / ')}px で、${hi - lo}px だけ揃っていない。等分したい行は cols か flex で幅の比を揃える`, data: {band: run[0].name, measured: hi - lo, threshold: GRID, fix: 'cols / flex で列の幅を揃える（列の区切りは 4px の格子に乗せる）'}});
  }
}

function gutterUneven(runs: Frame[][], out: LayoutMetric[]): void {
  for (const run of runs) {
    if (run.length < 3) continue;
    const gaps = run.slice(1).map((f, i) => f.x - right(run[i])), lo = Math.min(...gaps), hi = Math.max(...gaps);
    if (hi - lo < GUTTER_UNEVEN_PX) continue;
    out.push({rule: 'layout-gutter-uneven', message: `横に並ぶ ${run.length} 枠（${where(run[0])}）の間隔が ${gaps.join(' / ')}px で、${hi - lo}px の差がある`, data: {band: run[0].name, measured: hi - lo, threshold: GUTTER_UNEVEN_PX, fix: '間隔（gap）を 4px の倍数にする'}});
  }
}

function edgeMisalign(frames: Frame[], out: LayoutMetric[]): void {
  const seen = new Set<string>();
  const report = (a: Frame, b: Frame, edge: string, d: number): void => {
    const key = `${edge}|${a.x},${a.y}|${b.x},${b.y}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({rule: 'layout-edge-misalign', message: `${a.name}（${where(a)}）と ${b.name}（${where(b)}）の${edge}が ${d}px ずれている（揃えるか、はっきり違えるか）`, data: {band: a.name, measured: d, threshold: GRID, fix: '同じ列・行の枠は、同じ座標から始める（cols の列に乗せる）'}});
  };
  for (const a of frames) for (const b of frames) {
    if (a === b) continue;
    const xOverlap = Math.min(right(a), right(b)) - Math.max(a.x, b.x) > 0, yOverlap = Math.min(bottom(a), bottom(b)) - Math.max(a.y, b.y) > 0;
    // b right under a: left edges, then right edges
    if (xOverlap && b.y >= bottom(a) && b.y - bottom(a) <= NEIGHBOUR_MAX_GAP) {
      if (near(a.x, b.x)) report(a, b, '左端', Math.abs(a.x - b.x));
      if (near(right(a), right(b))) report(a, b, '右端', Math.abs(right(a) - right(b)));
    }
    // b right of a: top edges
    if (yOverlap && b.x >= right(a) && b.x - right(a) <= NEIGHBOUR_MAX_GAP && near(a.y, b.y)) report(a, b, '上端', Math.abs(a.y - b.y));
  }
}

/** The bottom of a box's text: the last line's baseline plus a descender. */
function textBottom(b: LaidOutBox): number {
  let low = 0;
  for (const r of b.wrappedRuns ?? []) if (r.lineYs?.length) low = Math.max(low, r.lineYs[r.lineYs.length - 1] + 0.3 * r.size);
  return b.y + (b.padY ?? 16) + low;
}

/** The rect a band covers, when it has one (a grid has no h of its own: its children carry it). */
function extentOf(b: LaidOutBand): Rect | null {
  const x = b as unknown as Partial<Rect> & {children?: Rect[]; labelBoxes?: Rect[]};
  if (b.type === 'grid') return unionOf(b.children);
  if (typeof x.x !== 'number' || typeof x.y !== 'number' || typeof x.w !== 'number' || typeof x.h !== 'number') return null;
  const r: Rect = {x: x.x, y: x.y, w: x.w, h: x.h};
  return x.labelBoxes?.length ? unionOf([r, ...x.labelBoxes]) : r;
}
function unionOf(rs: Rect[]): Rect | null {
  if (!rs.length) return null;
  const x0 = Math.min(...rs.map(r => r.x)), y0 = Math.min(...rs.map(r => r.y)), x1 = Math.max(...rs.map(right)), y1 = Math.max(...rs.map(bottom));
  return {x: x0, y: y0, w: x1 - x0, h: y1 - y0};
}

function unusedSpace(laidOut: LaidOutBand[], out: LayoutMetric[]): void {
  const report = (name: string, at: Rect, free: number, h: number): void => {
    out.push({rule: 'layout-unused-space', message: `${name}（${where(at)}）の下に ${Math.round(free)}px（${Math.round(100 * free / h)}%）の空き。中身を縦に寄せるか、枠の高さを内容に合わせる`, data: {band: name, measured: Math.round(free), threshold: UNUSED_MIN_PX, fix: '行の高さを揃えた結果の空き: 兄弟と同じ量の内容にするか、枠を分ける'}});
  };
  const judge = (name: string, at: Rect, h: number, contentBottom: number, stamped: boolean): void => {
    const free = bottom(at) - Math.max(contentBottom, stamped ? bottom(at) - STAMP_STRIP : 0);
    if (free >= UNUSED_MIN_PX && free >= UNUSED_MIN_RATIO * h) report(name, at, free, h);
  };
  laidOut.forEach((b, i) => {
    if (b.type === 'box') judge(`「${boxName(b)}」`, b, b.h, textBottom(b), !!b.stampW);
    else if (b.type === 'row' || b.type === 'grid') { for (const c of b.children) judge(`「${boxName(c)}」`, c, c.h, textBottom(c), !!c.stampW); }
    else if (b.type === 'group' && b.frame !== false) {
      // what sits inside the frame: every later band that lies within it
      const inside = laidOut.slice(i + 1).map(extentOf).filter((r): r is Rect => r !== null && r.x >= b.x - 1 && right(r) <= right(b) + 1 && r.y >= b.y - 1 && bottom(r) <= bottom(b) + 1);
      if (!inside.length) return;
      judge(b.id ? `group「${b.id}」` : 'group', b, b.h, Math.max(...inside.map(bottom)), !!b.stamp);
    }
  });
}

/** Everything the figure shows, as one rect (labels of shapes included). Captions, legends and the source line are furniture, not the figure. */
function contentBox(laidOut: LaidOutBand[]): Rect | null {
  return unionOf(laidOut.filter(b => b.type !== 'caption' && b.type !== 'legend' && b.type !== 'banner').map(extentOf).filter((r): r is Rect => r !== null));
}

function figureRules(laidOut: LaidOutBand[], width: number, out: LayoutMetric[]): void {
  const box = contentBox(laidOut);
  if (!box) return;
  const left = box.x, rightMargin = width - right(box), off = Math.abs(left - rightMargin);
  if (off >= FIGURE_OFFSET_PX) out.push({rule: 'layout-figure-offset', message: `内容の左の余白が ${Math.round(left)}px、右が ${Math.round(rightMargin)}px で、${Math.round(off)}px の差がある。図が左右どちらかに寄っている`, data: {measured: Math.round(off), threshold: FIGURE_OFFSET_PX, fix: '図の部品全体を中央に置く（row の justify: center、図形とラベルの外接で寄せる）'}});
  if (box.w < FIGURE_NARROW_RATIO * width) out.push({rule: 'layout-figure-narrow', message: `内容の幅が ${Math.round(box.w)}px で、図の幅 ${width}px の ${Math.round(100 * box.w / width)}% しかない。diagram({width}) で内容に合わせて狭めると余白が減る`, data: {measured: Math.round(box.w), threshold: Math.round(FIGURE_NARROW_RATIO * width), fix: 'diagram({width}) を内容に合わせて小さくする'}});
}

function alignMixed(runs: Frame[][], out: LayoutMetric[]): void {
  for (const run of runs) {
    const boxes = run.filter(f => f.kind === 'box'), kinds = new Set(boxes.map(f => f.align));
    if (boxes.length < 2 || kinds.size < 2) continue;
    out.push({rule: 'layout-align-mixed', message: `横に並ぶ ${boxes.length} 枠（${where(run[0])}）で文字の揃え（${[...kinds].join(' / ')}）が混ざっている`, data: {band: run[0].name, measured: kinds.size, threshold: 1, fix: 'align を揃える（数字は中央、説明は左、などの意図があれば accept で許容する）'}});
  }
}

/** Every layout metric finding of a laid-out diagram. `width` is the figure width; `slideCanvas` skips the whole-figure rules (the canvas is fixed). */
export function layoutMetrics(laidOut: LaidOutBand[], opts: {width: number; slideCanvas?: boolean}): LayoutMetric[] {
  const out: LayoutMetric[] = [];
  const frames = framesOf(laidOut), runs = runsOf(frames);
  siblingSize(runs, out);
  edgeMisalign(frames, out);
  gutterUneven(runs, out);
  unusedSpace(laidOut, out);
  if (!opts.slideCanvas) figureRules(laidOut, opts.width, out);
  alignMixed(runs, out);
  return out;
}
