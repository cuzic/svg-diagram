import {atBand} from './source-ref.ts';
import {parseRef} from './connect-geometry.ts';
import {ceil4, labelRoom} from './connect-rules.ts';
import type {LabelAxis} from './connect-rules.ts';
import {BOX_PAD_Y, colSlots, rowChildGeometry, topIcon} from './layout-util.ts';
import {must} from './must.ts';
import type {LayoutServices} from './layout-core.ts';
import type {RowLike} from './layout-ctx.ts';
import type {AreasBand, ConnectBand} from './types/containers.ts';
import type {Roles, WidthOf} from './types/core.ts';
import type {Band} from './types/index.ts';
import type {BoxBand} from './types/text-bands.ts';

type GapServices = Pick<LayoutServices, 'childrenOf' | 'stackWidthOf' | 'areasPrelayoutFor'>;

/** Find space for straight connector labels before laying out the participating bands (ADR 0069). */
export function prepareConnectorGaps(
  {childrenOf, stackWidthOf, areasPrelayoutFor}: GapServices,
  bands: Band[], labelled: readonly ConnectBand[], contentWidth: number, stackGap: number, roles: Roles, widthOf: WidthOf,
) {
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
        // the next band's top is rounded to the 4px grid (at most 2px up): the route can be 2px shorter than gap; leave those 2px too
        if (Number.isFinite(need) && stackGap - 2 < fails) extra = Math.max(extra, ceil4(need + 2) - stackGap);
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
    const out = overAreas.has(band) ? {gap: band.gap, rowGap: band.rowGap}
      : areasPrelayoutFor?.(band)?.labelGaps(band, cw, {labelled, idsIn, nodeDrop, onFrame, roles, widthOf})
        ?? {gap: band.gap, rowGap: band.rowGap};
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
          for (const cell of areasPrelayoutFor?.(b)?.groupWidths(b, cw, areasGapFor(b, cw).gap) ?? []) walk(cell.children, cell.width, over);
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
      walk(bands, contentWidth);
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
  return {gapForLabels, areasGapFor, bandGaps};
}
