// Per-band-type layout handlers for layoutBands() pass 2. Each takes the band, the LayoutCtx (cursor, anchors, laid-out list ...)
// and the x / width it is placed at; the table at the bottom is what stack() dispatches through.

import {splitAtoms, textWidth} from './atoms.ts';
import {wrapAtoms} from './wrap.ts';
import {layoutSequence, layoutTable} from './seq-table.ts';
import {layoutPlane} from './plane.ts';
import {IMAGE_PAD, layoutImage} from './image.ts';
import {layoutBars} from './bars.ts';
import {layoutDots, layoutPeople} from './people.ts';
import {layoutMath} from './math.ts';
import {layoutTimeline} from './timeline.ts';
import {layoutQuadrant} from './quadrant.ts';
import {layoutFlowShape} from './flow-shapes.ts';
import {layoutWordArt} from './wordart.ts';
import {canvasColumns, canvasRowHeights, canvasSpan} from './canvas.ts';
import {layoutTreeBand, narrowField} from './tree.ts';
import {layoutStatesBand} from './states.ts';
import {layoutCauseBand, layoutCloudBand} from './toc.ts';
import {layoutGantt} from './gantt.ts';
import {layoutClassesBand} from './classes.ts';
import {layoutBpmn} from './bpmn.ts';
import {layoutChart} from './charts.ts';
import {layoutWireframe, layoutScreens} from './wireframe.ts';
import type {GroupBand, LegendBand, ConnectBand, GroupRowBand, RowBand, GridBand, RawBand, SpacerBand, LaidOutGroup, LaidOutLegendItem, LaidOutRow, RowArrow} from './types/containers.ts';
import type {Rect} from './types/core.ts';
import type {PyramidBand, CurveBand, LaidOutPyramidLayer} from './types/figures.ts';
import type {ImageBand} from './types/image.ts';
import type {Band, LaidOutBand} from './types/index.ts';
import type {SwimlaneBand, LaidOutLane, LaidOutPhase, LaidOutSwimlane} from './types/sequence-table-swimlane.ts';
import type {BoxBand, CaptionBand, BannerBand} from './types/text-bands.ts';
import type {BandLayoutHandler, BandLayoutHandlers, LayoutCtx, Placed, RowLike} from './layout-ctx.ts';
import {PALETTE, SHADES, blendLuminance, bestTextColor, paintOf} from './tokens.ts';
import {
  BOX_PAD_X, LINE_HEIGHT_EM, LEGEND_ITEM_GAP, LEGEND_ROW_H, LEGEND_SWATCH_W, CANVAS_MIN_REGION_W, SWIMLANE_COMFY_COL, STAMP_GAP, STAMP_H, TAG_H,
  groupTitleBand, gridChildGeometry, rowChildGeometry, stampChipW,
} from './layout-util.ts';
import {lineWidth} from './layout-text.ts';
import {parseRef, resolveConnect} from './layout-connect.ts';

type BandOf<T extends Band['type']> = Extract<Band, {type: T}>;
const rectOf = (p: Rect): Rect => ({x: p.x, y: p.y, w: p.w, h: p.h});

/**
 * A band laid out by one call (`layout`) that returns its own placement: its id (and its marks' ids, when `anchorWhat` is given)
 * become anchors, it is pushed, and the cursor moves past it. `what` / `anchorWhat` finish the duplicate-id message.
 */
type Describe<B> = string | ((band: B) => string);
const say = <B,>(s: Describe<B>, band: B): string => typeof s === 'string' ? s : s(band);
function placedBand<B extends Band & {id?: string}, P extends LaidOutBand & Rect>(
  layout: (band: B, x: number, y: number, w: number, ctx: LayoutCtx) => P,
  what: Describe<B>,
  anchorWhat?: Describe<B>,
): BandLayoutHandler<B> {
  return (band, ctx, padX, cw) => {
    const placed = layout(band, padX, ctx.y, cw, ctx);
    if (band.id) ctx.register(band.id, rectOf(placed), say(what, band));
    if (anchorWhat !== undefined) for (const a of (placed as unknown as {anchors: (Rect & {id: string})[]}).anchors) ctx.register(a.id, rectOf(a), say(anchorWhat, band));
    ctx.laidOut.push(placed);
    ctx.y += placed.h + ctx.d.gap;
  };
}

