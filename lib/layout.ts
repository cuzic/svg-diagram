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

import {withStatus} from './status.ts';
import {atBand, sourceOf, withSource} from './source-ref.ts';
import type {SourceRef} from './source-ref.ts';
import {textWidth} from './atoms.ts';
import {layoutHandlerFor} from './layout-handlers.ts';
import type {LayoutCtx, Placed, RowLike} from './layout-ctx.ts';
import {childrenOf, stackWidthOf} from './band-children.ts';
import {layoutBoxContent, lineWidth} from './layout-text.ts';
import {parseRef, resolveConnect} from './layout-connect.ts';
import {ceil4, labelRoom} from './connect-rules.ts';
import type {LabelAxis} from './connect-rules.ts';
import {addScoped, qualify, scopesOf} from './anchor-scope.ts';
import {
  BOX_PAD_X, BOX_PAD_Y, CANVAS_MIN_REGION_W, ICON_H, STAMP_GAP, STAMP_H, TAG_H, TAG_PAD_X, TOP_ICON_GAP, TOP_ICON_SIZE,
  anchorRect, colSlots, rowChildGeometry, snapGrid, stampChipW, topIcon, withSourceLine, withTitleLine,
} from './layout-util.ts';
import type {AreasBand, LaidOutConnect, ConnectBand} from './types/containers.ts';
import {areasColumns} from './areas.ts';
import {canvasSpan} from './canvas.ts';
import type {DiagramData, Roles, WidthOf, Rect, WrapMode} from './types/core.ts';
import type {LaidOutDiagram, LaidOutBand, LaidOutBox, Band} from './types/index.ts';
import type {CaptionBand, BoxBand, BannerBand, BoxChrome} from './types/text-bands.ts';
import {TAG_SIZE, toneEnv} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';

import {must} from './must.ts';
/** Pass 2, synchronous: lay the diagram out with the widths already measured. */
export function layoutWith(data: DiagramData, roles: Roles, widthOf: WidthOf): LaidOutDiagram {
  const lay = (mode: WrapMode): LaidOutDiagram => fitLineScale(data, lines => layoutBands(data, roles, widthOf, toneEnv(data.tones), mode, data.keepWords === true, spaceOf(data.density), lines));
  const setting = data.wrap ?? 'phrase';
  if (setting !== 'bunsetsu-soft') return lay(setting);
  // 'bunsetsu-soft': break at phrase boundaries (hiragana kept with the character before it); a figure that does not fit that way is laid out as 'phrase' instead of failing.
  // A real mistake of the author (a bad id ...) fails again in the second layout, with its own message.
  try { return lay('bunsetsu'); } catch { return {...lay('phrase'), wrapFellBack: true}; }
}

/**
 * ADR 0070 D7 (U5): on a canvas, the cause bands' lines scale with the text and make the figure taller. When that is what pushes the whole figure (the bands above and below
 * the cause band, the legend, the source line and the padding included) over the canvas height, and the old lines would fit, the figure is laid out again with the old lines.
 * The cause bands are dropped one more at a time in the order they are laid out (top to bottom) until the figure fits; if it never fits, the first layout is kept
 * (the overflow is then not the scale's, and `slide-canvas-overflow` says it). A dropped band is `lineScaleDropped` (the `cause-line-scale-dropped` finding).
 */
function fitLineScale(data: DiagramData, layout: (lines: {seen: number; drop: number}) => LaidOutDiagram): LaidOutDiagram {
  const first = {seen: 0, drop: 0}, out = layout(first);
  if (!data.canvas || out.contentHeight === undefined || out.contentHeight <= data.canvas.height) return out;
  for (let drop = 1; drop <= first.seen; drop++) {
    let again: LaidOutDiagram;
    try { again = layout({seen: 0, drop}); } catch { return out; } // a retry that cannot be laid out keeps the figure that was (the retry never turns a drawn figure into an error)
    if (again.contentHeight !== undefined && again.contentHeight <= data.canvas.height) return again;
  }
  return out;
}

