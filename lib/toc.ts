// The thinking processes of the Theory of Constraints (Goldratt).
//  causeTree(): entities and cause -> effect arrows that place themselves (graph-layout.ts layoutLayered), causes at the bottom and
//               effects at the top by default. Current / Future Reality Tree, Prerequisite Tree and Transition Tree are all this
//               figure: an arrow across an AND arc means "together", separate arrows mean "either".
//  cloud():     the Evaporating Cloud: five boxes in a fixed place (A the common objective, B and C the needs, D and D' the
//               conflicting wants), the arrows between them with their assumptions numbered, and the numbered list under the figure.
import {CAUSE_ROLES} from './cause-roles.ts';
export {CAUSE_ROLES} from './cause-roles.ts';
import {orderCrossings, type LayeredOpts} from './graph-layout.ts';
import type {RowSearchResult} from './layer-order-search.ts';
import {textWidth} from './atoms.ts';
import {andClashes} from './cause-clash.ts';
import {routesThroughNodes} from './verify-base.ts';
import {ARROW_L, causeCrossings} from './cause-hop.ts';
import {fitOrThrow, isNoFit, type NoFit, planFit, NARROWING} from './fit-width.ts';
import {pairsOf, parallelRuns, scoreOf} from './polyline-metrics.ts';
import {gapFor, laneStepOf, layeredAttempt, lexLess, selectIndex, windowOf} from './layered-route.ts';
import type {Pt} from './graph-layout.ts';
import {measureNode, nodeRuns} from './tree.ts';
import {wrapText} from './wrap.ts';
import type {FontFamily, Roles, WidthOf, WrapEnv} from './types/core.ts';
import type {CauseBand, CloudArrow, CloudBand, CloudBox, LaidOutCause, LaidOutCloud} from './types/diagrams.ts';
import type {BoxTone} from './types/text-bands.ts';

import {must} from './must.ts';
// ---- cause tree -------------------------------------------------------------------------------------------------------------

const GAP = 28, LEVEL = 64, PORT = 22; // PORT: the step between the arrows that meet one side of an entity (the arrowheads of an AND stay apart)
/** The arc across the arrows of an AND: where its ends and its middle are, as distances from the arrowheads' tips. */
/** The 中核 badge (ADR 0015 D4): its height and its gap to the frame; emit-figures draws it, the layout keeps the room. */
export const CORE_BADGE_H = 22, CORE_BADGE_W = 44, CORE_BADGE_GAP = 2;
/** How far inside the frame a `double` box's second outline runs (emit-figures draws it): the box is that much taller at both ends, so
 *  the text keeps the same padding from the inner outline that a plain box keeps from its frame (#378). */
export const DOUBLE_INSET = 4;
/** The arc of an AND (ADR 0070 D8, a cause tree's band): its middle `peak` from the tips leaves a visible gap to the arrowhead's base of 0.4 x
 *  the text size (14 x `s`, the line half-width taken off); its ends are 6 x `s` farther; it reaches `reach` past the outer arrows.
 *  pdpc / relationDiagram / whyWhyTree keep the old arc (21 / 15 / 10). `s` is 1 until the lines scale with the canvas text (D7). */
export const andArc = (s = 1): {end: number; peak: number; reach: number} => {
  const peak = ARROW_L + 1 + Math.ceil(0.4 * 14 * s);
  return {peak, end: peak + Math.round(6 * s), reach: Math.round(10 * s)};
};
const OLD_ARC = {end: 21, peak: 15, reach: 10};

export function causeTexts(band: CauseBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const n of band.nodes) out.push([n.label, roles.body, 700, 'sans'], [n.sub ?? '', roles.note, 400, 'sans']);
  return out;
}

const swap = (p: Pt): Pt => ({x: p.y, y: p.x});

/** The ids a link's `from` names, as a list. */
export const causesOf = (l: {from: string | readonly string[]}): string[] => typeof l.from === 'string' ? [l.from] : [...l.from];

type CauseDir = 'up' | 'down' | 'right' | 'left';

/**
 * A cause tree. When the arrows into an effect with an AND cross each other, or any two arrows cross, the order the entities are written in is tried again
 * in a few fixed ways (ADR 0019 D4); a figure with no crossing is never touched. Only a cause tree (not pdpc() / relationDiagram()).
 */
export function layoutCauseBand(band: CauseBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number, canvasBound = false): LaidOutCause {
  // ADR 0070 D7: the scaled lines make a figure taller; one that then fits no way the old lines fit is drawn with the old lines (the scale never turns a figure that was drawn into an error)
  let laid = layoutCauseBandAt(band, x, y, w, widthOf, roles, env, heightBudget, canvasBound);
  // (a figure that fits this budget can still overflow the canvas with the bands around it: layoutWith retries the whole diagram then, see `fitLineScale`)
  if (isNoFit(laid) && env.lineScale !== undefined) {
    const {lineScale: _scale, ...old} = env;
    const plain = layoutCauseBandAt(band, x, y, w, widthOf, roles, old, heightBudget, canvasBound);
    if (!isNoFit(plain)) { laid = plain; plain.lineScaleDropped = true; }
  }
  const out = fitOrThrow(laid);
  if (env.space === undefined || env.space === 1) return out;
  // `density: 'compact'` must not make an arrow run through a box (the check calls that an error): the narrower gaps between the layers can do that, so this band is drawn at the normal gaps then
  const through = (t: LaidOutCause): number => routesThroughNodes(t.edges, t.anchors, () => '').length;
  const bad = through(out);
  if (bad === 0) return out;
  // the normal gaps may not fit the width or the height that the compact figure fits: the compact figure stays then (the check says what is wrong with it)
  const normal = layoutCauseBandAt(band, x, y, w, widthOf, roles, {...env, space: 1}, heightBudget, canvasBound);
  if (isNoFit(normal) || through(normal) >= bad) return out;
  normal.densityRestored = true;
  return normal;
}


