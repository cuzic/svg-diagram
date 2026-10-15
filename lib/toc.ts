// The thinking processes of the Theory of Constraints (Goldratt).
//  causeTree(): entities and cause -> effect arrows that place themselves (graph-layout.ts layoutLayered), causes at the bottom and
//               effects at the top by default. Current / Future Reality Tree, Prerequisite Tree and Transition Tree are all this
//               figure: an arrow across an AND arc means "together", separate arrows mean "either".
//  cloud():     the Evaporating Cloud: five boxes in a fixed place (A the common objective, B and C the needs, D and D' the
//               conflicting wants), the arrows between them with their assumptions numbered, and the numbered list under the figure.
import {textWidth} from './atoms.ts';
import {gapFor, layeredAttempt} from './layered-route.ts';
import type {Pt} from './graph-layout.ts';
import {measureNode, nodeRuns} from './tree.ts';
import {wrapText} from './wrap.ts';
import type {FontFamily, Roles, WidthOf} from './types/core.ts';
import type {CauseBand, CauseRole, CloudArrow, CloudBand, CloudBox, LaidOutCause, LaidOutCloud} from './types/diagrams.ts';
import type {BoxTone} from './types/text-bands.ts';

// ---- cause tree -------------------------------------------------------------------------------------------------------------

const MAX_W = 200, GAP = 28, LEVEL = 64, PORT = 22; // PORT: the step between the arrows that meet one side of an entity (the arrowheads of an AND stay apart)
/** The arc across the arrows of an AND: where its ends and its middle are, as distances from the arrowheads' tips. */
const AND_END = 21, AND_PEAK = 15, AND_REACH = 10;

/** What a role looks like when the node gives no tone. `double`: the box has a second outline (the finding of the figure). */
export const CAUSE_ROLES: Record<CauseRole, {tone: BoxTone; double?: boolean}> = {
  effect: {tone: 'plain'},
  ude: {tone: 'danger'},
  root: {tone: 'accent', double: true},
  de: {tone: 'new'},
  injection: {tone: 'changed'},
  goal: {tone: 'accent', double: true},
  obstacle: {tone: 'plain'}, // drawn as a hexagon
  io: {tone: 'new'},
  action: {tone: 'changed'},
  start: {tone: 'accent', double: true},
  step: {tone: 'plain'},
  risk: {tone: 'danger'}, // drawn as a hexagon
  measure: {tone: 'changed'},
  precondition: {tone: 'removed'}, // a fact of the present nobody controls: the grey dashed box
};

export function causeTexts(band: CauseBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const n of band.nodes) out.push([n.label, roles.body, 700, 'sans'], [n.sub ?? '', roles.note, 400, 'sans']);
  return out;
}

const swap = (p: Pt): Pt => ({x: p.y, y: p.x});

/** The ids a link's `from` names, as a list. */
export const causesOf = (l: {from: string | readonly string[]}): string[] => typeof l.from === 'string' ? [l.from] : [...l.from];