/** The scale of the gaps of the layered figures (`WrapEnv.space`): 'compact' closes them by a quarter. */
const spaceOf = (density: 'normal' | 'compact' | undefined): number => density === 'compact' ? 0.75 : 1;

function layoutBands(data: DiagramData, roles: Roles, widthOf: WidthOf, tones: ToneEnv, wrap: WrapMode, keepWords: boolean, space = 1, lines = {seen: 0, drop: 0}): LaidOutDiagram {
  const d = withStatus(withSourceLine(withTitleLine(data)));
  const contentWidth = d.width - 2 * d.pad;

  // A labelled straight connector between two side-by-side children (right side -> left side) needs room in the gap
  // between them: a label wider than the gap lands on both boxes, or straddles the groups' frame lines. The row's gap grows to fit it.
  // A row on a shared column grid (`cols`) keeps its column edges aligned with the other rows of that grid, so the gap grows for
  // every row declaring the same `cols` + `gap` (the widest need wins), not for the one row that has the label.
  // One between two bands that follow each other (bottom side -> top side) widens the space after the first band (ADR 0069 D1).
  // The room a label needs is labelRoom() (lib/connect-rules.ts), what the checks measure too.
  const labelled: ConnectBand[] = [];
  const collectConnects = (bs: Band[]): void => { for (const b of bs) { if (b.type === 'connect' && b.label && b.route === 'straight' && !b.annot) labelled.push(b); else collectConnects(childrenOf(b)); } };
  collectConnects(d.bands);
  const idsIn = (b: Band, out = new Set<string>()): Set<string> => { const x = b as {id?: string}; if (x.id) out.add(x.id); for (const c of childrenOf(b)) idsIn(c, out); return out; };
  const MIN_CHILD_W = 80;
  // the gap one row (laid out `cw` wide) needs for the labelled connectors between neighbours that sit side by side: the smallest gap
  // whose real distance between the two children (rowChildGeometry(): column edges on the 4px grid, empty columns between them included)
  // is at least the room the label needs. A gap that already leaves the room stays as declared.
  const gapNeeded = (band: RowLike, cw: number): number => {
    if (!labelled.length) return band.gap;
    const kids = band.children.map(c => idsIn(c));
    const slots = band.cols ? colSlots(band.children) : null;
    const distance = (gap: number, lo: number, hi: number): number => { const {widths, xOffsets} = rowChildGeometry({...band, gap} as Parameters<typeof rowChildGeometry>[0], cw); return must(xOffsets[hi]) - must(xOffsets[lo]) - must(widths[lo]); };
    let gap = band.gap;
    for (const c of labelled) {
      const f = parseRef(c.from), t = parseRef(c.to);
      const i = kids.findIndex(k => k.has(f.id)), j = kids.findIndex(k => k.has(t.id));
      if (i < 0 || j < 0 || Math.abs(i - j) !== 1 || !((i < j && f.side === 'right' && t.side === 'left') || (i > j && f.side === 'left' && t.side === 'right'))) continue;
      const need = labelRoom(c.label as string, c.chip, 'horizontal', c.labelAt, roles, widthOf), lo = Math.min(i, j), hi = Math.max(i, j);
      if (!Number.isFinite(need) || distance(band.gap, lo, hi) >= need) continue;
      // the distance is linear in the gap: (k + 1) gaps and k columns of (cw - (cols - 1) gap) / cols for k empty columns between them
      const k = slots && band.cols ? must(slots[hi]).col - must(slots[lo]).col - must(slots[lo]).span : 0, cols = band.cols ?? 1;
      let g = Math.max(band.gap, ceil4((need - k * cw / cols) / (1 + k / cols)));
      while (g < cw && distance(g, lo, hi) < need) g += 4; // the columns are cut to the 4px grid: add a step until the real distance is enough
      gap = Math.max(gap, g);
    }
    return gap;
  };
  const sharedGaps = new Map<string, number>(); // `${cols}/${gap}` -> the gap every row of that column grid uses (filled just below)
  const gapForLabels = (band: RowLike, cw: number): number => {
    if (band.cols) return sharedGaps.get(`${band.cols}/${band.gap}`) ?? band.gap;
    if (band.justify !== 'stretch' || !labelled.length) return band.gap; // fixed-width rows would overflow the canvas
    const gap = gapNeeded(band, cw);
    const maxGap = band.children.length > 1 ? (cw - band.children.length * MIN_CHILD_W) / (band.children.length - 1) : band.gap;
    return gap <= maxGap ? gap : band.gap; // would squeeze the children: keep the gap (verify reports the label that does not fit, with the room it needs)
  };
  // The space to add after a band of a stack, for the labelled connectors from its bottom to the top of the next band (or back up).
  // Bands that take no height (a connect, a spacer / raw of height 0) are skipped when finding "the next band". The ends may sit deep
  // inside their bands (in a group, a row): the space between the bands is widened as if they were on the bands' edges.
  // A gap the checks already pass (as long as the label needs with no margin) stays as it is: a figure that draws clean does not move.
  const bandGaps = new Map<Band, number>();
  const flat = (b: Band): boolean => (b.type === 'connect' && b.route !== 'loop-under' && b.annot?.side !== 'below') || ((b.type === 'spacer' || b.type === 'raw') && b.h === 0);
  // two boxes of the same stack, joined at the same `@t`, are as wide as the stack: the line is vertical (else the x of the ends is not known
  // yet). A node (icon above its text) is joined at its icon, centred: only its middle (`@0.5`) is at the box's middle.
  const isBox = (b: Band, id: string): boolean => b.type === 'box' && b.id === id;
  const aligned = (a: Band, b: Band, hi: {id: string; at: number}, lo: {id: string; at: number}): boolean =>
    isBox(a, hi.id) && isBox(b, lo.id) && hi.at === lo.at && (hi.at === 0.5 || (!topIcon(a as BoxBand) && !topIcon(b as BoxBand)));
  // A node's top end is its icon, inside the box (anchorRect): the route runs on past the box's top edge by the box's top padding, and the
  // label, placed along the whole route, comes that much closer to the lower box. The gap the label needs grows by what keeps it clear
  // of the lower box: `drop × t / (1 − t)`, t the label's place counted from the upper end (labelAt 0.5: the drop itself).
  const boxIn = (b: Band, id: string): BoxBand | undefined => b.type === 'box' && b.id === id ? b : childrenOf(b).reduce<BoxBand | undefined>((hit, c) => hit ?? boxIn(c, id), undefined);
  // An end that a connect({via: {to / from: 'group'}}) stops on a frame (ADR 0069 D2) is not the icon: no drop. With via: 'group' it is not
  // known before layout whether the end sits in a frame, so the drop stays (the safe side).
  const onFrame = (c: ConnectBand, end: 'from' | 'to'): boolean => !!c.via && c.via !== 'group' && c.via[end] === 'group';
  const nodeDrop = (lower: Band, end: {id: string; side: string}, labelAt: number | undefined, down: boolean, framed = false): number => {
    if (framed) return 0;
    const node = end.side === 'top' ? boxIn(lower, end.id) : undefined;
    if (!node || !topIcon(node)) return 0;
    const t = down ? labelAt ?? 0.5 : 1 - (labelAt ?? 0.5);
    return t < 1 ? (node.padY ?? BOX_PAD_Y) * t / (1 - t) : Infinity;
  };
  const verticalGaps = (bs: Band[]): void => {
    const tall = bs.filter(b => !flat(b));
    for (let n = 0; n + 1 < tall.length; n++) {
      const a = must(tall[n]), b = must(tall[n + 1]), above = idsIn(a), below = idsIn(b);
      let extra = 0;
      for (const c of labelled) {
        const f = parseRef(c.from), t = parseRef(c.to);
        const down = above.has(f.id) && f.side === 'bottom' && below.has(t.id) && t.side === 'top', up = below.has(f.id) && f.side === 'top' && above.has(t.id) && t.side === 'bottom';
        if (!down && !up) continue;
        const [hi, lo] = down ? [f, t] : [t, f];
        const axis: LabelAxis = aligned(a, b, hi, lo) ? 'vertical' : 'slanted';
        const drop = nodeDrop(b, lo, c.labelAt, down, onFrame(c, down ? 'to' : 'from'));
        const need = labelRoom(c.label as string, c.chip, axis, c.labelAt, roles, widthOf) + drop, fails = labelRoom(c.label as string, c.chip, axis, c.labelAt, roles, widthOf, 0) + drop;
        // the next band's top is rounded to the 4px grid (at most 2px up): the route can be 2px shorter than d.gap; leave those 2px too
        if (Number.isFinite(need) && d.gap - 2 < fails) extra = Math.max(extra, ceil4(need + 2) - d.gap);
      }
      if (extra > 0) bandGaps.set(a, extra);
    }
  };

  // areas() (ADR 0069 D3): the column and row gaps it is laid out with (`cw` wide), the same for the pre-pass and layoutAreas. A labelled
  // straight connect between two areas side by side (their rows overlap, every cell between them is empty: spacer columns count) widens
  // `gap` until their real distance (areasColumns) is the room the label needs; one between two areas one above the other (their columns
  // overlap, every cell between them is empty) widens `rowGap`. An areas() has one gap of each kind, so one label widens it everywhere.
  // A pair with a filled cell between them is left to the checks (the line would cross that cell), as are elbows and centre-to-centre ends.
  const areasGaps = new Map<AreasBand, Map<number, {gap: number; rowGap: number}>>();
  const overAreas = new Set<AreasBand>(); // areas() among the parts over a picture (the walk fills it): the picture's size is fixed, nothing widens
  const areasGapFor = (band: AreasBand, cw: number): {gap: number; rowGap: number} => {
    const known = areasGaps.get(band)?.get(cw);
    if (known) return known;
    let gap = band.gap, rowGap = band.rowGap;
    const pairs: {lo: number; hi: number; need: number}[] = []; // the side-by-side pairs, checked again at the final gap
    if (labelled.length && !overAreas.has(band)) {
      const ids = band.children.map(c => idsIn(c)), place = band.place;
      const cellAt = new Map<string, number>(); // `${row}/${col}` -> the area there (missing: an empty cell)
      place.forEach((p, i) => { for (let r = p.row; r < p.row + p.rs; r++) for (let c = p.col; c < p.col + p.cs; c++) cellAt.set(`${r}/${c}`, i); });
      const empty = (rows: [number, number], cols: [number, number]): boolean => {
        for (let r = rows[0]; r < rows[1]; r++) for (let c = cols[0]; c < cols[1]; c++) if (cellAt.has(`${r}/${c}`)) return false;
        return true;
      };
      const overlap = (a0: number, an: number, b0: number, bn: number): [number, number] => [Math.max(a0, b0), Math.min(a0 + an, b0 + bn)];
      const span = (g: number, i: number): {x: number; w: number} => canvasSpan(areasColumns(band.colW, 0, cw, g), must(place[i]));
      // the distance between area `lo` (left) and `hi` (right) at gap g, spacer columns included
      const distance = (g: number, lo: number, hi: number): number => { const a = span(g, lo), b = span(g, hi); return b.x - (a.x + a.w); };
      const isBox = (i: number, id: string): boolean => { const c = band.children[i]; return c?.type === 'box' && c.id === id; };
      for (const c of labelled) {
        const f = parseRef(c.from), t = parseRef(c.to);
        const i = ids.findIndex(k => k.has(f.id)), j = ids.findIndex(k => k.has(t.id));
        if (i < 0 || j < 0 || i === j) continue;
        const a = must(place[i]), b = must(place[j]);
        const rows = overlap(a.row, a.rs, b.row, b.rs), cols = overlap(a.col, a.cs, b.col, b.cs);
        const across = rows[0] < rows[1] && ((f.side === 'right' && t.side === 'left' && a.col + a.cs <= b.col) || (f.side === 'left' && t.side === 'right' && b.col + b.cs <= a.col));
        const down = cols[0] < cols[1] && ((f.side === 'bottom' && t.side === 'top' && a.row + a.rs <= b.row) || (f.side === 'top' && t.side === 'bottom' && b.row + b.rs <= a.row));
        if (across) {
          const [lo, hi] = a.col < b.col ? [i, j] : [j, i], L = must(place[lo]), H = must(place[hi]);
          if (!empty(rows, [L.col + L.cs, H.col])) continue;
          const need = labelRoom(c.label as string, c.chip, 'horizontal', c.labelAt, roles, widthOf);
          if (!Number.isFinite(need)) continue;
          pairs.push({lo, hi, need});
          if (distance(band.gap, lo, hi) >= need) continue; // a figure that leaves the room keeps its gap
          // the distance is linear in the gap: (k + 1) gaps and the spacer columns' share of what the gaps leave
          const k = H.col - L.col - L.cs, n = band.colW.length, total = band.colW.reduce((x, y) => x + y, 0);
          const share = band.colW.slice(L.col + L.cs, H.col).reduce((x, y) => x + y, 0) / total, per = k + 1 - share * (n - 1);
          let g = per > 0 ? Math.max(band.gap, ceil4((need - share * cw) / per)) : band.gap;
          while (g < cw && distance(g, lo, hi) < need) g += 4; // the columns are whole 4px steps: add a step until the real distance is enough
          gap = Math.max(gap, g);
        } else if (down) {
          const [hiI, loI] = a.row < b.row ? [i, j] : [j, i], U = must(place[hiI]), D = must(place[loI]);
          if (!empty([U.row + U.rs, D.row], cols)) continue;
          const [top, bottom] = a.row < b.row ? [f, t] : [t, f];
          // two boxes placed directly in areas of the same columns, joined at the same `@t`, are joined by a vertical line; a node (icon
          // above its text) only at its middle. Anything else is 'slanted' (the safe side), as in D1's stacks.
          const vertical = isBox(hiI, top.id) && isBox(loI, bottom.id) && U.col === D.col && U.cs === D.cs && top.at === bottom.at
            && (top.at === 0.5 || (!topIcon(band.children[hiI] as BoxBand) && !topIcon(band.children[loI] as BoxBand)));
          const axis: LabelAxis = vertical ? 'vertical' : 'slanted';
          // rows between the two (filled in other columns): their heights add to the route but are not known before layout, so such a
          // pair is not widened (the checks report it if it is still short)
          if (D.row > U.row + U.rs) continue;
          const drop = nodeDrop(band.children[loI] as Band, a.row < b.row ? t : f, c.labelAt, a.row < b.row, onFrame(c, a.row < b.row ? 'to' : 'from'));
          const need = labelRoom(c.label as string, c.chip, axis, c.labelAt, roles, widthOf) + drop, fails = labelRoom(c.label as string, c.chip, axis, c.labelAt, roles, widthOf, 0) + drop;
          // the rows are on the 4px grid, so the route is the row gap (plus how deep the ends sit in their areas). A gap the checks already
          // pass stays as it is; one that does not grows to the room with its margin.
          if (Number.isFinite(need) && band.rowGap < fails) rowGap = Math.max(rowGap, ceil4(need));
        }
      }
      // growing the column gap must not squeeze an area: each keeps >= 70% of its width (and the 96px every area needs), or the gap stays as
      // declared (the checks report the label, with the gap it needs)
      // a wider gap can take a step off a spacer column (areasColumns cuts every column to whole steps): every pair must fit at the final gap
      if (gap !== band.gap) while (gap < cw && pairs.some(q => distance(gap, q.lo, q.hi) < q.need)) gap += 4;
      if (gap !== band.gap) {
        const fits = place.every((_p, i) => { const before = span(band.gap, i).w, after = span(gap, i).w; return after >= Math.max(0.7 * before, Math.min(before, CANVAS_MIN_REGION_W)); });
        if (!fits) gap = band.gap;
      }
    }
    const out = {gap, rowGap};
    areasGaps.set(band, (areasGaps.get(band) ?? new Map()).set(cw, out));
    return out;
  };

  {
    let grids = new Map<string, {need: number; rows: {cw: number; spans: number[]}[]}>();
    const walk = (bs: Band[], cw: number, over = false): void => {
      if (labelled.length && !over) verticalGaps(bs); // the parts over a picture: the picture's height is fixed, there is no room to add
      for (const b of bs) atBand(b, () => {
        const inner = stackWidthOf(b, cw);
        if (inner !== null) walk(childrenOf(b), inner, over || b.type === 'image');
        else if (b.type === 'areas') { // the gaps first, then the widths of its cells at those gaps (what the real pass uses)
          if (over) overAreas.add(b);
          const cols = areasColumns(b.colW, 0, cw, areasGapFor(b, cw).gap);
          b.children.forEach((c, i) => { if (c.type === 'group') walk(c.children, canvasSpan(cols, must(b.place[i])).w - 2 * (c.pad ?? 16), over); });
        } else if ((b.type === 'row' || b.type === 'grouprow') && b.cols) {
          const key = `${b.cols}/${b.gap}`, g = grids.get(key) ?? {need: b.gap, rows: []};
          g.need = Math.max(g.need, gapNeeded(b as RowLike, cw));
          g.rows.push({cw, spans: colSlots((b as RowLike).children).map(s => s.span)});
          grids.set(key, g);
          if (b.type === 'grouprow') { // nested widths use the shared gap of the previous round (the declared gap in the first)
            const {widths} = rowChildGeometry({...b, gap: sharedGaps.get(key) ?? b.gap}, cw);
            b.children.forEach((c, i) => { if (c.type === 'group') walk(c.children, must(widths[i]) - 2 * (c.pad ?? 16), over); });
          }
        } else if (b.type === 'grouprow') {
          const {widths} = rowChildGeometry({...b, gap: gapForLabels(b as RowLike, cw)}, cw); // the same gap the real pass will use
          b.children.forEach((c, i) => { if (c.type === 'group') walk(c.children, must(widths[i]) - 2 * (c.pad ?? 16), over); });
        }
      });
    };
    // A row inside a group of a `cols` grouprow is as wide as the shared gap leaves it, and the shared gap depends on what the rows need:
    // walk again with the shared gaps of the previous round until they stay the same (a few rounds at most). A grid whose widened gap
    // squeezed a child once keeps its declared gap from then on: narrower nested rows could otherwise make it fit again, and the gap
    // would flip between the two values with the number of rounds.
    const rejected = new Set<string>();
    for (let round = 0; round < 4; round++) {
      grids = new Map();
      bandGaps.clear();
      walk(d.bands, contentWidth);
      let changed = false;
      for (const [key, g] of grids) {
        const [colsN, baseN] = key.split('/').map(Number), cols = must(colsN), base = must(baseN);
        const width = (cw: number, span: number, gap: number) => span * ((cw - (cols - 1) * gap) / cols) + (span - 1) * gap;
        // growing must not squeeze a box: each child keeps >= 70% of its width (and >= 40px) or the gap stays as declared (verify reports the label)
        const fits = g.need === base || g.rows.every(r => r.spans.every(sp => width(r.cw, sp, g.need) >= Math.min(width(r.cw, sp, base), Math.max(40, 0.7 * width(r.cw, sp, base)))));
        if (!fits) rejected.add(key);
        const gap = rejected.has(key) ? base : g.need;
        if ((sharedGaps.get(key) ?? base) !== gap) changed = true;
        sharedGaps.set(key, gap);
      }
      if (!changed) break;
    }
  }
  // ---- pass 2: layout top-to-bottom ----
  const laidOut: LaidOutBand[] = [];
  const anchors = new Map<string, Rect>(); // id -> {x,y,w,h}
  const nodeBottoms = new Map<string, number>(); // a node's anchor is its icon; an arrow leaving its bottom starts under the label
  const areaIds = new Set<string>();       // ids of rows and row columns: anchors that hold other boxes
  const setBox = (id: string, c: Parameters<typeof anchorRect>[0], h: number): void => {
    anchors.set(id, anchorRect(c, h));
    if (c.type === 'box' && topIcon(c)) nodeBottoms.set(id, c.y + h); else nodeBottoms.delete(id);
  };
  const claimed = (id: string, what: string): never => { throw new Error(`duplicate anchor id "${id}": ${what} — every id (and every row's "id#n" column ids) must be unique`); };
  const connects: LaidOutConnect[] = [];
  const deferred: ConnectBand[] = []; // connect()s that came before the boxes they name

  const scopes = scopesOf(d.bands); // every scoped item, read before layout: a bare id is ambiguous whatever order the bands came in
  const placeBoxLike = <B extends CaptionBand | BoxBand | BannerBand>(band: B, x: number, y0: number, w: number, isBoxLike: boolean, scope?: string): Placed<B> => {
    const y = snapGrid(y0); // the top sits on the grid, so its text (y + padY + line offset) is always the same distance below the frame the emitter draws
    const chrome = band as BoxChrome; // caption has no padX / padY / tag / id: they read as undefined (its `tone` is a TextTone, unused here)
    const wrapWidth = isBoxLike ? w - 2 * (chrome.padX ?? BOX_PAD_X) : w;
    const content = layoutBoxContent(band, wrapWidth, widthOf, roles, wrap);
    // an icon above the text pushes every line down by its own height; a left icon only sets a minimum height
    const topShift = band.type === 'box' && topIcon(band) ? ((band as BoxBand).iconSize ?? TOP_ICON_SIZE) + TOP_ICON_GAP : 0;
    // a left icon is taller than a line or two of text: the text is centred beside it, not hung from the top with the room left below
    const leftIcon = band.type === 'box' && !!band.icon && !topShift;
    const centre = leftIcon && content.textHeight < ICON_H ? Math.round((ICON_H - content.textHeight) / 2) : 0;
    const shift = topShift + centre;
    const wrappedRuns = shift ? content.wrappedRuns.map(r => ({...r, lineYs: r.lineYs.map(y => y + shift)})) : content.wrappedRuns;
    const textHeight = leftIcon ? Math.max(content.textHeight, ICON_H) : content.textHeight + topShift;
    const stamp = isBoxLike ? chrome.stamp : undefined;
    const stampW = stamp ? stampChipW(widthOf, stamp, roles) : undefined;
    if (stampW !== undefined && stampW > w - 16) throw new Error(`stamp "${stamp}" is wider than its box (${Math.round(w)}px): shorten it or widen the box`);
    const h = (isBoxLike ? textHeight + 2 * (chrome.padY ?? BOX_PAD_Y) : textHeight) + (stamp ? STAMP_H + STAMP_GAP : 0);
    const placed = {...band, x, y, w, h, wrappedRuns} as unknown as Placed<B>; // spreading a generic loses the intersection
    if (stampW !== undefined) (placed as Placed<B> & {stampW?: number}).stampW = stampW;
    // a centred / right-aligned title: the step badge sits just before its first line, so emit needs that line's width
    if (band.type === 'box' && band.step != null && band.title && (band.align ?? (topIcon(band) ? 'center' : 'left')) !== 'left') (placed as Placed<B> & {titleW?: number}).titleW = lineWidth(widthOf, must(wrappedRuns[0]), 0);
    if (band.type === 'box') {
      const overflow: NonNullable<LaidOutBox['nowrapOverflow']> = [];
      for (const r of wrappedRuns) {
        if (!r.nowrap) continue;
        const width = textWidth(widthOf, r.text, r.size, r.weight, r.mono ? 'mono' : 'sans'), avail = wrapWidth - (r.indent ?? 0);
        if (width > avail + 0.5) overflow.push({value: r.text, width, avail, min: r.size}); // r.size: a value that may shrink is drawn at its floor by now
      }
      if (overflow.length) (placed as Placed<BoxBand> & {nowrapOverflow?: typeof overflow}).nowrapOverflow = overflow;
      const shrunk = wrappedRuns.filter(r => r.shrunkFrom !== undefined).map(r => ({value: r.text, from: r.shrunkFrom ?? r.size, to: r.size}));
      if (shrunk.length) (placed as Placed<BoxBand> & {statShrunk?: typeof shrunk}).statShrunk = shrunk;
    }
    if (chrome.tag) {
      const tw = textWidth(widthOf, chrome.tag, (roles.tag ?? TAG_SIZE), 700) + 2 * TAG_PAD_X;
      placed.tagBox = {x: chrome.tagAt === undefined ? x + w - tw - 12 : x + w * chrome.tagAt - tw / 2, y: y - TAG_H / 2, w: tw, h: TAG_H};
    }
    const name = chrome.id ? qualify(scope, chrome.id) : undefined;
    if (chrome.id && name !== undefined && (areaIds.has(name) || anchors.has(name))) claimed(name, 'a box takes an id that another box, group or row already has');
    if (chrome.id && name !== undefined) { setBox(name, {...band, x, y, w, h} as never, h); if (scope) addScoped(scopes, scope, chrome.id); }
    return placed;
  };

  const register = (id: string, rect: Rect, what: string, scope?: string): void => {
    const name = qualify(scope, id);
    if (anchors.has(name)) claimed(name, what);
    anchors.set(name, rect);
    if (scope) addScoped(scopes, scope, id);
  };
  const ctx: LayoutCtx = {
    d, roles, widthOf, tones, wrap, keepWords, space, lines, y: d.pad, laidOut, anchors, nodeBottoms, areaIds, connects, deferred, scopes,
    setBox, claimed, register, placeBoxLike, gapForLabels, areasGapFor,
    stack: (bands, padX, cw) => {
      for (const band of bands) atBand(band, () => {
        const start = laidOut.length, firstConnect = connects.length;
        layoutHandlerFor(band.type)(band as never, ctx, padX, cw);
        carryLayoutSources(band, laidOut, start);
        const ref = sourceOf(band);
        if (ref) for (let i = firstConnect; i < connects.length; i++) withSource(must(connects[i]), ref);
        const extra = bandGaps.get(band); // room for a label on the arrow down to the next band (ADR 0069 D1)
        if (extra) ctx.y += extra;
      });
    },
  };
  ctx.stack(d.bands, d.pad, contentWidth);
  // the framed groups, for connect({via}) (ADR 0069 D2): their final rectangles (a row / areas() has stretched them by now)
  const frames = laidOut.flatMap(b => b.type === 'group' && b.frame !== false ? [{x: b.x, y: b.y, w: b.w, h: b.h, id: b.id}] : []);
  for (const band of deferred) atBand(band, () => {
    const resolved = resolveConnect(band, anchors, areaIds, widthOf, roles, nodeBottoms, scopes, frames);
    connects.push(withSource(resolved, sourceOf(band)));
  });

  const contentHeight = Math.round(ctx.y - d.gap + d.pad);
  // canvas: at least its height, unless fit: 'content' (then as tall as the content; an overflow is still drawn and warned)
  const canvasHeight = d.canvas && d.canvas.fit !== 'content' ? Math.max(contentHeight, d.canvas.height) : contentHeight;

  return {...data, laidOut, canvasHeight, ...(data.canvas ? {contentHeight} : {}), connects, roles};
}

/** Fill the parts a handler created, preserving more specific marks from nested stack calls. */
function carryLayoutSources(band: Band, laidOut: LaidOutBand[], start: number): void {
  // A row of groups and areas can re-lay a group with extra height, directly rather than through stack.
  // Each cell emits one row or one group frame followed by its span. Give these groups their own marks first.
  if ((band.type === 'grouprow' || band.type === 'areas') && band.children.some(c => c.type === 'group' && sourceOf(c))) {
    let cell = start;
    for (const child of band.children) {
      const frame = must(laidOut[cell]);
      const end = cell + 1 + (frame.type === 'group' ? frame.span ?? 0 : 0);
      if (child.type === 'group') markLayoutRange(laidOut, cell, end, sourceOf(child));
      cell = end;
    }
  }
  markLayoutRange(laidOut, start, laidOut.length, sourceOf(band));
}

function markLayoutRange(laidOut: LaidOutBand[], start: number, end: number, ref: SourceRef | undefined): void {
  if (!ref) return;
  for (let i = start; i < end; i++) {
    const placed = must(laidOut[i]);
    withSource(placed, ref);
    if (placed.type === 'row' || placed.type === 'grid') {
      for (const child of placed.children) withSource(child, ref);
    }
  }
}
