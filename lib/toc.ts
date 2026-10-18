// The thinking processes of the Theory of Constraints (Goldratt).
//  causeTree(): entities and cause -> effect arrows that place themselves (graph-layout.ts layoutLayered), causes at the bottom and
//               effects at the top by default. Current / Future Reality Tree, Prerequisite Tree and Transition Tree are all this
//               figure: an arrow across an AND arc means "together", separate arrows mean "either".
//  cloud():     the Evaporating Cloud: five boxes in a fixed place (A the common objective, B and C the needs, D and D' the
//               conflicting wants), the arrows between them with their assumptions numbered, and the numbered list under the figure.
import {textWidth} from './atoms.ts';
import {andClashes} from './cause-clash.ts';
import {causeCrossings} from './cause-hop.ts';
import {fitLayout} from './fit-width.ts';
import {scoreOf} from './polyline-metrics.ts';
import {gapFor, layeredAttempt} from './layered-route.ts';
import type {Pt} from './graph-layout.ts';
import {measureNode, nodeRuns} from './tree.ts';
import {wrapText} from './wrap.ts';
import type {EmphasisTone, FontFamily, Roles, WidthOf, WrapEnv} from './types/core.ts';
import type {CauseBand, CauseRole, CloudArrow, CloudBand, CloudBox, LaidOutCause, LaidOutCloud} from './types/diagrams.ts';
import type {BoxTone} from './types/text-bands.ts';

// ---- cause tree -------------------------------------------------------------------------------------------------------------

const MAX_W = 200, GAP = 28, LEVEL = 64, PORT = 22; // PORT: the step between the arrows that meet one side of an entity (the arrowheads of an AND stay apart)
/** The arc across the arrows of an AND: where its ends and its middle are, as distances from the arrowheads' tips. */
/** The 中核 badge (ADR 0015 D4): its height and its gap to the frame; emit-figures draws it, the layout keeps the room. */
export const CORE_BADGE_H = 22, CORE_BADGE_W = 44, CORE_BADGE_GAP = 2;
const AND_END = 21, AND_PEAK = 15, AND_REACH = 10;

/** What a role looks like when the node gives no tone. `double`: the box has a second outline (the finding of the figure). */
export const CAUSE_ROLES: Record<CauseRole, {tone: EmphasisTone; double?: boolean; dashed?: boolean}> = {
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
  tipping: {tone: 'danger', double: true}, // where a negative branch tips over (ADR 0020 D1)
  trim: {tone: 'changed', dashed: true}, // the injection that cuts a negative branch: a dashed box
  need: {tone: 'solid'}, // an input of a transition tree's unit (current reality + need + action): the filled box, so that it is not the pale box of an io (ADR 0020 D2)
};

export function causeTexts(band: CauseBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const n of band.nodes) out.push([n.label, roles.body, 700, 'sans'], [n.sub ?? '', roles.note, 400, 'sans']);
  return out;
}

const swap = (p: Pt): Pt => ({x: p.y, y: p.x});

/** The ids a link's `from` names, as a list. */
export const causesOf = (l: {from: string | readonly string[]}): string[] => typeof l.from === 'string' ? [l.from] : [...l.from];

type CauseDir = 'up' | 'down' | 'right' | 'left';

/** Figures whose side-by-side runs were moved aside (ADR 0016 D12/D13): only these can have had an AND crossing cleared that way. */
const movedAside = new WeakSet<object>();

/**
 * A cause tree. When the arrows into an effect with an AND cross each other, or any two arrows cross, the order the entities are written in is tried again
 * in a few fixed ways (ADR 0019 D4); a figure with no crossing is never touched. Only a cause tree (not pdpc() / relationDiagram()).
 */