function layoutCauseBandAt(band: CauseBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number, canvasBound = false): LaidOutCause | NoFit {
  const once = (order?: readonly string[], plainRoutes = false, noDetour = false, sameFit?: {width: number; folded: boolean}, tailOff = false, rows?: RowsCtl) => (searchStats.layouts++, tryLayoutCause(prep, band, x, y, w, widthOf, roles, env, heightBudget, canvasBound, order, plainRoutes, noDetour, sameFit, tailOff, rows));
  const prep = prepareCause(band);
  const sep = bandSep(band, env); // one lane step for the search's score and for `better()` (ADR 0073 D2)
  const first = once();
  if (isNoFit(first)) return first;
  // the search is for a figure whose AND arrows cross as first laid out: judged before the side-by-side runs are moved aside (ADR 0016 D12/D13), which also clears crossings
  // a crossing of any two arrows also starts it: the order only wins when it is strictly better in (AND crossings, AND side-by-side, crossings, bends)
  if (band.base !== undefined) return first;
  if (crossingsOf_(first) === 0 && scoreOf(first.edges.map(e => e.points)).crossings === 0) return first;
  const ids = band.nodes.map(n => n.id);
  // The search scores the figures without the detours of the long arrows (route-search.ts: slow, and the search lays a figure out up to MAX_ORDERS times); the order it
  // finds is laid out once more with them, and replaces the first figure only if it is strictly better in the same score.
  // ADR 0075: a cause tree's own band that searches (not whyWhyTree, not `straighten: false`) also searches the order of the rows, once, in this first placement
  const rowSearchOn = band.straighten !== false && band.layerFrom === undefined;
  const search1: RowsCtl['search'] = {andTo: new Set(prep.groups.map(g => must(prep.arrows[must(g.arrows[0])]).to))};
  const base = band.straighten === false ? first : once(undefined, false, true, undefined, true, rowSearchOn ? {search: search1} : undefined);
  if (isNoFit(base)) return base;
  // the written order reversed, then the written order turned by 1, 2, ... places (at most 6 of them)
  const orders = [ids.toReversed(), ...Array.from({length: Math.min(ids.length - 1, 6)}, (_, k) => [...ids.slice(k + 1), ...ids.slice(0, k + 1)])];
  const axisOf = (t: LaidOutCause): number[] => t.nodes.map(n => band.dir === 'left' || band.dir === 'right' ? n.x : n.y);
  // ADR 0073 D1: a cause tree's own band (not whyWhyTree) may take a taller order that crosses less, and the height is the last key of the score
  const own = band.layerFrom === undefined, exchange = own && env.exchange !== false;
  const baseRank = layerRank(axisOf(base));
  const baseFrame = {layers: baseRank, loose: base.loose.length, fits: base.fitApplied?.length};
  // the orders are ranked by how many links cross between the layers before any is laid out: an order whose layers cross more than the best one's is not laid out (ADR 0053).
  // It is a forecast: the routes, the lanes and the AND arcs come only with the whole layout, which still decides
  const declaredBack = prep.arrows.flatMap((a, k) => a.back ? [k] : []), alapOpt = alapOf(band);
  const proxyOf = (order: readonly string[]): number => orderCrossings(rankedIds(prep, band, order).map(id => ({id, size: {w: 1, h: 1}})), prep.arrows.map(a => ({from: a.from, to: a.to})),
    {dir: 'right', transpose: true, coord: 'bk', ...(declaredBack.length ? {back: declaredBack} : {}), ...(alapOpt ? {alap: alapOpt} : {})});
  let bestProxy = proxyOf(ids);
  // the node width and folding the base fitted with: another order is laid out with the same, as any other would be set aside below (ADR 0053)
  const baseWidth = base.fitApplied?.find(a => a.what === 'maxNodeW')?.to;
  const sameFit = {width: typeof baseWidth === 'number' ? baseWidth : (band.maxNodeW === undefined || band.maxNodeW === 'auto' ? NARROWING[0] as number : band.maxNodeW), folded: !!base.fitApplied?.some(a => a.what === 'fold')};
  // ADR 0073 D2: every order that passed the height gate keeps its score; the figure only while it is in the window. The pick (`best`) is the selection of the whole list, whatever came first
  type Pick = {t: LaidOutCause; order?: string[]; rows?: string[][]; proxy: number};
  const pool = windowPool<Pick>({t: base, proxy: bestProxy}, scoreOfCause(base, own, sep));
  let bestScore = pool.best.score, bestOrder: string[] | undefined, bestRows: string[][] | undefined;
  // ADR 0075 D2/D3: a candidate is the figure laid out with the rows the search found forced in. It joins the pool like any order: the same frame, the same height rule, the same score; and never with more sub-4px overlaps than the pick so far.
  const overlapsOf = (t: LaidOutCause): number => parallelRuns(t.edges.map(e => e.points), 4).length;
  const tryRows = (rows: string[][], seedOrder?: readonly string[]): void => {
    const force: NonNullable<LayeredOpts['forceRows']> = {rows}, t = once(seedOrder, false, true, sameFit, true, {force});
    searchStats.rowCandidates++;
    if (!force.took || isNoFit(t)) return; // the last layoutLayered call did not take the rows (other layers or nodes): not a candidate
    if (!inFrame({layers: layerRank(axisOf(t)), loose: t.loose.length, fits: t.fitApplied?.length}, baseFrame)) return;
    const score = scoreOfCause(t, own, sep);
    if (overlapsOf(t) > overlapsOf(must(pool.best.item).t)) return;
    if (!passesHeight(t.h, score, base, bestScore, exchange)) return;
    if (pool.add({t, rows, ...(seedOrder ? {order: [...seedOrder]} : {}), proxy: bestProxy}, score)) { const cur = must(pool.best.item); bestScore = pool.best.score; bestOrder = cur.order; bestRows = cur.rows; bestProxy = cur.proxy; searchStats.rowsWon++; }
  };
  // then more orders when the fixed ones left a crossing: shuffles from a fixed seed (the same figure always gets the same answer), then swaps of two neighbours of the best order so far.
  // `straighten: false` keeps to the fixed ones (it is the way back to the old figure)
  const queue = [...orders], seen = new Set<string>([ids.join('\u0000'), ...orders.map(o => o.join('\u0000'))]);
  const add = (o: string[]): void => { const k = o.join('\u0000'); if (!seen.has(k)) { seen.add(k); queue.push(o); } };
  if (band.straighten !== false) {
    let seed = 20260417 + ids.length;
    const rand = (n: number): number => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % n; };
    for (let k = 0, n = Math.min(24, ids.length * 3); k < n; k++) { const o = [...ids]; for (let i = o.length - 1; i > 0; i--) { const j = rand(i + 1); const oi = must(o[i]); o[i] = must(o[j]); o[j] = oi; } add(o); }
  }
  let tried = 0, lastBetter = 0, polished = false;
  while (queue.length || (!polished && band.straighten !== false)) {
    if (!queue.length) { // swaps of two neighbours of the best order, once the shuffles are done
      polished = true;
      if (bestScore[0] === 0 && bestScore[1] === 0 && bestScore[2] === 0) break; // nothing crosses: only bends and pairs are left
      for (let i = 0; i + 1 < (bestOrder ?? ids).length; i++) { const o = [...(bestOrder ?? ids)]; const oi = must(o[i]); o[i] = must(o[i + 1]); o[i + 1] = oi; add(o); }
      continue;
    }
    // give up when nothing has got better for a while (counted in the orders tried, the ones set aside too: each is a layout): sooner once no AND arrows cross
    if (++tried > MAX_ORDERS || tried - lastBetter > (bestScore[0] === 0 ? PATIENCE_QUIET : PATIENCE)) break;
    const order = must(queue.shift());
    const proxy = proxyOf(order);
    // the forecast does not see the arrows of an AND, which only the routes show: while some of them cross, every order is laid out
    if (bestScore[0] === 0 && proxy > bestProxy) continue;
    searchStats.laid++;
    const t = once(order, false, true, sameFit, true);
    if (isNoFit(t)) continue; // another order widens a layer: it does not fit where the written one does
    // the same layers (a different order must not change which edge of a cycle is cut, or fold the figure), the same size limits, no AND the first drew left undrawn (ADR 0073 D1 (a)-(c))
    if (!inFrame({layers: layerRank(axisOf(t)), loose: t.loose.length, fits: t.fitApplied?.length}, baseFrame)) continue;
    const score = scoreOfCause(t, own, sep);
    if (!passesHeight(t.h, score, base, bestScore, exchange)) continue;
    // the selection changed (a better candidate, or a window that shrank and left the old pick out): the wait starts again
    if (pool.add({t, order, proxy}, score)) { const cur = must(pool.best.item); bestScore = pool.best.score; bestOrder = cur.order; bestProxy = cur.proxy; lastBetter = tried; if (polished) { queue.length = 0; polished = false; } }
  }
  // ADR 0075 D2: the order search above ran exactly as on main (nothing below touches `lastBetter`, `tried` or the queue); the row candidates join its pool afterwards.
  const mainOrder = bestOrder, mainPick = must(pool.best.item), found0 = search1.result;
  // the forecast: lay a candidate out only if its layer crossings (weight 1) are at most the best order's forecast `bestProxy`. As in the loop above, it does not filter while AND crossings remain (the forecast does not see the AND arrows)
  const forecastOk = (r: RowSearchResult): boolean => (bestScore[0] ?? 0) > 0 || r.plainCrossings < bestProxy + 1;
  if (rowSearchOn && found0) { searchStats.rowSearches++; searchStats.moves += found0.moves; if (forecastOk(found0)) tryRows(found0.rows); }
  // the second search: the rows the sweeps leave for the best order the search found are its start (one more placement)
  if (rowSearchOn && found0 && bestOrder) {
    const search2: RowsCtl['search'] = {andTo: search1.andTo}, again = once(bestOrder, false, true, sameFit, true, {search: search2}), found1 = search2.result;
    if (!isNoFit(again) && found1) { searchStats.rowSearches++; searchStats.moves += found1.moves; if (forecastOk(found1)) tryRows(found1.rows, bestOrder); }
  }
  const best = must(pool.best.item).t;
  if (band.straighten === false) { if (best.h > base.h + 0.5) env.tallerSeen?.(); return best; }
  // the final pick, in two stages (D3): M is main's own pick; R the best rows candidate, which replaces M only when the window of ADR 0073 D2 over [M, R] selects it
  const detour = (order: readonly string[] | undefined, rows?: string[][]): LaidOutCause | undefined => {
    const force: NonNullable<LayeredOpts['forceRows']> | undefined = rows ? {rows} : undefined, f = once(order, false, false, undefined, false, force ? {force} : undefined);
    return isNoFit(f) || (force && !force.took) ? undefined : f;
  };
  const foundMain = mainOrder ? detour(mainOrder) : undefined;
  const rowsWon = must(pool.best.item) !== mainPick;
  const foundRows = rowsWon ? detour(bestOrder, bestRows) : undefined;
  const viewOf = (t: LaidOutCause): Judged => ({h: t.h, score: scoreOfCause(t, own, sep), layers: layerRank(axisOf(t)), loose: t.loose.length, fits: t.fitApplied?.length});
  const picked = pickTwoStage(first, [foundMain, mainPick.t], rowsWon ? [foundRows, best] : [], {h: base.h, layers: baseRank, loose: base.loose.length, fits: base.fitApplied?.length}, exchange, viewOf, overlapsOf, (m, r) => { searchStats.replaced++; searchHooks.onReplace?.({score: viewOf(m).score, overlaps: overlapsOf(m)}, {score: viewOf(r).score, overlaps: overlapsOf(r)}); });
  if (picked.h > base.h + 0.5) env.tallerSeen?.();
  return picked;
}