function layoutSpacer(band: SpacerBand, ctx: LayoutCtx): void { ctx.y += band.h; }

function layoutSeqTable(band: Band & {type: 'sequence' | 'table'}, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  const placed = band.type === 'sequence' ? layoutSequence(band, padX, ctx.y, cw, widthOf, roles) : layoutTable(band, padX, ctx.y, cw, widthOf, roles);
  if (band.id) ctx.anchors.set(band.id, {x: placed.x, y: placed.y, w: placed.w, h: placed.h});
  ctx.laidOut.push(placed);
  ctx.y += placed.h + d.gap;
}

function layoutWireframeBand(band: Band & {type: 'wireframe' | 'screens'}, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, widthOf} = ctx;
  const placed = band.type === 'wireframe' ? layoutWireframe(band, padX, ctx.y, cw, widthOf) : layoutScreens(band, padX, ctx.y, cw, widthOf);
  for (const a of placed.anchors) ctx.anchors.set(a.id, {x: a.x, y: a.y, w: a.w, h: a.h});
  ctx.laidOut.push(placed);
  ctx.y += placed.h + d.gap;
}

function layoutRaw(band: RawBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const placed = {...band, x: padX, y: ctx.y, w: cw};
  if (band.id) ctx.anchors.set(band.id, {x: placed.x, y: placed.y, w: placed.w, h: placed.h});
  ctx.laidOut.push(placed);
  ctx.y += band.h + (band.h > 0 ? ctx.d.gap : 0);
}

function layoutFlowShapeBand(band: Band & {type: 'chevron' | 'funnel' | 'cycle' | 'venn' | 'concentric'}, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  const placed = layoutFlowShape(band, padX, ctx.y, cw, widthOf, roles);
  if (band.id) { if (ctx.anchors.has(band.id)) ctx.claimed(band.id, `a ${band.type} takes an id that another anchor already has`); ctx.anchors.set(band.id, placed); }
  for (const a of placed.anchors) { if (ctx.anchors.has(a.id)) ctx.claimed(a.id, `a ${band.type} item takes an id that another anchor already has`); ctx.anchors.set(a.id, a); }
  ctx.laidOut.push(placed); ctx.y += placed.h + d.gap;
}

function layoutWordArtBand(band: Band & {type: 'wordart'}, ctx: LayoutCtx, padX: number, cw: number): void {
  const placed = layoutWordArt(band, padX, ctx.y, cw, ctx.widthOf, ctx.roles);
  if (band.id) { if (ctx.anchors.has(band.id)) ctx.claimed(band.id, 'a wordart takes an id that another anchor already has'); ctx.anchors.set(band.id, placed); }
  ctx.laidOut.push(placed); ctx.y += placed.h + ctx.d.gap;
}

/** caption / box / banner (and, as before, anything a handler does not claim). */
function layoutBoxLikeBand(band: CaptionBand | BoxBand | BannerBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const isBoxLike = band.type === 'box' || band.type === 'banner';
  const placed = ctx.placeBoxLike(band, padX, ctx.y, cw, isBoxLike);
  ctx.laidOut.push(placed);
  ctx.y += placed.h + ctx.d.gap;
}