export function layoutCauseBand(band: CauseBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutCause {
  const dir = band.dir ?? 'up', maxW = band.maxNodeW ?? MAX_W;
  const vertical = dir === 'up' || dir === 'down', flip = dir === 'up' || dir === 'left';
  const ids = new Set<string>();
  for (const n of band.nodes) {
    if (typeof n.id !== 'string' || !n.id) throw new Error('causeTree(): every node needs an id');
    if (typeof n.label !== 'string' || !n.label.trim()) throw new Error(`causeTree(): node "${n.id}" needs a label`);
    if (ids.has(n.id)) throw new Error(`causeTree(): duplicate node id "${n.id}"`);
    ids.add(n.id);
  }
  // one arrow per cause of a link; an AND (several causes) is a group, remembered by its effect
  const arrows: {from: string; to: string; line: 'solid' | 'dashed' | 'dotted'; back?: true; blocks?: true}[] = [];
  const groups: {to: string; arrows: number[]}[] = [];
  const pairs = new Set<string>();
  for (const l of band.links) {
    const froms = causesOf(l);
    if (!froms.length) throw new Error(`causeTree(): a link to "${l.to}" has no cause`);
    if (!ids.has(l.to)) throw new Error(`causeTree(): a link names unknown node "${l.to}"`);
    if (l.back !== undefined && (l.back !== true || typeof l.from !== 'string')) throw new Error(`causeTree(): link to "${l.to}" has back: true with ${typeof l.from === 'string' ? `back ${String(l.back)}` : 'a list of causes (an AND)'}; a return is one arrow from one cause`);
    const group = froms.length > 1 ? {to: l.to, arrows: [] as number[]} : undefined;
    for (const f of froms) {
      if (!ids.has(f)) throw new Error(`causeTree(): link ${f} -> ${l.to} names unknown node "${f}"`);
      if (f === l.to) throw new Error(`causeTree(): "${f}" cannot be its own cause`);
      if (pairs.has(`${f}\u0000${l.to}`)) throw new Error(`causeTree(): link ${f} -> ${l.to} is written twice`);
      pairs.add(`${f}\u0000${l.to}`);
      const k = arrows.push({from: f, to: l.to, line: l.kind === 'blocks' ? 'dashed' : l.line ?? 'solid', ...(l.back ? {back: true as const} : {}), ...(l.kind === 'blocks' ? {blocks: true as const} : {})}) - 1;
      group?.arrows.push(k);
    }
    if (group) groups.push(group);
  }

  const lines = new Map(band.nodes.map(n => [n.id, measureNode(n.label, n.sub, maxW, widthOf, roles)]));
  // the causes of one AND are written next to each other, so that sharing a layer they stay neighbours (an OR cause between them would cross their arrows)
  const order: string[] = [], put = (id: string): void => { if (!order.includes(id)) order.push(id); };
  for (const n of band.nodes) { put(n.id); for (const g of groups) if (g.arrows.some(k => arrows[k].from === n.id)) g.arrows.forEach(k => put(arrows[k].from)); }
  const ranked = order.map(id => band.nodes.find(n => n.id === id)!);
  // the most arrows that meet one node (each needs its own lane in the gap beside it)
  const degreeOf = (id: string): number => Math.max(arrows.filter(a => a.from === id).length, arrows.filter(a => a.to === id).length);
  const degree = Math.max(1, ...band.nodes.map(n => degreeOf(n.id)));
  // the side the arrows meet must be long enough to keep their heads apart: a box grows (its text stays centred)
  const real = new Map(band.nodes.map(n => {
    const l = lines.get(n.id)!, need = 12 + (degreeOf(n.id) - 1) * PORT;
    return [n.id, vertical ? {w: Math.max(l.w, need), h: l.h} : {w: l.w, h: Math.max(l.h, need)}];
  }));
  const nodes = ranked.map(n => ({id: n.id, size: vertical ? {w: real.get(n.id)!.h, h: real.get(n.id)!.w} : real.get(n.id)!}));
  // layered layout runs on a 'right' axis; a vertical figure is the same layout transposed, an upward / leftward one mirrored
  const groupIndex = new Map<number, number>();
  groups.forEach((g, gi) => g.arrows.forEach(k => groupIndex.set(k, gi)));
  // the figure's own point of a layout point: set once the size is known (a figure narrower than its band is centred in it)
  const placeIn = (total: {w: number; h: number}) => (p: Pt): Pt => {
    const q = vertical ? swap(p) : {...p};
    if (flip) { if (vertical) q.y = total.h - q.y; else q.x = total.w - q.x; }
    return {x: q.x + x + (w - total.w) / 2, y: q.y + y};
  };
  // the last run of each arrow of an AND, when they can carry one arc (see below): the arrows arrive on one side, all heading the
  // same way, with room before the head for the arc
  const andEnds = (g: {arrows: number[]}, pointsOf: (k: number) => Pt[]) => {
    const ends = g.arrows.map(pointsOf).map(p => ({tip: p[p.length - 1], prev: p[p.length - 2]}));
    const sgn = (v: number): number => Math.abs(v) < 0.5 ? 0 : Math.sign(v); // a last run a hair off the straight (float noise) is still straight
    const d = {x: sgn(ends[0].tip.x - ends[0].prev.x), y: sgn(ends[0].tip.y - ends[0].prev.y)};
    const along = (p: Pt): number => d.x ? p.x : p.y, cross = (p: Pt): number => d.x ? p.y : p.x;
    const aligned = ends.every(e => sgn(e.tip.x - e.prev.x) === d.x && sgn(e.tip.y - e.prev.y) === d.y && Math.abs(along(e.tip) - along(ends[0].tip)) < 1);
    const room = Math.min(...ends.map(e => Math.abs(along(e.tip) - along(e.prev))));
    return {ends, d, along, cross, ok: aligned && room >= AND_END + 1};
  };
  const declared = arrows.flatMap((a, k) => a.back ? [k] : []); // the returns the author named: laid out as the way back (index into `arrows`)
  // the returns that skip layers run in an outer lane: all of them when `returns: 'outer'` (or pdpc's default), the declared ones (`back`) when nothing is written
  const wanted: 'all' | 'declared' | undefined = band.returns === 'inline' ? undefined : (band.returns ?? band.returnsDefault) === 'outer' ? 'all' : declared.length ? 'declared' : undefined;
  const attemptWith = (returns: 'all' | 'declared' | undefined) => layeredAttempt(nodes, arrows.map(a => ({from: a.from, to: a.to})), {dir: 'right', gap: GAP, levelGap: Math.max(LEVEL, gapFor(degree)), ...(declared.length ? {back: declared} : {})}, {
    portStep: PORT, groupOf: k => groupIndex.get(k), transpose: vertical, maxAcross: w + 0.5, place: placeIn, ...(returns ? {returns} : {}), ...(band.straighten === false ? {straighten: false} : {}),
    looseOf: (rts, ly) => {
      const route = new Map<number, Pt[]>();
      ly.edges.forEach((e, i) => { if (!e.self) route.set(e.index, rts.get(i)!); });
      return groups.filter(g => !andEnds(g, k => route.get(k)!).ok).map(g => g.to);
    },
  });
  let attempt = attemptWith(wanted);
  // not written: the outer lanes give way when they do not fit the width or leave an AND undrawable that the inline run draws
  if (wanted && band.returns === undefined && attempt.lay.edges.some(e => e.outer)) {
    const inline = attemptWith(undefined);
    if (!attempt.fits || attempt.loose.length > inline.loose.length) attempt = inline;
  }
  const {lay, routes, size: total} = attempt;
  if (!attempt.fits) throw new Error(`causeTree(): the figure is ${Math.ceil(total.w)}px wide but it has ${Math.round(w)}px (use a smaller maxNodeW, dir: 'right' or 'left', or fewer entities on one level${band.returns === 'outer' ? ", or returns: 'inline'" : ''})`);
  const dx = x + (w - total.w) / 2, dy = y;
  const rectOf = (id: string) => {
    const p = lay.nodes.get(id)!, q = vertical ? {x: p.y, y: p.x, w: p.h, h: p.w} : {x: p.x, y: p.y, w: p.w, h: p.h};
    if (flip) { if (vertical) q.y = total.h - (q.y + q.h); else q.x = total.w - (q.x + q.w); }
    return {x: q.x + dx, y: q.y + dy, w: q.w, h: q.h};
  };

  const out: LaidOutCause = {
    type: 'cause', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: total.h,
    nodes: [], edges: [], ands: [], loose: attempt.loose, texts: [], anchors: [], labelBoxes: [],
  };
  for (const n of band.nodes) {
    const r = rectOf(n.id), role = CAUSE_ROLES[n.role ?? 'effect'];
    out.nodes.push({...r, tone: n.tone ?? role.tone, ...(role.double ? {double: true} : {}), ...(n.core ? {core: true} : {}), ...(n.role === 'obstacle' || n.role === 'risk' ? {hex: true} : {})});
    out.anchors.push({id: n.id, ...r});
    const l = lines.get(n.id)!;
    out.texts.push(...nodeRuns({x: r.x + (r.w - l.w) / 2, y: r.y + (r.h - l.h) / 2, w: l.w}, l, roles));
    out.labelBoxes.push({label: n.label, ...r});
  }
  const drawn = new Map<number, number>(); // arrow index -> index in out.edges
  for (const [i, e] of lay.edges.entries()) {
    if (e.self) continue;
    drawn.set(e.index, out.edges.length);
    out.edges.push({from: e.from, to: e.to, points: routes.get(i)!, line: arrows[e.index].line, ...(arrows[e.index].back ? {back: true as const} : {}), ...(e.outer ? {outer: true as const} : {}), ...(arrows[e.index].blocks ? {kind: 'blocks' as const} : {})});
  }
  // an AND: an arc across the last run of each of its arrows, a little before the arrowheads. It needs the arrows to arrive on
  // one side of the effect, all heading the same way, with room before the head for the arc
  for (const g of groups) {
    const {ends, d, cross, ok} = andEnds(g, k => out.edges[drawn.get(k)!].points);
    if (!ok) continue;
    const us = ends.map(e => cross(e.tip)), tip = ends[0].tip;
    // the arc ends short of the nearest other arrow into this effect (another AND's arc, or an arrow of its own), so two arcs never touch
    const others = out.edges.filter((e, k) => e.to === g.to && !g.arrows.some(a => drawn.get(a) === k)).map(e => cross(e.points[e.points.length - 1]));
    const reachTo = (u: number, sign: 1 | -1): number => Math.min(AND_REACH, ...others.filter(o => (o - u) * sign > 0).map(o => Math.abs(o - u) / 2 - 5));
    const lo = Math.min(...us) - reachTo(Math.min(...us), -1), hi = Math.max(...us) + reachTo(Math.max(...us), 1);
    const at = (u: number, dist: number): Pt => d.x ? {x: tip.x - d.x * dist, y: u} : {x: u, y: tip.y - d.y * dist};
    out.ands.push({to: g.to, from: g.arrows.map(k => arrows[k].from), p0: at(lo, AND_END), c: at((lo + hi) / 2, 2 * AND_PEAK - AND_END), p1: at(hi, AND_END)});
  }
  return out;
}

// ---- evaporating cloud ------------------------------------------------------------------------------------------------------

const KEYS = ['a', 'b', 'c', 'd', 'd2'] as const;
const LETTER = {a: 'A', b: 'B', c: 'C', d: 'D', d2: "D'"} as const;
const ARROWS: CloudArrow[] = ['ab', 'ac', 'bd', 'cd', 'dd'];
const CLOUD_W = 220, CLOUD_GAP_MIN = 110, CLOUD_GAP_MAX = 170, ROW_GAP = 96, LIST_GAP = 28, NUM_GAP = 8;

const boxText = (k: typeof KEYS[number], v: CloudBox): string => `${LETTER[k]}：${typeof v === 'string' ? v : v.text}`;
const injectionText = (t: string): string => `→ ${t}`;
/** The number of each assumption (in the order written) and, per arrow, the chip text that lists its numbers. */
function numbering(band: CloudBand): {chip: Partial<Record<CloudArrow, string>>; n: number[]} {
  const by: Partial<Record<CloudArrow, number[]>> = {};
  (band.assumptions ?? []).forEach((a, i) => (by[a.on] ??= []).push(i + 1));
  return {chip: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.join(',')])), n: (band.assumptions ?? []).map((_, i) => i + 1)};
}