/**
 * ADR 0075 D3: the final pick in two stages. M = main's own pick (`first` and the candidates of the order search only). R = the best of the rows candidates alone, each checked first (frame, height against M's score, overlaps not above M's).
 * R replaces M only when the window of ADR 0073 D2 over the pair [M, R] selects R: a pairs-only gain costs at most +4 bends (D1-4), a lower C wins, a tie keeps M. So the final figure is M or R, never another candidate of the order search
 * (one `pickFinal` over all of them is not monotone: a rows candidate that is not chosen could shrink the window and move the pick to another one), and a figure differs from main's only when the window selects R.
 */
export function pickTwoStage<T>(first: T, main: readonly (T | undefined)[], rows: readonly (T | undefined)[], base: {h: number; layers: readonly number[]; loose: number; fits: number | undefined}, exchange: boolean, view: (t: T) => Judged, ovOf?: (t: T) => number, onReplace?: (m: T, r: T) => void): T {
  const m = pickFinal(first, main, base, exchange, view), vm = view(m);
  const rs = rows.filter((t): t is T => t !== undefined && inFrame(view(t), base) && passesHeight(view(t).h, view(t).score, base, vm.score, exchange) && (!ovOf || ovOf(t) <= ovOf(m)));
  if (!rs.length) return m;
  const rp = windowPool<T>(must(rs[0]), view(must(rs[0])).score);
  for (const t of rs.slice(1)) rp.add(t, view(t).score);
  const r = must(rp.best.item), pair = windowPool<T>(m, vm.score);
  pair.add(r, view(r).score);
  if (pair.best.item !== r) return m;
  onReplace?.(m, r);
  return r;
}