// row({id}): the row itself is an anchor, and so is each of its columns (`id#5`, `id#5-6`; the n-th child on a row without `cols`).
function registerRowSlots(ctx: LayoutCtx, id: string | undefined, band: RowLike, rowTop: number, rowHeight: number, padX: number, cw: number, gap: number, placed: Rect[]): void {
  if (!id) return;
  if (ctx.anchors.has(id)) ctx.claimed(id, 'a row takes an id that another box, group or row already has');
  ctx.anchors.set(id, {x: padX, y: rowTop, w: cw, h: rowHeight});
  ctx.areaIds.add(id);
  if (band.cols) {
    const cols = band.cols, colW = (cw - (cols - 1) * gap) / cols;
    for (let a = 1; a <= cols; a++) for (let b = a; b <= cols; b++) {
      const key = b === a ? `${id}#${a}` : `${id}#${a}-${b}`;
      if (ctx.anchors.has(key)) ctx.claimed(key, 'a row column collides with an existing id');
      ctx.anchors.set(key, {x: padX + (a - 1) * (colW + gap), y: rowTop, w: (b - a + 1) * colW + (b - a) * gap, h: rowHeight});
      ctx.areaIds.add(key);
    }
  } else {
    const put = (key: string, r: Rect) => { if (ctx.anchors.has(key)) ctx.claimed(key, 'a row column collides with an existing id'); ctx.anchors.set(key, r); ctx.areaIds.add(key); };
    placed.forEach((r, i) => put(`${id}#${i + 1}`, {x: r.x, y: rowTop, w: r.w, h: rowHeight}));
    for (let a = 0; a < placed.length; a++) for (let b = a + 1; b < placed.length; b++) put(`${id}#${a + 1}-${b + 1}`, {x: placed[a].x, y: rowTop, w: placed[b].x + placed[b].w - placed[a].x, h: rowHeight});
  }
}

function layoutGroup(band: GroupBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  const gp = band.pad ?? 16;
  const startY = ctx.y;
  const frame: LaidOutGroup = {type: 'group', x: padX, y: startY, w: cw, h: 0, tone: band.tone, dashed: band.dashed, frame: band.frame, id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until})};
  ctx.laidOut.push(frame); // pushed first so the frame is drawn under its children
  ctx.y += gp;
  if (band.title) {
    const t = ctx.placeBoxLike({...groupTitleBand(band), reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until})} as CaptionBand, padX + gp, ctx.y, cw - 2 * gp, false);
    const inkW = Math.max(0, ...t.wrappedRuns.flatMap(r => r.lines.map((_, i) => lineWidth(widthOf, r, i))));
    const inkX = t.align === 'center' ? t.x + (t.w - inkW) / 2 : t.align === 'right' ? t.x + t.w - inkW : t.x;
    t.inkBox = {x: inkX, y: t.y, w: inkW, h: t.h};
    ctx.laidOut.push(t);
    ctx.y += t.h + d.gap / 2;
  }
  ctx.stack(band.children, padX + gp, cw - 2 * gp);
  ctx.y = ctx.y - d.gap + gp;
  if (band.stamp) {
    frame.stamp = band.stamp;
    frame.stampW = stampChipW(widthOf, band.stamp, roles);
    if (frame.stampW > cw - 16) throw new Error(`stamp "${band.stamp}" is wider than its group (${Math.round(cw)}px): shorten it or widen the group`);
    ctx.y += STAMP_H + STAMP_GAP;
  }
  frame.h = ctx.y - startY;
  if (band.id) {
    if (ctx.anchors.has(band.id)) ctx.claimed(band.id, 'a group takes an id that another box, group or row already has');
    ctx.anchors.set(band.id, {x: frame.x, y: frame.y, w: frame.w, h: frame.h});
  }
  ctx.y += d.gap;
}

function layoutImageBand(band: ImageBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  const placed = layoutImage(band, padX, ctx.y, cw, widthOf, roles);
  if (band.id) {
    if (ctx.anchors.has(band.id)) ctx.claimed(band.id, 'an image takes an id that another anchor already has');
    ctx.anchors.set(band.id, {x: placed.x, y: placed.y, w: placed.w, h: placed.h});
  }
  for (const a of placed.anchors) {
    if (ctx.anchors.has(a.id)) ctx.claimed(a.id, 'a mark takes an id that another anchor already has');
    ctx.anchors.set(a.id, {x: a.x, y: a.y, w: a.w, h: a.h});
  }
  ctx.laidOut.push(placed);
  if (band.children?.length) { // the picture is a backdrop: its parts stack from the top inside it, drawn after it
    const pad = band.pad ?? IMAGE_PAD;
    ctx.y = placed.y + pad;
    ctx.stack(band.children, placed.x + pad, placed.w - 2 * pad);
    const bottom = ctx.y - d.gap, room = placed.y + placed.h - pad;
    if (bottom > room + 0.5) throw new Error(`image(): the parts over it need ${Math.round(bottom - placed.y + pad)}px of height but the picture is ${placed.h}px high (make the picture bigger with width / height, or use less content)`);
  }
  ctx.y = placed.y + placed.h + d.gap;
}

