import {connectLabelWidth} from './connect-geometry.ts';
import {splitAtoms, textWidth} from './atoms.ts';
import type {LayoutCtx} from './layout-ctx.ts';
import {setScope} from './layout-placed.ts';
import {boundaryChipH, LINE_HEIGHT_EM, snapGrid, SWIMLANE_COMFY_COL} from './layout-util.ts';
import {must} from './must.ts';
import {qualify, scopeOf} from './scope-name.ts';
import {narrowField} from './tree.ts';
import type {LaidOutBox} from './types/text-bands.ts';
import type {LaidOutLane, LaidOutPhase, LaidOutSwimlane, SwimlaneBand} from './types/sequence-table-swimlane.ts';
import {wrapAtoms} from './wrap.ts';

/**
 * The ways back under a row's boxes are resolved after the layout (ctx.deferred), with the depth the row's lowest box gives them: `dip` is how far below the
 * ends they run. Their labels slide along the line to where no other flow's vertical leg (or its label) crosses them (the least covered place when there is none).
 */
function placeUnderFlows(band: SwimlaneBand, ctx: LayoutCtx, steps: LaidOutBox[], rowBottoms: Map<string, number>): void {
  const stepOf = new Map(steps.map(s => [s.id, s]));
  // where a flow end sits: x and y on its box (a side end at its @t), and which side
  const end = (ref: string) => {
    const [id, rest = ''] = ref.split(':'), [side = '', at = '0.5'] = rest.split('@'), st = must(stepOf.get(id));
    return {x: side === 'left' ? st.x : side === 'right' ? st.x + st.w : st.x + st.w * +at, y: side === 'top' ? st.y : side === 'bottom' ? st.y + st.h : st.y + st.h / 2, side};
  };
  const labelW = (label?: string): number => label ? connectLabelWidth(label, ctx.roles, ctx.widthOf) + 16 : 0;
  const unders = band.underFlows ?? [];
  unders.forEach((u, i) => {
    const a = end(u.from), b = end(u.to), y = must(rowBottoms.get(u.group)) + u.off;
    let labelAt: number | undefined;
    if (u.moveLabel && u.label) {
      // the vertical legs that cross this run (x, and the width of the chip a leg may carry): a flow's ends on a top / bottom side, an elbow into a left / right side turns 13px before it
      // (a flow that stays in one row has none); and the deeper ways back of this row, which come down to their line through it
      const legs = [
        ...(band.otherFlows ?? []).flatMap(f => {
          const [p, q] = [end(f.from), end(f.to)], side = p.side === 'top' || p.side === 'bottom' ? 0 : q.side === 'left' ? -13 : q.side === 'right' ? 13 : 0;
          return Math.min(p.y, q.y) < y && y < Math.max(p.y, q.y) ? [p.x, q.x + side].map(x => ({x, w: labelW(f.label)})) : [];
        }),
        ...unders.filter((o, j) => j !== i && o.group === u.group && o.off > u.off).flatMap(o => [end(o.from).x, end(o.to).x].map(x => ({x, w: 0}))),
      ];
      const w = labelW(u.label), lo = Math.min(a.x, b.x) + w / 2 + 4, hi = Math.max(a.x, b.x) - w / 2 - 4, mid = (a.x + b.x) / 2;
      // the place nearest the middle of the line that covers no leg or chip; when there is none, the one that covers least (the check reports what is left)
      const cover = (c: number): number => legs.reduce((sum, l) => sum + Math.max(0, w / 2 + l.w / 2 + 4 - Math.abs(c - l.x)), 0);
      let best = Infinity, at = mid;
      for (let d = 0; lo <= hi && d <= (hi - lo) / 2 + 6 && best > 0; d += 6) for (const c of [mid + d, mid - d]) if (c >= lo && c <= hi && cover(c) < best) { best = cover(c); at = c; }
      if (best < Infinity) labelAt = (at - a.x) / (b.x - a.x);
    }
    const key = `~${qualify(scopeOf(band), u.from.split(':')[0] as string)}~${i + 1}`; // what resolveConnect looks the flow up by
    ctx.nodeBottoms.set(key, y); // the line's y
    if (labelAt !== undefined) ctx.nodeBottoms.set(`${key}@`, labelAt);
  });
}
export function layoutSwimlane(band: SwimlaneBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  // a boundary's name sits in a chip across the label column: the column is never narrower than the longest name + the chip's round ends, fit: 'shrink' included
  const chipText = Math.max(0, ...(band.boundaries ?? []).filter(b => b.label).map(b => textWidth(widthOf, b.label as string, roles.note, 700)));
  const minLabelW = chipText ? Math.ceil(chipText) + 36 : 0;
  // labelW 'fit' (the default on a canvas, whose text is scaled up): the longest lane name on one line (+ the column's 24px padding), 128..30% of the width
  const fitLabel = band.labelW === 'fit' || (band.labelW === undefined && d.canvas !== undefined);
  // the canvas default gives way to the columns: never so wide that a column falls under the comfortable width (an author's 'fit' is taken as written)
  const roomForLabel = band.labelW === undefined ? cw - 2 * 14 - (band.cols - 1) * (band.colGap ?? 28) - band.cols * SWIMLANE_COMFY_COL : Infinity;
  const fitW = fitLabel ? Math.min(Math.ceil(Math.max(0, ...band.lanes.map(l => textWidth(widthOf, l.label, roles.title, 700)))) + 24, Math.floor(cw * 0.3), roomForLabel) : 0;
  let labelW = typeof band.labelW === 'number' ? band.labelW : Math.max(128, minLabelW, fitW), colGap = band.colGap ?? 28, padX2 = 14; // no labelW given: wide enough for the longest line name
  const padY = 14;
  const colWAt = (): number => (cw - labelW - 2 * padX2 - (band.cols - 1) * colGap) / band.cols;
  if (band.fit === 'shrink' && colWAt() < SWIMLANE_COMFY_COL) { // free room for the columns: lane labels and gaps give way first, a step at a time
    const steps: [number, number, number][] = [[104, 20, 12], [88, 12, 8]];
    for (const [lw, cg, px] of steps) {
      labelW = Math.min(labelW, Math.max(lw, minLabelW)); colGap = Math.min(colGap, cg); padX2 = Math.min(padX2, px);
      if (colWAt() >= SWIMLANE_COMFY_COL) break;
    }
  }
  if (minLabelW > labelW) throw new Error(`swimlane(): boundaries: the longest line name is ${Math.ceil(chipText)}px wide and needs a label column of ${minLabelW}px, but labelW is ${labelW}px — shorten the name or widen labelW`);
  const bodyX = padX + labelW;
  const colW = colWAt();
  if (colW < 60) throw new Error(`swimlane(): ${band.cols} columns leave only ${Math.round(colW)}px each — widen the diagram, ${minLabelW && labelW <= minLabelW ? `shorten the line names (they need a ${minLabelW}px label column)` : 'shrink labelW'}, or use fewer columns`);
  const top0 = ctx.y, startY = snapGrid(top0); // on the grid; the cursor moves on from where it was (no drift)
  const wrapLines = (text: string, size: number, weight: number, maxW: number) => wrapAtoms(splitAtoms(text), {maxWidth: Math.max(20, maxW), atomWidth: (a: string) => widthOf(a, size, weight, 'sans'), mode: ctx.wrap});
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
    const step = ctx.placeBoxLike({...st, padX: st.padX ?? 12, padY: st.padY ?? 10}, x, 0, w, true, scopeOf(band));
    const stepScope = scopeOf(band);
    setScope(step, stepScope); // a step's id is bare in its output; the scope says what it is called in the figure
    return step;
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
    // a row's ways back under its boxes need room below it: more than the gap to the next row (or the lane's bottom padding) is added to that gap
    const need = (r: number): number => Math.max(0, ...(band.underNeed ?? []).filter(u => u.lane === lane.id && u.row === r).map(u => u.need));
    const gapBelow = (r: number): number => r < rows - 1 ? Math.max(rowGap, need(r)) : Math.max(0, need(r) - padY);
    const rowTops: number[] = [];
    for (let r = 0, top = 0; r < rows; r++) { rowTops.push(top); top += maxStep + gapBelow(r); }
    const blockH = must(rowTops[rows - 1]) + maxStep;
    // a named boundary below this lane puts a chip across the lane border: the centred lane label leaves room for half of it
    const chipHalf = boundaryChipH(roles.note) / 2 + 2, nChip = (band.boundaries ?? []).filter(b => b.label && (b.after === lane.id || band.lanes[i - 1]?.id === b.after)).length;
    const underBelow = gapBelow(rows - 1); // the room for the last row's ways back, below the boxes and the lane's bottom padding
    const core = Math.max(blockH, labelH + (nChip ? 2 * chipHalf : 0)) + 2 * padY;
    const h = core + underBelow;
    const out = {y, h, labelLines, labelTop: y + (h - labelH) / 2, tone: lane.tone, maxStep, blockTop: y + (core - blockH) / 2, rowTops};
    y += h;
    return out;
  });
  const boundaries = (band.boundaries ?? []).map(b => {
    const at = must(laneIndex.get(b.after)), next = must(lanes[at + 1]);
    return {y: next.y, ...(b.label ? {label: b.label} : {})};
  });
  const frame: LaidOutSwimlane = {type: 'swimlane', x: padX, y: startY, w: cw, h: y - startY, labelW, bodyX, phaseH, phases, lanes, ...(boundaries.length ? {boundaries} : {}), ...(band.fit === 'shrink' ? narrowField(stepsPlaced.flatMap(s => s.wrappedRuns.map(r => r.lines))) : {}), id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until})};
  const frameScope = scopeOf(band);
  setScope(frame, frameScope);
  ctx.laidOut.push(frame); // before its steps so the lanes draw underneath
  if (band.id) {
    if (ctx.anchors.has(band.id)) ctx.claimed(band.id, 'a swimlane takes an id that another anchor already has');
    ctx.anchors.set(band.id, {x: frame.x, y: frame.y, w: frame.w, h: frame.h});
  }
  const rowBottoms = new Map<string, number>();
  for (const st of stepsPlaced) {
    const ln = must(lanes[laneIndex.get(st.lane) ?? -1], `a lane "${st.lane}" in the swimlane (a step's lane is not one of the lanes)`); // an unknown lane id throws here, as before
    const rowTop = ln.blockTop + must(must(ln.rowTops)[st.row ?? 0]);
    st.y = snapGrid(rowTop + (ln.maxStep - st.h) / 2);
    rowBottoms.set(`${st.lane}|${st.row ?? 0}`, rowTop + ln.maxStep); // where the ways back under this row start
    if (st.id) ctx.anchors.set(qualify(scopeOf(band), st.id), {x: st.x, y: st.y, w: st.w, h: st.h}); // placeBoxLike already claimed (and checked) the id; this moves it to the lane row
    if (st.tagBox) st.tagBox.y = st.y - st.tagBox.h / 2;
    ctx.laidOut.push(st);
  }
  placeUnderFlows(band, ctx, stepsPlaced, rowBottoms);
  frame.span = stepsPlaced.length;
  ctx.y = top0 + (y - startY) + d.gap;
}