/** What the final pick reads of a figure: its height, its score, the ranks of its layers, how many ANDs were left undrawn and how many size limits were applied. */
export interface Judged {h: number; score: readonly number[]; layers: readonly number[]; loose: number; fits: number | undefined}
/** Whether a figure is in the frame of the figures the search compares (D1 (a), (e)): the same layers by rank, no more ANDs left undrawn, the same number of size limits applied. The search loop and the final pick both ask it. */
export const inFrame = (v: {layers: readonly number[]; loose: number; fits: number | undefined}, base: {layers: readonly number[]; loose: number; fits: number | undefined}): boolean =>
  v.layers.length === base.layers.length && v.layers.every((r, i) => r === base.layers[i]) && v.loose <= base.loose && v.fits === base.fits;
/**
 * The final pick (ADR 0073 D1 (d), D2): of the first figure (with the detours), the best order with the detours and the best figure without them, the one the selection of the list chooses (window and all).
 * A figure joins the list only when it is in the frame of the figures the search compared (the same layers by rank, no more ANDs left undrawn, the same number of size limits) and passes the height gate
 * against the pick so far (`passesHeight`). The detours may have made `first` lower than any order would be without them, and may make AND arrows cross, so the figure without them stays a candidate.
 */
export function pickFinal<T>(first: T, candidates: readonly (T | undefined)[], base: {h: number; layers: readonly number[]; loose: number; fits: number | undefined}, exchange: boolean, view: (t: T) => Judged): T {
  const pool = windowPool<T>(first, view(first).score);
  for (const t of candidates) {
    if (t === undefined) continue;
    const v = view(t);
    if (!inFrame(v, base)) continue;
    if (passesHeight(v.h, v.score, base, pool.best.score, exchange)) pool.add(t, v.score);
  }
  return must(pool.best.item);
}

/**
 * The candidates of one stage with their scores (ADR 0073 D2). `add` keeps every score and the figure only while it is in the window (a window never takes back what it left: when C falls, the earlier
 * candidates are out; when the least bends fall, it only shrinks). `best` is the selection of the whole list. A tie keeps the earlier candidate.
 * `add` says whether the search made progress: the selection changed, or the best (C, bends, height) without the pairs got lower (a candidate that only the pairs keep from being chosen is still a better
 * figure on the keys the search waited on before the pairs were a key: the wait does not run out sooner for the pairs, which stopped a figure's search short of the order that crosses less).
 */
export function windowPool<T>(first: T, score: readonly number[]): {readonly best: {item: T | undefined; score: readonly number[]}; add: (item: T, score: readonly number[]) => boolean; readonly size: number; readonly held: number} {
  const all: {item: T | undefined; score: readonly number[]}[] = [{item: first, score}];
  const withoutPairs = (k: readonly number[]): number[] => k.filter((_, i) => i !== k.length - 3);
  let at = 0, frontier = withoutPairs(score);
  return {
    get best() { return must(all[at]); },
    get size() { return all.length; },
    get held() { return all.filter(e => e.item !== undefined).length; },
    add(item, s) {
      all.push({item, score: s});
      const before = at;
      at = selectIndex(all.map(e => e.score));
      const inWindow = new Set(windowOf(all.map(e => e.score)));
      all.forEach((e, i) => { if (!inWindow.has(i)) e.item = undefined; });
      const f = withoutPairs(s), lower = lexLess(f, frontier);
      if (lower) frontier = f;
      return at !== before || lower;
    },
  };
}

/** A count of the orders the search laid out (a measure of its cost that does not depend on the load of the machine; read by the tests and by scripts/crt-u6-measure). */
export const searchStats = {laid: 0,
  /** Every placement `layoutCauseBandAt` made (the cost of ADR 0075 D5: it does not depend on the load of the machine). */ layouts: 0,
  /** The row searches run, the candidates laid out, the ones that won the pool, the figures a rows candidate replaced main's pick in, and the annealing moves tried. */ rowSearches: 0, rowCandidates: 0, rowsWon: 0, replaced: 0, moves: 0};