function layoutSwimlane(band: SwimlaneBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  let labelW = band.labelW ?? 128, colGap = band.colGap ?? 28, padX2 = 14;
  const padY = 14;
  const colWAt = (): number => (cw - labelW - 2 * padX2 - (band.cols - 1) * colGap) / band.cols;
  if (band.fit === 'shrink' && colWAt() < SWIMLANE_COMFY_COL) { // free room for the columns: lane labels and gaps give way first, a step at a time
    for (const [lw, cg, px] of [[104, 20, 12], [88, 12, 8]]) {
      labelW = Math.min(labelW, lw); colGap = Math.min(colGap, cg); padX2 = Math.min(padX2, px);
      if (colWAt() >= SWIMLANE_COMFY_COL) break;
    }
  }
  const bodyX = padX + labelW, bodyW = cw - labelW;
  const colW = colWAt();
  if (colW < 60) throw new Error(`swimlane(): ${band.cols} columns leave only ${Math.round(colW)}px each — widen the diagram, shrink labelW, or use fewer columns`);
  const startY = ctx.y;
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
    return ctx.placeBoxLike({...st, padX: st.padX ?? 12, padY: st.padY ?? 10}, x, 0, w, true);
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
  const frame: LaidOutSwimlane = {type: 'swimlane', x: padX, y: startY, w: cw, h: y - startY, labelW, bodyX, phaseH, phases, lanes, ...(band.fit === 'shrink' ? narrowField(stepsPlaced.flatMap(s => s.wrappedRuns.map(r => r.lines))) : {}), id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until})};
  ctx.laidOut.push(frame); // before its steps so the lanes draw underneath
  if (band.id) {
    if (ctx.anchors.has(band.id)) ctx.claimed(band.id, 'a swimlane takes an id that another anchor already has');
    ctx.anchors.set(band.id, {x: frame.x, y: frame.y, w: frame.w, h: frame.h});
  }
  for (const st of stepsPlaced) {
    const ln = lanes[laneIndex.get(st.lane) as number]; // an unknown lane id throws here, as before
    st.y = ln.blockTop + (st.row ?? 0) * (ln.maxStep + rowGap) + (ln.maxStep - st.h) / 2;
    if (st.id) ctx.anchors.set(st.id, {x: st.x, y: st.y, w: st.w, h: st.h});
    if (st.tagBox) st.tagBox.y = st.y - st.tagBox.h / 2;
    ctx.laidOut.push(st);
  }
  ctx.y = y + d.gap;
}

function layoutLegend(band: LegendBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
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
    for (const it of r) { placedItems.push({...it, x, y: ctx.y + ri * (LEGEND_ROW_H + 8)}); x += it.w + LEGEND_ITEM_GAP; }
  });
  const h = rows.length * LEGEND_ROW_H + (rows.length - 1) * 8;
  ctx.laidOut.push({type: 'legend', x: padX, y: ctx.y, w: cw, h, items: placedItems});
  ctx.y += h + d.gap;
}

function layoutConnect(band: ConnectBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {roles, widthOf} = ctx;
  // Resolved immediately (not deferred) so a loop-under route can
  // reserve real vertical space for its dip + label — a zero-height
  // overlay resolved only after the whole stack is laid out would let
  // the return path silently collide with whatever comes next (this
  // was caught by lint-svg.ts's container-overflow check on the first
  // real test: a loop-under label overlapped the following banner).
  // When an anchor is not laid out yet (connect() declared before a box it
  // names) resolution waits until the whole stack is placed; such a
  // connector reserves no loop-under space.
  if (!ctx.anchors.has(parseRef(band.from).id) || !ctx.anchors.has(parseRef(band.to).id)) { ctx.deferred.push(band); return; }
  const resolved = resolveConnect(band, ctx.anchors, ctx.areaIds, widthOf, roles, ctx.nodeBottoms);
  ctx.connects.push(resolved);
  // a bracket / callout under its boxes needs room for its line and label, as a loop-under does
  if (band.annot?.side === 'below') ctx.y = Math.max(ctx.y, ...resolved.pathSegments.map(r => r.y + r.h), resolved.labelBox ? resolved.labelBox.y + resolved.labelBox.h : 0) + 8;
  if (band.route === 'loop-under') {
    const labelClearance = band.label ? 24 : 8;
    ctx.y = Math.max(resolved.from.y, resolved.to.y, ctx.y) + band.dip + labelClearance;
  }
}