export function cloudTexts(band: CloudBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const k of KEYS) out.push([boxText(k, band[k]), roles.body, 700, 'sans']);
  const num = numbering(band);
  for (const t of Object.values(num.chip)) out.push([t, roles.note, 400, 'sans']);
  for (const i of num.n) out.push([`${i}.`, roles.note, 400, 'sans']);
  for (const a of band.assumptions ?? []) out.push([a.text, roles.note, 400, 'sans'], ...(a.injection ? [[injectionText(a.injection), roles.note, 400, 'sans'] as [string, number, number, FontFamily]] : []));
  if (band.conflictLabel) out.push([band.conflictLabel, roles.note, 400, 'sans']);
  return out;
}

export function layoutCloudBand(band: CloudBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutCloud {
  const S = roles.note, maxW = band.maxNodeW ?? CLOUD_W;
  const ids = new Set<string>();
  for (const k of KEYS) {
    const v = band[k], text = typeof v === 'string' ? v : v?.text;
    if (typeof text !== 'string' || !text.trim()) throw new Error(`cloud(): box ${LETTER[k]} needs a text`);
    const id = typeof v === 'string' ? undefined : v.id;
    if (id !== undefined) { if (ids.has(id)) throw new Error(`cloud(): duplicate box id "${id}"`); ids.add(id); }
  }
  for (const a of band.assumptions ?? []) {
    if (!ARROWS.includes(a.on)) throw new Error(`cloud(): an assumption sits on ${ARROWS.map(k => `'${k}'`).join(', ')} (got ${String(a.on)})`);
    if (typeof a.text !== 'string' || !a.text.trim()) throw new Error('cloud(): every assumption needs a text');
  }
  const colW = Math.min(maxW, Math.floor((w - 2 * CLOUD_GAP_MIN) / 3));
  if (colW < 120) throw new Error(`cloud(): the figure has ${Math.round(w)}px, too narrow for five boxes and the arrows between them (needs ${3 * 120 + 2 * CLOUD_GAP_MIN}px)`);
  const lines = Object.fromEntries(KEYS.map(k => [k, measureNode(boxText(k, band[k]), undefined, colW, widthOf, roles)])) as Record<typeof KEYS[number], ReturnType<typeof measureNode>>;
  const boxW = Math.max(...KEYS.map(k => lines[k].w)), H = Math.max(lines.b.h, lines.c.h, lines.d.h, lines.d2.h), hA = lines.a.h;
  const gap = Math.min(CLOUD_GAP_MAX, Math.floor((w - 3 * boxW) / 2)), figW = 3 * boxW + 2 * gap, rowsH = 2 * H + ROW_GAP;
  const figH = Math.max(rowsH, hA), top = (figH - rowsH) / 2; // a tall A makes the figure taller; the rows stay centred beside it
  const x0 = x + (w - figW) / 2, x1 = x0 + boxW + gap, x2 = x1 + boxW + gap;
  const at = {
    a: {x: x0, y: y + figH / 2 - hA / 2, w: boxW, h: hA}, b: {x: x1, y: y + top, w: boxW, h: H}, c: {x: x1, y: y + top + H + ROW_GAP, w: boxW, h: H},
    d: {x: x2, y: y + top, w: boxW, h: H}, d2: {x: x2, y: y + top + H + ROW_GAP, w: boxW, h: H},
  };
  const defaultTone: Record<typeof KEYS[number], BoxTone> = {a: 'accent', b: 'plain', c: 'plain', d: 'plain', d2: 'plain'};
  const out: LaidOutCloud = {type: 'cloud', id: band.id, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: figH, nodes: [], edges: [], chips: [], texts: [], anchors: [], labelBoxes: []};
  for (const k of KEYS) {
    const v = band[k], r = at[k];
    out.nodes.push({...r, key: k, tone: (typeof v === 'string' ? undefined : v.tone) ?? defaultTone[k], ...(typeof v !== 'string' && v.id ? {id: v.id} : {})});
    if (typeof v !== 'string' && v.id) out.anchors.push({id: v.id, ...r});
    out.texts.push(...nodeRuns(r, lines[k], roles));
    out.labelBoxes.push({label: boxText(k, v), ...r});
  }

  // arrows: a need points at the objective, a want at its need ("in order to A we must B, in order to B we must D")
  const cyB = at.b.y + H / 2, cyC = at.c.y + H / 2, cyA = at.a.y + hA / 2, off = Math.min(12, hA / 2 - 8), midX = at.a.x + boxW + gap / 2;
  const edge = (arrow: CloudArrow, points: Pt[]) => out.edges.push({arrow, points});
  edge('ab', [{x: x1, y: cyB}, {x: midX, y: cyB}, {x: midX, y: cyA - off}, {x: x0 + boxW, y: cyA - off}]);
  edge('ac', [{x: x1, y: cyC}, {x: midX, y: cyC}, {x: midX, y: cyA + off}, {x: x0 + boxW, y: cyA + off}]);
  edge('bd', [{x: x2, y: cyB}, {x: x1 + boxW, y: cyB}]);
  edge('cd', [{x: x2, y: cyC}, {x: x1 + boxW, y: cyC}]);
  const cx = x2 + boxW / 2, y0 = y + top + H;
  edge('dd', [{x: cx, y: y0}, {x: cx, y: y0 + ROW_GAP * 0.3}, {x: cx + 10, y: y0 + ROW_GAP * 0.45}, {x: cx - 10, y: y0 + ROW_GAP * 0.55}, {x: cx, y: y0 + ROW_GAP * 0.7}, {x: cx, y: y0 + ROW_GAP}]);

  // the numbers of the assumptions, in a white chip on their arrow
  const num = numbering(band), chipH = S + 8;
  const chipAt: Record<CloudArrow, Pt> = {
    ab: {x: midX, y: (cyB + cyA - off) / 2}, ac: {x: midX, y: (cyC + cyA + off) / 2},
    bd: {x: (x1 + boxW + x2) / 2, y: cyB}, cd: {x: (x1 + boxW + x2) / 2, y: cyC}, dd: {x: 0, y: y0 + ROW_GAP / 2},
  };
  const chip = (arrow: CloudArrow, text: string, cxm: number, cym: number, conflict = false): void => {
    const cw = Math.ceil(textWidth(widthOf, text, S, 400)) + 12;
    out.chips.push({text, x: cxm - cw / 2, y: cym - chipH / 2, w: cw, h: chipH, tx: cxm, ty: cym - chipH / 2 + S + 2, size: S, arrow, ...(conflict ? {conflict: true} : {})});
  };
  const widthOfChip = (text: string): number => Math.ceil(textWidth(widthOf, text, S, 400)) + 12;
  for (const arrow of ARROWS) {
    const text = num.chip[arrow];
    if (!text) continue;
    // beside the zigzag: to its right, or to its left when the right would leave the figure
    if (arrow === 'dd') {
      const cw = widthOfChip(text), right = cx + 22 + cw / 2, left = right + cw / 2 > x + w;
      // a conflict label also sits on the left: the two chips stack (the label above, the numbers below)
      chip(arrow, text, left ? cx - 22 - cw / 2 : right, chipAt.dd.y + (left && band.conflictLabel ? chipH / 2 + 2 : 0));
    } else chip(arrow, text, chipAt[arrow].x, chipAt[arrow].y);
  }
  // the word on the conflict: a chip left of the zigzag, so verify keeps it clear of the boxes, the arrows and the other chips
  if (band.conflictLabel) { const cw = widthOfChip(band.conflictLabel); chip('dd', band.conflictLabel, cx - 22 - cw / 2, chipAt.dd.y - (num.chip.dd && cx + 22 + widthOfChip(num.chip.dd) > x + w ? chipH / 2 + 2 : 0), true); }

  // the list: each assumption by its number, its injection under it
  const list = band.assumptions ?? [];
  if (list.length) {
    const numW = Math.ceil(Math.max(...num.n.map(i => textWidth(widthOf, `${i}.`, S, 400)))) + NUM_GAP, inner = figW - numW, lh = Math.round(S * 1.4);
    const wrap = (t: string): string[] => wrapText(t, {maxWidth: inner, atomWidth: a => widthOf(a, S, 400, 'sans')});
    let ty = y + figH + LIST_GAP;
    for (const [i, a] of list.entries()) {
      out.texts.push({text: `${i + 1}.`, x: x0, y: ty + S, size: S, bold: false, muted: false, anchor: 'start'});
      for (const [text, tone] of [[a.text, undefined], ...(a.injection ? [[injectionText(a.injection), 'accent' as const]] as const : [])] as const) {
        for (const line of wrap(text)) { out.texts.push({text: line, x: x0 + numW, y: ty + S, size: S, bold: false, muted: false, anchor: 'start', ...(tone ? {tone} : {})}); ty += lh; }
      }
      ty += 6;
    }
    out.h = ty - 6 - y;
  }
  return out;
}