/** For the tests (ADR 0075 U1): called with the score and the sub-4px overlaps of main's pick M and of the rows candidate R each time R replaces M. */
export const searchHooks: {onReplace?: (m: {score: readonly number[]; overlaps: number}, r: {score: readonly number[]; overlaps: number}) => void} = {};
/** What a placement is given for the row search (ADR 0075): to search (the result lands in `search.result`) or to force rows in (`force.took` says whether the last layout call took them). */
type RowsCtl = {search?: NonNullable<LayeredOpts['rowSearch']>; force?: NonNullable<LayeredOpts['forceRows']>};
/** The most orders the search tries for one figure. */
const MAX_ORDERS = 60;
/** How many orders in a row may fail to get better before the search stops (with and without AND arrows crossing). */
const PATIENCE = 30, PATIENCE_QUIET = 14;
const crossingsOf_ = (t: LaidOutCause): number => andClashes(t.edges, t.ands).filter(c => c.how === 'crosses').length;
/**
 * [arrows of an AND that cross, arrows of an AND that run side by side, crossings, run pairs, bends, height]: smaller is better, in the order of the window's selection (`windowOf`: the first three are C).
 * The pairs (at `sep`, the band's lane step) and the height (rounded) are for a cause tree's own band only (`own`, ADR 0073 D1-2, D2); the others have 0 there, and their selection is the lexicographic one.
 */
const scoreOfCause = (t: LaidOutCause, own: boolean, sep: number): number[] => {
  const pts = t.edges.map(e => e.points), s = scoreOf(pts);
  return [crossingsOf_(t), andClashes(t.edges, t.ands).filter(c => c.how !== 'crosses').length, s.crossings, own ? pairsOf(pts, sep) : 0, s.bends, own ? Math.round(t.h) : 0];
};
/** The lane step the band's pairs are counted at: `laneStepOf(space x scale)`, the scale being the canvas's line scale of a cause tree's own band (1 for the others). The same value `layeredAttempt` takes as its `unit`. */
export const bandSep = (band: CauseBand, env: WrapEnv): number => laneStepOf((env.space ?? 1) * (band.base === undefined && band.layerFrom === undefined ? Math.max(1, env.lineScale ?? 1) : 1));
/** ADR 0073 D1 (c): how much taller than the first order's figure an order may be, when it crosses less. */
const TALLER = 1.25;
/**
 * Whether an order's figure is not too tall (ADR 0073 D1 (b), (c-1), (c-2)): up to the first order's height + 0.5px always; a taller one only when it has strictly fewer crossings than the best
 * so far and is at most 1.25 times the FIRST order's height (`base`, not the best's: a taller figure taken does not raise the limit for the next one).
 */
export const mayBeTaller = (t: {h: number; crossings: number}, base: {h: number}, best: {crossings: number}): boolean => t.h <= base.h + 0.5 || (t.h <= TALLER * base.h && t.crossings < best.crossings);
/**
 * The rank of each value along a layer: ascending, values within 0.5px of the next smaller one share its rank (the gaps between boxes may differ from order to order, the layers may not; ADR 0073 D1 (e)).
 * Joined by the difference, not by a rounded grid: two values 0.02px apart are one rank wherever they fall.
 */
export function layerRank(values: readonly number[]): number[] {
  const sorted = [...new Set(values)].sort((a, b) => a - b), rank = new Map<number, number>();
  let k = -1, prev = -Infinity;
  for (const v of sorted) { if (v - prev > 0.5) k++; rank.set(v, k); prev = v; }
  return values.map(v => must(rank.get(v)));
}
/** Whether an order's figure may join the list of candidates (ADR 0073 D1 (b)-(d)): not too tall (`mayBeTaller`; `exchange` false: only up to the first order's height + 0.5px). `score` is a `scoreOfCause` score: its crossings are the third. */
export const passesHeight = (h: number, score: readonly number[], base: {h: number}, best: readonly number[], exchange = true): boolean =>
  exchange ? mayBeTaller({h, crossings: must(score[2])}, base, {crossings: must(best[2])}) : h <= base.h + 0.5;
export {lexLess};

export function layoutCauseBandOnce(band: CauseBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number, canvasBound = false, anotherOrder?: readonly string[], plainRoutes = false, noDetour = false): LaidOutCause {
  return fitOrThrow(tryLayoutCause(prepareCause(band), band, x, y, w, widthOf, roles, env, heightBudget, canvasBound, anotherOrder, plainRoutes, noDetour));
}

/** What a cause tree's links are, checked once: the same for every order and every width the search lays it out in, and where the mistakes in the entities and links are thrown (a `back` that closes no cycle is thrown by the layout, graph-layout.ts). */
type CausePrep = {arrows: {from: string; to: string; line: 'solid' | 'dashed' | 'dotted'; back?: true; blocks?: true}[]; groups: {to: string; arrows: number[]}[]};
function prepareCause(band: CauseBand): CausePrep {
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
  return {arrows, groups};
}

/** The order the nodes are handed to the layout in: the written one (or `anotherOrder`), the causes of one AND next to each other, so that sharing a layer they stay neighbours (an OR cause between them would cross their arrows). */
function rankedIds(prep: CausePrep, band: CauseBand, anotherOrder?: readonly string[]): string[] {
  const {arrows, groups} = prep;
  const order: string[] = [], put = (id: string): void => { if (!order.includes(id)) order.push(id); };
  const written = anotherOrder ?? band.nodes.map(n => n.id); // ADR 0019 D4: another written order
  for (const id of written) { put(id); for (const g of groups) if (g.arrows.some(k => must(arrows[k]).from === id)) g.arrows.forEach(k => put(must(arrows[k]).from)); }
  return order;
}

/** The nodes a CRT moves by default (ADR 0070 D1): the preconditions, and every node whose causes (one or more, on the links as
 *  written, before any cycle is cut) all are in the set, found forwards to the least fixpoint. A node on a cycle never joins: its cause on
 *  the cycle does not join before it does. */