function layoutGroupRow(band: GroupRowBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d} = ctx;
  // Each child is laid out as if stacked alone at its own x / width, all starting at the row's top; afterwards every
  // frame / box is stretched to the tallest one (a group's inner content keeps its natural height).
  const rowGap = ctx.gapForLabels(band, cw);
  const {widths, xOffsets} = rowChildGeometry({...band, gap: rowGap}, cw);
  const rowTop = ctx.y;
  const stretch: ((h: number) => void)[] = [];
  let rowHeight = 0;
  band.children.forEach((child, i) => {
    ctx.y = rowTop;
    const x = padX + xOffsets[i];
    if (child.type === 'box') {
      const c = ctx.placeBoxLike(child, x, rowTop, widths[i], true);
      const rw: LaidOutRow = {type: 'row', x, y: rowTop, w: widths[i], h: c.h, children: [c], arrows: []};
      ctx.laidOut.push(rw);
      rowHeight = Math.max(rowHeight, c.h);
      stretch.push(h => { c.h = rw.h = h; if (c.id) ctx.setBox(c.id, c as never, h); });
    } else {
      const frame = ctx.laidOut.length;
      ctx.stack([child], x, widths[i]);
      const f = ctx.laidOut[frame] as LaidOutGroup; // ctx.stack() pushes a group's frame first
      rowHeight = Math.max(rowHeight, f.h);
      stretch.push(h => { f.h = h; if (child.id) ctx.anchors.set(child.id, {x: f.x, y: f.y, w: f.w, h}); });
    }
  });
  stretch.forEach(s => s(rowHeight));
  registerRowSlots(ctx, band.id, band, rowTop, rowHeight, padX, cw, rowGap, widths.map((w, i) => ({x: padX + xOffsets[i], y: rowTop, w, h: rowHeight})));
  ctx.y = rowTop + rowHeight + d.gap;
}

function layoutRow(band: RowBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d} = ctx;
  const rowGap = ctx.gapForLabels(band, cw);
  const {widths, xOffsets} = rowChildGeometry({...band, gap: rowGap}, cw);
  const placedChildren = band.children.map((child, i) =>
    ctx.placeBoxLike(child, padX + xOffsets[i], ctx.y, widths[i], true));
  const rowHeight = Math.max(...placedChildren.map(c => c.h));
  for (const c of placedChildren) { c.h = rowHeight; if (c.id) ctx.setBox(c.id, c as never, rowHeight); }

  const arrows: RowArrow[] = [];
  if (band.arrows === 'between') {
    for (let i = 0; i < placedChildren.length - 1; i++) {
      const a = placedChildren[i], b = placedChildren[i + 1];
      const y = ctx.y + rowHeight / 2;
      arrows.push({x1: a.x + a.w, y1: y, x2: b.x, y2: y});
    }
  }

  registerRowSlots(ctx, band.id, band, ctx.y, rowHeight, padX, cw, rowGap, placedChildren);
  ctx.laidOut.push({type: 'row', id: band.id, x: padX, y: ctx.y, w: cw, h: rowHeight, children: placedChildren, arrows});
  ctx.y += rowHeight + d.gap;
}

