import {splitAtoms, textWidth} from './atoms.ts';
import type {LayoutCtx} from './layout-ctx.ts';
import {setScope} from './layout-placed.ts';
import {boundaryChipH, LINE_HEIGHT_EM, snapGrid, SWIMLANE_COMFY_COL} from './layout-util.ts';
import {must} from './must.ts';
import {qualify, scopeOf} from './scope-name.ts';
import {narrowField} from './tree.ts';
import type {LaidOutLane, LaidOutPhase, LaidOutSwimlane, SwimlaneTimedBand} from './types/sequence-table-swimlane.ts';
import {wrapAtoms} from './wrap.ts';

export function layoutSwimlane(band: SwimlaneTimedBand, ctx: LayoutCtx, padX: number, cw: number): void {
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
    const blockH = rows * maxStep + (rows - 1) * rowGap;
    // a named boundary below this lane puts a chip across the lane border: the centred lane label leaves room for half of it
    const chipHalf = boundaryChipH(roles.note) / 2 + 2, nChip = (band.boundaries ?? []).filter(b => b.label && (b.after === lane.id || band.lanes[i - 1]?.id === b.after)).length;
    const h = Math.max(blockH, labelH + (nChip ? 2 * chipHalf : 0)) + 2 * padY;
    const out = {y, h, labelLines, labelTop: y + (h - labelH) / 2, tone: lane.tone, maxStep, blockTop: y + (h - blockH) / 2};
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
  for (const st of stepsPlaced) {
    const ln = must(lanes[laneIndex.get(st.lane) ?? -1], `a lane "${st.lane}" in the swimlane (a step's lane is not one of the lanes)`); // an unknown lane id throws here, as before
    st.y = snapGrid(ln.blockTop + (st.row ?? 0) * (ln.maxStep + rowGap) + (ln.maxStep - st.h) / 2);
    if (st.id) ctx.anchors.set(qualify(scopeOf(band), st.id), {x: st.x, y: st.y, w: st.w, h: st.h}); // placeBoxLike already claimed (and checked) the id; this moves it to the lane row
    if (st.tagBox) st.tagBox.y = st.y - st.tagBox.h / 2;
    ctx.laidOut.push(st);
  }
  frame.span = stepsPlaced.length;
  ctx.y = top0 + (y - startY) + d.gap;
}