export function crtMovers(band: Pick<CauseBand, 'nodes' | 'links'>): Set<string> {
  const causes = new Map<string, string[]>(band.nodes.map(n => [n.id, []]));
  for (const l of band.links) for (const f of typeof l.from === 'string' ? [l.from] : l.from) causes.get(l.to)?.push(f);
  const moves = new Set(band.nodes.filter(n => n.role === 'precondition').map(n => n.id));
  for (let grew = moves.size > 0; grew;) {
    grew = false;
    for (const [id, cs] of causes) if (!moves.has(id) && cs.length && cs.every(c => moves.has(c))) { moves.add(id); grew = true; }
  }
  return moves;
}

/** ALAP (ADR 0019 D1): the entities where a cause starts stay on the first layer; the input side (preconditions, obstacles, actions) moves up to its effects.
 *  A CRT with no `layer` written (ADR 0070 D1) moves only its preconditions and the chains they start: every other node is kept; with no
 *  precondition, no ALAP at all (the layers are the asap ones, byte for byte). */
function alapOf(band: CauseBand): {keep: string[]} | undefined {
  if (band.layerFrom === 'effect') return {keep: []};
  if (band.tree === 'crt' && band.layer === undefined) {
    const moves = crtMovers(band);
    return moves.size ? {keep: band.nodes.filter(n => !moves.has(n.id)).map(n => n.id)} : undefined;
  }
  const layerMode = band.layer ?? (band.tree === 'prt' || band.tree === 'frt' || band.tree === 'tt' || band.tree === 'nbr' ? 'alap' : 'asap');
  return layerMode === 'alap' ? {keep: band.nodes.filter(n => n.role === 'root' || n.role === 'injection' || n.role === 'start').map(n => n.id)} : undefined;
}