function layoutCanvasGrid(band: GridBand & {canvas: NonNullable<GridBand['canvas']>}, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, widthOf} = ctx;
  const cv = band.canvas, gap = band.gap, top0 = ctx.y;
  // a region's pill sits on its top edge, half above it: the rows under the first keep it clear of the box above
  // (and of the caption above the first row)
  const tagged = (row: (r: number) => boolean): boolean => band.children.some((c, i) => c.tag && row(cv.place[i].row));
  const rowGap = tagged(r => r > 0) ? Math.max(gap, TAG_H / 2 + 4) : gap;
  if (cv.title) {
    const t = ctx.placeBoxLike({type: 'caption', text: cv.title, align: 'left', role: 'title', bold: true, tone: 'text', mono: false} as CaptionBand, padX, ctx.y, cw, false);
    ctx.laidOut.push(t);
    ctx.y += t.h + Math.max(d.gap / 2, tagged(r => r === 0) ? TAG_H / 2 + 4 : 0);
  }
  // every edge on the 4px grid the emitter snaps shapes to, so neighbouring regions keep one straight edge and even gutters
  const top = Math.ceil(ctx.y / 4 - 1e-6) * 4, cols = canvasColumns(cv, padX, cw, gap);
  const placed = band.children.map((child, i) => {
    const s = canvasSpan(cols, cv.place[i]);
    const name = child.title ?? `region ${i + 1}`;
    if (s.w < CANVAS_MIN_REGION_W) throw new Error(`canvas("${cv.template}"): region "${name}" is only ${Math.max(0, Math.round(s.w))}px wide (at least ${CANVAS_MIN_REGION_W}px): widen the figure (diagram({width})) or use a smaller gap`);
    const p = ctx.placeBoxLike(child, s.x, top, s.w, true);
    // a word longer than the region is placed whole by the wrapper (it has no place to break) and would run out of the box
    const room = s.w - 2 * (child.padX ?? BOX_PAD_X) + 0.5;
    for (const r of p.wrappedRuns) for (const line of r.lines) for (const atom of splitAtoms(line)) {
      if (textWidth(widthOf, atom, r.size, r.weight, r.mono ? 'mono' : 'sans') + (r.indent ?? 0) > room) throw new Error(`canvas("${cv.template}"): "${atom.slice(0, 40)}" in region "${name}" is wider than the region (${Math.round(room)}px of text): break the word (a space or a shorter word), or widen the figure`);
    }
    return p;
  });
  // the canvas keeps its aspect, except on a slide canvas, where it never grows past the slide's height for that alone
  const aspectH = cv.aspect * cw, slideRoom = d.canvas ? d.canvas.height - d.pad - top - 4 * cv.rowW.length /* the 4px grid */ : Infinity;
  const rows = canvasRowHeights(cv, placed.map(p => p.h), rowGap, cv.h ?? Math.max(0, Math.min(aspectH, slideRoom)));
  const total = rows.reduce((a, b) => a + b, 0) + rowGap * (rows.length - 1);
  if (cv.h !== undefined && total > cv.h + 0.5) throw new Error(`canvas("${cv.template}"): the regions need ${Math.ceil(total)}px of height but h is ${cv.h}px (shorten the text, widen the figure, or leave h out)`);
  const rowY = [top];
  rows.forEach((v, r) => rowY.push(rowY[r] + Math.ceil(v / 4 - 1e-6) * 4 + rowGap));
  placed.forEach((p, i) => {
    const pl = cv.place[i], h = rowY[pl.row + pl.rs] - rowGap - rowY[pl.row];
    p.y = rowY[pl.row]; p.h = h;
    if (p.tagBox) p.tagBox.y = p.y - p.tagBox.h / 2;
    if (p.id) ctx.setBox(p.id, p as never, h);
  });
  ctx.laidOut.push({type: 'grid', x: padX, y: top0, w: cw, children: placed});
  ctx.y = rowY[rows.length] - rowGap + d.gap;
}

function layoutPlainGrid(band: GridBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d} = ctx;
  const gridStartY = ctx.y;
  const {cellWidth} = gridChildGeometry(band, cw);
  const cols = band.cols;
  const placedRows: Placed<BoxBand>[] = [];
  for (let i = 0; i < band.children.length; i += cols) {
    const rowChildren = band.children.slice(i, i + cols);
    const placed = rowChildren.map((child, j) =>
      ctx.placeBoxLike(child, padX + j * (cellWidth + band.gap), ctx.y, cellWidth, true));
    const rowHeight = Math.max(...placed.map(c => c.h));
    for (const c of placed) { c.h = rowHeight; if (c.id) ctx.setBox(c.id, c as never, rowHeight); }
    placedRows.push(...placed);
    ctx.y += rowHeight + band.gap; // this row's gap; replaced by d.gap below after the loop
  }
  ctx.laidOut.push({type: 'grid', x: padX, y: gridStartY, w: cw, children: placedRows});
  ctx.y += d.gap - band.gap; // swap the last grid-row's internal gap for the between-bands gap
}