export function layoutCauseBand(band: CauseBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number, canvasBound = false): LaidOutCause {
  const first = layoutCauseBandOnce(band, x, y, w, widthOf, roles, env, heightBudget, canvasBound);
  // the search is for a figure whose AND arrows cross as first laid out: judged before the side-by-side runs are moved aside (ADR 0016 D12/D13), which also clears crossings
  // a crossing of any two arrows also starts it: the order only wins when it is strictly better in (AND crossings, AND side-by-side, crossings, bends)
  if (band.base !== undefined || (crossingsOf_(first) === 0 && scoreOf(first.edges.map(e => e.points)).crossings === 0 && (!movedAside.has(first) || crossingsOf_(layoutCauseBandOnce(band, x, y, w, widthOf, roles, env, heightBudget, canvasBound, undefined, true)) === 0))) return first;
  const ids = band.nodes.map(n => n.id);
  // the written order reversed, then the written order turned by 1, 2, ... places (at most 6 of them)
  const orders = [[...ids].reverse(), ...Array.from({length: Math.min(ids.length - 1, 6)}, (_, k) => [...ids.slice(k + 1), ...ids.slice(0, k + 1)])];
  const axisOf = (t: LaidOutCause): number[] => t.nodes.map(n => band.dir === 'left' || band.dir === 'right' ? n.x : n.y);
  let best = first, bestScore = scoreOfCause(first), bestOrder: string[] = ids;
  // then more orders when the fixed ones left a crossing: shuffles from a fixed seed (the same figure always gets the same answer), then swaps of two neighbours of the best order so far
  const queue = [...orders];
  let seed = 20260417 + ids.length;
  const rand = (n: number): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
  const shuffles = Math.min(24, ids.length * 3);
  for (let k = 0; k < shuffles; k++) { const o = [...ids]; for (let i = o.length - 1; i > 0; i--) { const j = rand(i + 1); [o[i], o[j]] = [o[j], o[i]]; } queue.push(o); }
  let tried = 0, lastBetter = 0, polished = false;
  while (queue.length || !polished) {
    if (!queue.length) { // swaps of two nodes of the best order, once the shuffles are done
      polished = true;
      for (let i = 0; i + 1 < bestOrder.length; i++) { const o = [...bestOrder]; [o[i], o[i + 1]] = [o[i + 1], o[i]]; queue.push(o); }
      if (bestScore[0] === 0 && bestScore[1] === 0 && bestScore[2] <= 3) break;
      continue;
    }
    const order = queue.shift()!;
    // give up when nothing has got better for a while: sooner once no AND arrows cross (what is left are crossings the graph needs)
    if (++tried > MAX_ORDERS || tried - lastBetter > (bestScore[0] === 0 ? PATIENCE_QUIET : PATIENCE)) break;
    let t: LaidOutCause;
    try { t = layoutCauseBandOnce(band, x, y, w, widthOf, roles, env, heightBudget, canvasBound, order); } catch { continue; }
    // the same layers (a different order must not change which edge of a cycle is cut, or fold the figure), the same size limits, no AND the first drew left undrawn
    if (axisOf(t).some((v, i) => Math.abs(v - axisOf(first)[i]) > 0.5) || t.h > first.h + 0.5 || t.loose.length > first.loose.length) continue;
    if (t.fitApplied?.length !== first.fitApplied?.length) continue;
    const score = scoreOfCause(t);
    if (lexLess(score, bestScore)) { best = t; bestScore = score; bestOrder = order; lastBetter = tried; if (polished) { queue.length = 0; polished = false; } }
  }
  return best;
}

/** The most orders the search tries for one figure. */
const MAX_ORDERS = 80;
/** How many orders in a row may fail to get better before the search stops (with and without AND arrows crossing). */
const PATIENCE = 30, PATIENCE_QUIET = 10;
const crossingsOf_ = (t: LaidOutCause): number => andClashes(t.edges, t.ands).filter(c => c.how === 'crosses').length;
/** (arrows of an AND that cross, arrows of an AND that run side by side, crossings, bends): smaller is better, in this order. */
const scoreOfCause = (t: LaidOutCause): number[] => { const s = scoreOf(t.edges.map(e => e.points)); return [crossingsOf_(t), andClashes(t.edges, t.ands).filter(c => c.how !== 'crosses').length, s.crossings, s.bends]; };
const lexLess = (a: number[], b: number[]): boolean => { for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] < b[i]; return false; };