/** One whole layout of a cause tree; the figure that fits none of the ways is returned as `NoFit`; a mistake of the author's or a broken invariant still throws. */
function tryLayoutCause(prep: CausePrep, band: CauseBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv, heightBudget?: number, canvasBound = false, anotherOrder?: readonly string[], plainRoutes = false, noDetour = false, sameFit?: {width: number; folded: boolean}, tailOff = false, rows?: RowsCtl): LaidOutCause | NoFit {
  const {arrows, groups} = prep;
  // a cause tree's own band (not pdpc / relationDiagram / whyWhyTree, ADR 0070 D1/M1): the AND arc of D8, the room before the heads that it
  // needs (`headRun` = AND_END + 1, and the old 4px more for a last turn), and the ports of D3
  const own = band.base === undefined && band.layerFrom === undefined;
  // ADR 0070 D7: the lines' scale `s` = max(1, the canvas's font scale), for a cause tree's own band only (1 with no canvas)
  const s = own ? Math.max(1, env.lineScale ?? 1) : 1, PORT_S = Math.round(PORT * s);
  const {end: AND_END, peak: AND_PEAK, reach: AND_REACH} = own ? andArc(s) : OLD_ARC;
  const headRun = AND_END + 1;
  const heads = own ? {headRun: Math.max(22, headRun), turnRun: Math.max(26, headRun + 4), andPorts: true, ...(tailOff ? {tailAlign: false} : {})} : undefined;
  // the last run of each arrow of an AND, when they can carry one arc (see below): the arrows arrive on one side, all heading the
  // same way, with room before the head for the arc
  const andEnds = (g: {arrows: number[]}, pointsOf: (k: number) => Pt[]) => {
    const ends = g.arrows.map(pointsOf).map(p => ({tip: must(p.at(-1)), prev: must(p.at(-2))}));
    const first = must(ends[0]);
    const sgn = (v: number): number => Math.abs(v) < 0.5 ? 0 : Math.sign(v); // a last run a hair off the straight (float noise) is still straight
    const d = {x: sgn(first.tip.x - first.prev.x), y: sgn(first.tip.y - first.prev.y)};
    const along = (p: Pt): number => d.x ? p.x : p.y, cross = (p: Pt): number => d.x ? p.y : p.x;
    const aligned = ends.every(e => sgn(e.tip.x - e.prev.x) === d.x && sgn(e.tip.y - e.prev.y) === d.y && Math.abs(along(e.tip) - along(first.tip)) < 1);
    const room = Math.min(...ends.map(e => Math.abs(along(e.tip) - along(e.prev))));
    return {ends, d, along, cross, ok: aligned && room >= AND_END + 1};
  };
  // One whole attempt: the node text wrapped at maxW and the layout turned to dir. Everything that depends on either is in here.
  // ALAP (ADR 0019 D1): the entities where a cause starts stay on the first layer; the input side (preconditions, obstacles, actions) moves up to its effects
  const alap = alapOf(band);
  // the 中核 badge sits outside the frame, at the end of the axis the arrows run along: the figure keeps that room free at both ends (H7)
  // above / below a box the badge is CORE_BADGE_H high; beside it, CORE_BADGE_W wide
  const hasCore = band.nodes.some(n => n.core);
  const padOf = (vertical: boolean): {x: number; y: number} => hasCore ? (vertical ? {x: 0, y: CORE_BADGE_H + CORE_BADGE_GAP} : {x: CORE_BADGE_W + CORE_BADGE_GAP, y: 0}) : {x: 0, y: 0};
  const build = (dir: CauseDir, maxW: number, floor: boolean, fold?: number) => {
    const vertical = dir === 'up' || dir === 'down', flip = dir === 'up' || dir === 'left';
    const iw = w - 2 * padOf(vertical).x; // the width the figure itself has: the badge room at both ends of the arrows' axis is kept free
    const lines = new Map(band.nodes.map(n => [n.id, measureNode(n.label, n.sub, maxW, widthOf, roles, env.wrap, floor)]));
    // the causes of one AND are written next to each other, so that sharing a layer they stay neighbours (an OR cause between them would cross their arrows)
    const ranked = rankedIds(prep, band, anotherOrder).map(id => must(band.nodes.find(n => n.id === id)));
    // the most arrows that meet one node (each needs its own lane in the gap beside it)
    const degreeOf = (id: string): number => Math.max(arrows.filter(a => a.from === id).length, arrows.filter(a => a.to === id).length);
    const degree = Math.max(1, ...band.nodes.map(n => degreeOf(n.id)));
    // ADR 0070 D3: the boundaries next to an AND group take one more step each. Their number depends on the order of the ports, which the
    // layout decides after the boxes are sized, so the box takes the most there can be: two for each group, and never more than the
    // boundaries of the side (groups + lone arrows - 1). A declared return (`back`) arrives on the far side and is not counted
    const andSteps = (id: string): number => {
      if (!heads) return 0;
      const into = arrows.flatMap((a, k) => a.to === id && !a.back ? [k] : []), ands = new Set(into.flatMap(k => groups.flatMap((g, gi) => g.arrows.includes(k) ? [gi] : [])));
      const lone = into.filter(k => !groups.some(g => g.arrows.includes(k))).length;
      return ands.size ? Math.min(2 * ands.size, ands.size + lone - 1) : 0;
    };
    // the side the arrows meet must be long enough to keep their heads apart: a box grows (its text stays centred)
    const real = new Map(band.nodes.map(n => {
      const l = must(lines.get(n.id)), need = 12 + Math.max(degreeOf(n.id) - 1, arrows.filter(a => a.to === n.id).length - 1 + andSteps(n.id)) * PORT_S, h = l.h + (CAUSE_ROLES[n.role ?? 'effect'].double ? 2 * DOUBLE_INSET : 0);
      return [n.id, vertical ? {w: Math.max(l.w, need), h} : {w: l.w, h: Math.max(h, need)}];
    }));
    const hexIds = new Set(band.nodes.filter(n => n.role === 'obstacle' || n.role === 'risk').map(n => n.id)); // hexagons: arrows keep to the middle of their side (ADR 0016 D3)
    const nodes = ranked.map(n => { const rl = must(real.get(n.id)); return {id: n.id, size: vertical ? {w: rl.h, h: rl.w} : rl}; });
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
    // ADR 0070 D7: the gap between the boxes of a layer holds the dummies of the long arrows, so it is never under one lane step of the scaled lines
    // (U5: the ADR's `2 x LANE x unit` made the real CRT wider than its canvas at s = 1.29 and the straightened layout lost; see the PR)
    const boxGap = Math.max(Math.round(GAP * (env.space ?? 1)), laneStepOf((env.space ?? 1) * s));
    const attemptWith = (returns: 'all' | 'declared' | undefined) => layeredAttempt(nodes, arrows.map(a => ({from: a.from, to: a.to})), {dir: 'right', gap: boxGap, levelGap: Math.max(Math.round(LEVEL * (env.space ?? 1)), gapFor(degree, 0, env.space, s)), ...(declared.length ? {back: declared} : {}), ...(alap ? {alap} : {}), ...(fold === undefined ? {} : {fold}), ...(rows?.search ? {rowSearch: rows.search} : {}), ...(rows?.force ? {forceRows: rows.force} : {})}, {
      portStep: PORT_S, ...(env.space === undefined || env.space === 1 ? {} : {space: env.space}), ...(s > 1 ? {scale: s} : {}), groupOf: k => groupIndex.get(k), round: id => hexIds.has(id), transpose: vertical, maxAcross: iw + 0.5, place: placeIn, ...(returns ? {returns} : {}), ...(heads ? {heads, heightKey: true, pairsKey: true} : {}), ...(heads && band.straighten !== false ? {tracks: true} : {}), ...(band.straighten === false ? {straighten: false} : {}), ...(band.straighten === false || noDetour ? {} : {detour: true}), ...(plainRoutes ? {aside: false} : band.straighten === false ? {} : {apart: true}),
      looseOf: (rts, ly) => {
        const route = new Map<number, Pt[]>();
        ly.edges.forEach((e, i) => { if (!e.self) route.set(e.index, must(rts.get(i))); });
        return groups.filter(g => !andEnds(g, k => must(route.get(k))).ok).map(g => g.to);
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
  const fitted = planFit<CauseDir, ReturnType<typeof build>>({
    ...(sameFit === undefined ? {} : {sameFit}),
    who: band.layerFrom === 'effect' ? 'whyWhyTree()' : 'causeTree()', w, start, keepWords: env.keepWords, ...(band.base !== undefined ? {alt: 'right' as const} : {axisKept: `another axis (a cause tree keeps its direction: ${start})`}),
    explicitDir, mode: band.dir === 'auto' ? 'auto' : 'omitted', ...(band.maxNodeW === undefined || band.maxNodeW === 'auto' ? {} : {maxNodeW: band.maxNodeW}), ...(band.maxNodeW === 'auto' ? {autoWidth: true} : {}),
    build, layoutOf: r => ({lay: r.lay, vertical: r.vertical}), ...(band.base === undefined && band.layerFrom !== 'effect' ? {foldable: true, ...(band.fold === undefined ? {} : {fold: band.fold})} : {}), best: band.base !== undefined && band.dir === 'auto', ...(heightBudget === undefined ? {} : {heightBudget: heightBudget - (band.maxNodeW === 'auto' && canvasBound ? y : 0)}), // an attempt's size already holds the badge room (see build)
    ...(band.returns === 'outer' ? {notTried: ["returns: 'inline' (returns is written: 'outer')"]} : {}),
  });
  if (!fitted.ok) return {noFit: true, failure: fitted.failure};
  const attempt = fitted.result, {lines, vertical, flip} = attempt, fitApplied = fitted.applied;
  const {lay, routes} = attempt;
  const pad = padOf(vertical), total = {w: attempt.size.w - 2 * pad.x, h: attempt.size.h - 2 * pad.y};
  const dx = x + pad.x + (w - 2 * pad.x - total.w) / 2, dy = y + pad.y;
  const rectOf = (id: string) => {
    const p = must(lay.nodes.get(id)), q = vertical ? {x: p.y, y: p.x, w: p.h, h: p.w} : {x: p.x, y: p.y, w: p.w, h: p.h};
    if (flip) { if (vertical) q.y = total.h - (q.y + q.h); else q.x = total.w - (q.x + q.w); }
    return {x: q.x + dx, y: q.y + dy, w: q.w, h: q.h};
  };

  const out: LaidOutCause = {
    type: 'cause', ...(band.coreBadge === undefined ? {} : {coreBadge: band.coreBadge}), id: band.id, reveal: band.reveal, ...(band.unanchored ? {unanchored: band.unanchored} : {}), ...(band.origin ? {origin: band.origin} : {}), ...(band.until === undefined ? {} : {until: band.until}), x, y, w, h: total.h + 2 * pad.y,
    nodes: [], edges: [], ands: [], loose: attempt.loose, texts: [], anchors: [], labelBoxes: [],
    ...(fitApplied.length ? {fitApplied} : {}), ...(band.tree === 'nbr' ? {nbr: {vertical}} : {}), ...(band.focused ? {focused: band.focused} : {}),
  };
  for (const n of band.nodes) {
    const r = rectOf(n.id), role = CAUSE_ROLES[n.role ?? 'effect'];
    out.nodes.push({...r, tone: n.tone ?? role.tone, ...(role.double ? {double: true} : {}), ...(role.dashed ? {dashed: true} : {}), ...(n.core ? {core: true} : {}), ...(n.role === 'obstacle' || n.role === 'risk' ? {hex: true} : {})});
    out.anchors.push({id: n.id, ...r}); // all of them: verify and connect() routing read this list (an unanchored entity is only left out of the registry, by placedBand)
    const l = must(lines.get(n.id));
    out.texts.push(...nodeRuns({x: r.x + (r.w - l.w) / 2, y: r.y + (r.h - l.h) / 2, w: l.w}, l, roles));
    out.labelBoxes.push({label: n.label, ...r});
  }
  const drawn = new Map<number, number>(); // arrow index -> index in out.edges
  for (const [i, e] of lay.edges.entries()) {
    if (e.self) continue;
    drawn.set(e.index, out.edges.length);
    const ar = must(arrows[e.index]);
    out.edges.push({from: e.from, to: e.to, points: must(routes.get(i)), line: ar.line, ...(ar.back ? {back: true as const} : {}), ...(e.outer ? {outer: true as const} : {}), ...(ar.blocks ? {kind: 'blocks' as const} : {}), ...(band.hop && e.reversed ? {reversed: true as const} : {})});
  }
  // an AND: an arc across the last run of each of its arrows, a little before the arrowheads. It needs the arrows to arrive on
  // one side of the effect, all heading the same way, with room before the head for the arc
  for (const g of groups) {
    const {ends, d, along, cross, ok} = andEnds(g, k => must(out.edges[must(drawn.get(k))]).points);
    if (!ok) continue;
    const us = ends.map(e => cross(e.tip)), tip = must(ends[0]).tip;
    // the arc ends short of the nearest other arrow into this effect (another AND's arc, or an arrow of its own), so two arcs never touch
    // only an arrow that arrives on the same side: a return on the far side of the effect (or a blocks arrow) is nowhere near the arc, and measuring against it left the arc short of its own arrows
    const others = out.edges.filter((e, k) => e.to === g.to && !g.arrows.some(a => drawn.get(a) === k) && Math.abs(along(must(e.points.at(-1))) - along(tip)) < 1).map(e => cross(must(e.points.at(-1))));
    const reachTo = (u: number, sign: 1 | -1): number => Math.max(0, Math.min(AND_REACH, ...others.filter(o => (o - u) * sign > 0).map(o => Math.abs(o - u) / 2 - 5)));
    const lo = Math.min(...us) - reachTo(Math.min(...us), -1), hi = Math.max(...us) + reachTo(Math.max(...us), 1);
    const at = (u: number, dist: number): Pt => d.x ? {x: tip.x - d.x * dist, y: u} : {x: u, y: tip.y - d.y * dist};
    out.ands.push({to: g.to, from: g.arrows.map(k => must(arrows[k]).from), p0: at(lo, AND_END), c: at((lo + hi) / 2, 2 * AND_PEAK - AND_END), p1: at(hi, AND_END)});
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

const boxText = (k: typeof KEYS[number], v: CloudBox, sep = '：'): string => `${LETTER[k]}${sep}${typeof v === 'string' ? v : v.text}`;
const injectionText = (t: string): string => `→ ${t}`;
/** The number of each assumption (in the order written) and, per arrow, the chip text that lists its numbers. */
function numbering(band: CloudBand): {chip: Partial<Record<CloudArrow, string>>; n: number[]} {
  const by: Partial<Record<CloudArrow, number[]>> = {};
  (band.assumptions ?? []).forEach((a, i) => (by[a.on] ??= []).push(i + 1));
  return {chip: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.join(',')])), n: (band.assumptions ?? []).map((_, i) => i + 1)};
}

export function cloudTexts(band: CloudBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const k of KEYS) out.push([boxText(k, band[k], band.separator), roles.body, 700, 'sans']);
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
  const lines = Object.fromEntries(KEYS.map(k => [k, measureNode(boxText(k, band[k], band.separator), undefined, colW, widthOf, roles, env.wrap, env.keepWords, {keepWords: false})])) as Record<typeof KEYS[number], ReturnType<typeof measureNode>>;
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
    out.labelBoxes.push({label: boxText(k, v, band.separator), ...r});
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