function layoutPyramid(band: PyramidBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d, roles, widthOf} = ctx;
  const paint = paintOf(d.appearance);
  const n = band.layers.length;
  const baseWidth = band.width ?? Math.min(cw, 520);
  const apexWidth = baseWidth * band.apexRatio;
  const layerH = band.layerHeight;
  const totalH = n * layerH;
  const cx = padX + cw / 2;
  const layersOut: LaidOutPyramidLayer[] = [];
  for (let i = 0; i < n; i++) { // i=0 is the bottom (widest) layer
    const bottomY = ctx.y + totalH - i * layerH;
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
  ctx.laidOut.push({type: 'pyramid', x: cx - baseWidth / 2, y: ctx.y, w: baseWidth, h: totalH, day: d.day, layers: layersOut});
  ctx.y += totalH + d.gap;
}

function layoutCurve(band: CurveBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const {d} = ctx;
  const w = band.width ?? cw;
  const h = band.height;
  const x = padX + (cw - w) / 2;
  const y = ctx.y;
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
  ctx.laidOut.push({
    type: 'curve', x, y, w, h, axisX, axisRight, axisTop, axisBottom, points,
    yTopLabel: band.yTopLabel, yBottomLabel: band.yBottomLabel, xLabel: band.xLabel,
  });
  ctx.y += h + d.gap;
}

const layoutTimelineBand = placedBand((band: BandOf<'timeline'>, x, y, w, ctx) => layoutTimeline(band, x, y, w, ctx.widthOf, ctx.roles), 'a timeline takes an id that another anchor already has');
const layoutBpmnBand = placedBand((band: BandOf<'bpmn'>, x, y, w, ctx) => layoutBpmn(band, x, y, w, ctx.widthOf, ctx.roles), 'a bpmn diagram takes an id that another anchor already has', 'a bpmn node takes an id that another anchor already has');
const layoutClasses = placedBand((band: BandOf<'classes'>, x, y, w, ctx) => layoutClassesBand(band, x, y, w, ctx.widthOf, ctx.roles), 'a class diagram takes an id that another anchor already has', 'a class takes an id that another anchor already has');
const layoutGanttBand = placedBand((band: BandOf<'gantt'>, x, y, w, ctx) => layoutGantt(band, x, y, w, ctx.widthOf, ctx.roles), 'a gantt takes an id that another anchor already has', 'a gantt task takes an id that another anchor already has');
const layoutCauseOrCloud = placedBand((band: Band & {type: 'cause' | 'cloud'}, x, y, w, ctx) => band.type === 'cause' ? layoutCauseBand(band, x, y, w, ctx.widthOf, ctx.roles) : layoutCloudBand(band, x, y, w, ctx.widthOf, ctx.roles),
  band => `${band.type === 'cause' ? 'a cause tree' : 'a cloud'} takes an id that another anchor already has`,
  band => `${band.type === 'cause' ? 'a cause tree node' : 'a cloud box'} takes an id that another anchor already has`);
const layoutStates = placedBand((band: BandOf<'states'>, x, y, w, ctx) => layoutStatesBand(band, x, y, w, ctx.widthOf, ctx.roles), 'a state diagram takes an id that another anchor already has', 'a state takes an id that another anchor already has');
const layoutTree = placedBand((band: BandOf<'tree'>, x, y, w, ctx) => layoutTreeBand(band, x, y, w, ctx.widthOf, ctx.roles), 'a tree takes an id that another anchor already has', 'a tree node takes an id that another anchor already has');
const layoutBarsBand = placedBand((band: BandOf<'bars'>, x, y, w, ctx) => layoutBars(band, x, y, w, ctx.widthOf, ctx.roles), 'a bars band takes an id that another anchor already has', 'a bar takes an id that another anchor already has');
const layoutChartBand = placedBand((band: BandOf<'chart'>, x, y, w, ctx) => layoutChart(band, x, y, w, ctx.widthOf, ctx.roles), 'a chart takes an id that another anchor already has', 'a chart element takes an id that another anchor already has');
const layoutPeopleOrDots = placedBand((band: Band & {type: 'people' | 'dots'}, x, y, w, ctx) => band.type === 'people' ? layoutPeople(band, x, y, w, ctx.widthOf, ctx.d.day, ctx.roles) : layoutDots(band, x, y, w, ctx.widthOf, ctx.d.day, ctx.roles),
  band => `a ${band.type} band takes an id that another anchor already has`);