export function layoutCauseBandOnce(band: CauseBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number, canvasBound = false, anotherOrder?: readonly string[], plainRoutes = false): LaidOutCause {
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
  // One whole attempt: the node text wrapped at maxW and the layout turned to dir. Everything that depends on either is in here.
  // ALAP (ADR 0019 D1): the entities where a cause starts stay on the first layer; the input side (preconditions, obstacles, actions) moves up to its effects
  const layerMode = band.layer ?? (band.tree === 'prt' || band.tree === 'frt' || band.tree === 'tt' || band.tree === 'nbr' ? 'alap' : 'asap');
  const alap = band.layerFrom === 'effect' ? {keep: []} : layerMode === 'alap' ? {keep: band.nodes.filter(n => n.role === 'root' || n.role === 'injection' || n.role === 'start').map(n => n.id)} : undefined;
  // the 中核 badge sits outside the frame, at the end of the axis the arrows run along: the figure keeps that room free at both ends (H7)
  // above / below a box the badge is CORE_BADGE_H high; beside it, CORE_BADGE_W wide
  const hasCore = band.nodes.some(n => n.core);
  const padOf = (vertical: boolean): {x: number; y: number} => hasCore ? (vertical ? {x: 0, y: CORE_BADGE_H + CORE_BADGE_GAP} : {x: CORE_BADGE_W + CORE_BADGE_GAP, y: 0}) : {x: 0, y: 0};
  const build = (dir: CauseDir, maxW: number, floor: boolean, fold?: number) => {
    const vertical = dir === 'up' || dir === 'down', flip = dir === 'up' || dir === 'left';
    const iw = w - 2 * padOf(vertical).x; // the width the figure itself has: the badge room at both ends of the arrows' axis is kept free
    const lines = new Map(band.nodes.map(n => [n.id, measureNode(n.label, n.sub, maxW, widthOf, roles, env.wrap, floor)]));
    // the causes of one AND are written next to each other, so that sharing a layer they stay neighbours (an OR cause between them would cross their arrows)
    const order: string[] = [], put = (id: string): void => { if (!order.includes(id)) order.push(id); };
    const written = anotherOrder ? anotherOrder.map(id => band.nodes.find(n => n.id === id)!) : band.nodes; // ADR 0019 D4: another written order
    for (const n of written) { put(n.id); for (const g of groups) if (g.arrows.some(k => arrows[k].from === n.id)) g.arrows.forEach(k => put(arrows[k].from)); }
    const ranked = order.map(id => band.nodes.find(n => n.id === id)!);
    // the most arrows that meet one node (each needs its own lane in the gap beside it)
    const degreeOf = (id: string): number => Math.max(arrows.filter(a => a.from === id).length, arrows.filter(a => a.to === id).length);
    const degree = Math.max(1, ...band.nodes.map(n => degreeOf(n.id)));
    // the side the arrows meet must be long enough to keep their heads apart: a box grows (its text stays centred)
    const real = new Map(band.nodes.map(n => {
      const l = lines.get(n.id)!, need = 12 + (degreeOf(n.id) - 1) * PORT;
      return [n.id, vertical ? {w: Math.max(l.w, need), h: l.h} : {w: l.w, h: Math.max(l.h, need)}];
    }));
    const hexIds = new Set(band.nodes.filter(n => n.role === 'obstacle' || n.role === 'risk').map(n => n.id)); // hexagons: arrows keep to the middle of their side (ADR 0016 D3)
    const nodes = ranked.map(n => ({id: n.id, size: vertical ? {w: real.get(n.id)!.h, h: real.get(n.id)!.w} : real.get(n.id)!}));
    // layered layout runs on a 'right' axis; a vertical figure is the same layout transposed, an upward / leftward one mirrored
    const groupIndex = new Map<number, number>();
    groups.forEach((g, gi) => g.arrows.forEach(k => groupIndex.set(k, gi)));
    // the figure's own point of a layout point: set once the size is known (a figure narrower than its band is centred in it)
    const placeIn = (total: {w: number; h: number}) => (p: Pt): Pt => {
      const q = vertical ? swap(p) : {...p};
      if (flip) { if (vertical) q.y = total.h - q.y; else q.x = total.w - q.x; }
      return {x: q.x + x + padOf(vertical).x + (iw - total.w) / 2, y: q.y + y + padOf(vertical).y};
    };
    const declared = arrows.flatMap((a, k) => a.back ? [k] : []); // the returns the author named: laid out as the way back (index into `arrows`)
    // the returns that skip layers run in an outer lane: all of them when `returns: 'outer'` (or pdpc's default), the declared ones (`back`) when nothing is written
    const wanted: 'all' | 'declared' | undefined = band.returns === 'inline' ? undefined : (band.returns ?? band.returnsDefault) === 'outer' ? 'all' : declared.length ? 'declared' : undefined;
    const attemptWith = (returns: 'all' | 'declared' | undefined) => layeredAttempt(nodes, arrows.map(a => ({from: a.from, to: a.to})), {dir: 'right', gap: GAP, levelGap: Math.max(LEVEL, gapFor(degree)), ...(declared.length ? {back: declared} : {}), ...(alap ? {alap} : {}), ...(fold === undefined ? {} : {fold})}, {
      portStep: PORT, groupOf: k => groupIndex.get(k), round: id => hexIds.has(id), transpose: vertical, maxAcross: iw + 0.5, place: placeIn, ...(returns ? {returns} : {}), ...(band.straighten === false ? {straighten: false} : {}), ...(plainRoutes ? {aside: false} : {}),
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
    // the attempt's size for the fit includes the badge room at both ends; the figure's own size is taken back out below
    return {...attempt, size: {w: attempt.size.w + 2 * padOf(vertical).x, h: attempt.size.h + 2 * padOf(vertical).y}, dir, vertical, flip, lines};
  };

  // What may change to make the figure fit (ADR 0010 D1): only what the author left out (`dir`, `maxNodeW`) or gave as 'auto'. A figure
  // made by pdpc() / relationDiagram() runs 'down' unless told otherwise (`base`) and may also turn to 'right'; a cause tree keeps its axis.
  const base: CauseDir = band.base ?? 'up';
  const explicitDir = band.dir !== undefined && band.dir !== 'auto' && !band.dirLeftOut;
  const start: CauseDir = band.dir === undefined || band.dir === 'auto' ? base : band.dir;
  // a why-why tree (layerFrom: 'effect') is never folded: one "why n" on two levels breaks how it reads
  const fitted = fitLayout<CauseDir, ReturnType<typeof build>>({
    who: band.layerFrom === 'effect' ? 'whyWhyTree()' : 'causeTree()', w, start, keepWords: env.keepWords, ...(band.base !== undefined ? {alt: 'right' as const} : {axisKept: `another axis (a cause tree keeps its direction: ${start})`}),
    explicitDir, mode: band.dir === 'auto' ? 'auto' : 'omitted', ...(band.maxNodeW === undefined || band.maxNodeW === 'auto' ? {} : {maxNodeW: band.maxNodeW}), ...(band.maxNodeW === 'auto' ? {autoWidth: true} : {}),
    build, layoutOf: r => ({lay: r.lay, vertical: r.vertical}), ...(band.base === undefined && band.layerFrom !== 'effect' ? {foldable: true, ...(band.fold === undefined ? {} : {fold: band.fold})} : {}), best: band.base !== undefined && band.dir === 'auto', ...(heightBudget === undefined ? {} : {heightBudget: heightBudget - (band.maxNodeW === 'auto' && canvasBound ? y : 0)}), // an attempt's size already holds the badge room (see build)
    ...(band.returns === 'outer' ? {notTried: ["returns: 'inline' (returns is written: 'outer')"]} : {}),
  });
  const attempt = fitted.result, {lines, vertical, flip} = attempt, fitApplied = fitted.applied;
  const {lay, routes} = attempt;
  const pad = padOf(vertical), total = {w: attempt.size.w - 2 * pad.x, h: attempt.size.h - 2 * pad.y};
  const dx = x + pad.x + (w - 2 * pad.x - total.w) / 2, dy = y + pad.y;
  const rectOf = (id: string) => {
    const p = lay.nodes.get(id)!, q = vertical ? {x: p.y, y: p.x, w: p.h, h: p.w} : {x: p.x, y: p.y, w: p.w, h: p.h};
    if (flip) { if (vertical) q.y = total.h - (q.y + q.h); else q.x = total.w - (q.x + q.w); }
    return {x: q.x + dx, y: q.y + dy, w: q.w, h: q.h};
  };

  const out: LaidOutCause = {
    type: 'cause', id: band.id, reveal: band.reveal, ...(band.unanchored ? {unanchored: band.unanchored} : {}), ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: total.h + 2 * pad.y,
    nodes: [], edges: [], ands: [], loose: attempt.loose, texts: [], anchors: [], labelBoxes: [],
    ...(fitApplied.length ? {fitApplied} : {}),
  };
  if (attempt.asided) movedAside.add(out);
  for (const n of band.nodes) {
    const r = rectOf(n.id), role = CAUSE_ROLES[n.role ?? 'effect'];
    out.nodes.push({...r, tone: n.tone ?? role.tone, ...(role.double ? {double: true} : {}), ...(role.dashed ? {dashed: true} : {}), ...(n.core ? {core: true} : {}), ...(n.role === 'obstacle' || n.role === 'risk' ? {hex: true} : {})});
    out.anchors.push({id: n.id, ...r}); // all of them: verify and connect() routing read this list (an unanchored entity is only left out of the registry, by placedBand)
    const l = lines.get(n.id)!;
    out.texts.push(...nodeRuns({x: r.x + (r.w - l.w) / 2, y: r.y + (r.h - l.h) / 2, w: l.w}, l, roles));
    out.labelBoxes.push({label: n.label, ...r});
  }
  const drawn = new Map<number, number>(); // arrow index -> index in out.edges
  for (const [i, e] of lay.edges.entries()) {
    if (e.self) continue;
    drawn.set(e.index, out.edges.length);
    out.edges.push({from: e.from, to: e.to, points: routes.get(i)!, line: arrows[e.index].line, ...(arrows[e.index].back ? {back: true as const} : {}), ...(e.outer ? {outer: true as const} : {}), ...(arrows[e.index].blocks ? {kind: 'blocks' as const} : {}), ...(band.hop && e.reversed ? {reversed: true as const} : {})});
  }
  // an AND: an arc across the last run of each of its arrows, a little before the arrowheads. It needs the arrows to arrive on
  // one side of the effect, all heading the same way, with room before the head for the arc
  for (const g of groups) {
    const {ends, d, along, cross, ok} = andEnds(g, k => out.edges[drawn.get(k)!].points);
    if (!ok) continue;
    const us = ends.map(e => cross(e.tip)), tip = ends[0].tip;
    // the arc ends short of the nearest other arrow into this effect (another AND's arc, or an arrow of its own), so two arcs never touch
    // only an arrow that arrives on the same side: a return on the far side of the effect (or a blocks arrow) is nowhere near the arc, and measuring against it left the arc short of its own arrows
    const others = out.edges.filter((e, k) => e.to === g.to && !g.arrows.some(a => drawn.get(a) === k) && Math.abs(along(e.points[e.points.length - 1]) - along(tip)) < 1).map(e => cross(e.points[e.points.length - 1]));
    const reachTo = (u: number, sign: 1 | -1): number => Math.max(0, Math.min(AND_REACH, ...others.filter(o => (o - u) * sign > 0).map(o => Math.abs(o - u) / 2 - 5)));
    const lo = Math.min(...us) - reachTo(Math.min(...us), -1), hi = Math.max(...us) + reachTo(Math.max(...us), 1);
    const at = (u: number, dist: number): Pt => d.x ? {x: tip.x - d.x * dist, y: u} : {x: u, y: tip.y - d.y * dist};
    out.ands.push({to: g.to, from: g.arrows.map(k => arrows[k].from), p0: at(lo, AND_END), c: at((lo + hi) / 2, 2 * AND_PEAK - AND_END), p1: at(hi, AND_END)});
  }
  // ADR 0028: where a return crosses another line, and which of those get a hop (decided here, once; the renderer only draws them)
  if (band.hop) {
    const crossings = causeCrossings(out.edges, attempt.dir, {x: out.x, y: out.y, w: out.w, h: out.h}, out.nodes, out.ands, band.hop === 'all');
    if (crossings.length) out.crossings = crossings;
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

export function layoutCloudBand(band: CloudBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutCloud {
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
  const lines = Object.fromEntries(KEYS.map(k => [k, measureNode(boxText(k, band[k]), undefined, colW, widthOf, roles, env.wrap, env.keepWords, {keepWords: false})])) as Record<typeof KEYS[number], ReturnType<typeof measureNode>>;
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
    const wrap = (t: string): string[] => wrapText(t, {maxWidth: inner, atomWidth: a => widthOf(a, S, 400, 'sans'), mode: env.wrap});
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