const layoutMathBand = placedBand((band: BandOf<'math'>, x, y, w, ctx) => layoutMath(band, x, y, w, ctx.roles[band.role], ctx.d.day), 'a math band takes an id that another anchor already has');
const layoutPlaneBand = placedBand((band: BandOf<'plane'>, x, y, w, ctx) => layoutPlane(band, x, y, w, ctx.widthOf, ctx.roles), 'a plane takes an id that another anchor already has');
const layoutQuadrantBand = placedBand((band: BandOf<'quadrant'>, x, y, w, ctx) => layoutQuadrant(band, x, y, w, ctx.widthOf, ctx.roles), 'a quadrant takes an id that another anchor already has', 'a quadrant item takes an id that another anchor already has');

function layoutGridBand(band: GridBand, ctx: LayoutCtx, padX: number, cw: number): void {
  if (band.canvas) layoutCanvasGrid(band as GridBand & {canvas: NonNullable<GridBand['canvas']>}, ctx, padX, cw);
  else layoutPlainGrid(band, ctx, padX, cw);
}

/**
 * The handler of every band type. Typed per key, so each handler is checked against its own band type; the `satisfies` below
 * and UnhandledBandTypes make a band type without one a compile error.
 */
export const LAYOUT_HANDLERS = {
  spacer: layoutSpacer,
  group: layoutGroup,
  sequence: layoutSeqTable,
  table: layoutSeqTable,
  image: layoutImageBand,
  timeline: layoutTimelineBand,
  bpmn: layoutBpmnBand,
  classes: layoutClasses,
  gantt: layoutGanttBand,
  cause: layoutCauseOrCloud,
  cloud: layoutCauseOrCloud,
  states: layoutStates,
  tree: layoutTree,
  bars: layoutBarsBand,
  chart: layoutChartBand,
  people: layoutPeopleOrDots,
  dots: layoutPeopleOrDots,
  math: layoutMathBand,
  wireframe: layoutWireframeBand,
  screens: layoutWireframeBand,
  swimlane: layoutSwimlane,
  legend: layoutLegend,
  connect: layoutConnect,
  raw: layoutRaw,
  grouprow: layoutGroupRow,
  row: layoutRow,
  grid: layoutGridBand,
  pyramid: layoutPyramid,
  plane: layoutPlaneBand,
  quadrant: layoutQuadrantBand,
  chevron: layoutFlowShapeBand,
  wordart: layoutWordArtBand,
  funnel: layoutFlowShapeBand,
  cycle: layoutFlowShapeBand,
  venn: layoutFlowShapeBand,
  concentric: layoutFlowShapeBand,
  curve: layoutCurve,
  caption: layoutBoxLikeBand,
  box: layoutBoxLikeBand,
  banner: layoutBoxLikeBand,
} satisfies BandLayoutHandlers;

/** Band types with no handler in LAYOUT_HANDLERS: must be `never`, so adding a band type without one fails to compile. */
export type UnhandledBandTypes = Exclude<Band['type'], keyof typeof LAYOUT_HANDLERS>;
export const ALL_BANDS_HANDLED: UnhandledBandTypes extends never ? true : never = true;

/** What stack() runs for a band: its handler, or (a type nobody claims, as always) the caption / box / banner one. */
export function layoutHandlerFor(type: Band['type']): BandLayoutHandler<never> {
  return ((LAYOUT_HANDLERS as BandLayoutHandlers)[type] ?? layoutBoxLikeBand) as BandLayoutHandler<never>;
}
