// faultTree(): a fault tree (FTA, ADR 0025). The top event is a rectangle; under it a gate (AND / OR / k-of-n vote / inhibit) and the events
// that cause it, down to basic events (circle), undeveloped events (diamond) and house events (house). Each event's text is always in a
// rectangle; its kind's symbol hangs under it (a circle inside which the text sits would grow with the text and widen the tree).
// An event and the gate under it are one "compound node" laid out by layoutTree (a pure tree: a repeated event is drawn again, never joined).
import {partStep} from './parts.ts';
import {layoutTree} from './graph-layout.ts';
import type {TreeNode} from './graph-layout.ts';
import {fitLayout} from './fit-width.ts';
import type {FitResult} from './fit-width.ts';
import {measureNode, nodeRuns} from './tree.ts';
import {textWidth} from './atoms.ts';
import {wrapText} from './wrap.ts';
import {SHARED_LIMIT, ftaVar, minimalCutSets, singlePoints, topProbability} from './fta-analysis.ts';
import type {NodeLines} from './tree.ts';
import type {FontFamily, Roles, WidthOf, WrapEnv} from './types/core.ts';
import type {FtaBand, FtaEvent, FtaWords, LaidOutFta} from './types/diagrams.ts';
import {must} from './must.ts';

import {ftaResolve} from './fta-resolve.ts';
import type {FtaNode} from './fta-resolve.ts';
export {FTA_KINDS, FTA_GATES, ftaResolve} from './fta-resolve.ts';
export type {FtaNode} from './fta-resolve.ts';

/** The Japanese the tree writes by itself, unless `words` says otherwise. */
const WORDS: Required<FtaWords> = {
  singlePoint: '単一故障点', undevelopedAlone: '未展開・単独で頂上へ', houseTrue: '常に発生すると仮定', houseFalse: '発生しないと仮定',
  period: '期間: {period}。', topP: '頂上事象の確率 {p}', topBound: '頂上事象の確率 ≦ {p}（上限の概算。共有の基本事象が {n} 個を超えたため min-cut upper bound）', assumption: '。基本事象は互いに独立と仮定',
};
const wordsOf = (w?: FtaWords): Required<FtaWords> => ({...WORDS, ...w});
const fill = (t: string, v: Record<string, string>): string => t.replace(/\{(p|n|period)\}/g, (_, k: string) => v[k] ?? '');
/** A probability as written on an event and in the note: 2 significant digits, in exponent form below 0.001. */
export const fmtP = (p: number): string => p === 0 ? '0' : p === 1 ? '1' : p >= 0.995 ? `1 − ${(1 - p).toExponential(1)}` : p >= 0.001 ? String(Number(p.toPrecision(2))) : p.toExponential(1);
const stateSub = (n: Pick<FtaNode, 'kind' | 'state' | 'sub' | 'p' | 'gate'>, quant = false, words?: FtaWords): string | undefined => {
  const w = wordsOf(words);
  const base = n.sub ?? (n.kind === 'house' && n.state !== undefined ? (n.state ? w.houseTrue : w.houseFalse) : undefined);
  if (!quant || n.p === undefined || n.kind === 'house' || n.gate !== undefined) return base;
  return base ? `${base} (p = ${fmtP(n.p)})` : `p = ${fmtP(n.p)}`;
};

/** The note under a tree with `quant`: the probability of the top event and what it assumes. Throws naming the events that have no `p`. */
export function ftaQuant(root: FtaNode, period?: string, words?: FtaWords): string {
  const missing: string[] = [];
  const seen = new Set<string>();
  const scan = (n: FtaNode): void => {
    if (n.gate === undefined && n.kind !== 'house' && n.p === undefined && !seen.has(ftaVar(n))) { seen.add(ftaVar(n)); missing.push(`"${n.label}"`); }
    for (const c of n.children) scan(c);
    if (n.cond) scan(n.cond);
  };
  scan(root);
  if (missing.length) throw new Error(`faultTree({quant: true}): these events have no p (a probability from 0 to 1): ${missing.join(', ')}`);
  const {p, bound} = topProbability(root);
  const w = wordsOf(words), v = {p: fmtP(p), n: String(SHARED_LIMIT), period: period ?? ''};
  return `${period ? fill(w.period, v) : ''}${fill(bound ? w.topBound : w.topP, v)}${fill(w.assumption, v)}`;
}

/** The ids of the events written with an `id` (not the `ref` repeats): what connect() can reach. Does not validate. */
export function ftaIds(top: FtaEvent): string[] {
  const out: string[] = [];
  const walk = (e: FtaEvent | undefined): void => {
    if (!e || typeof e !== 'object' || e.ref !== undefined) return;
    if (typeof e.id === 'string') out.push(e.id);
    for (const c of e.children ?? []) walk(c);
    walk(e.condition);
  };
  walk(top);
  return out;
}

/** The label under a single point of failure: an event that was never developed is not called a failure point. */
const singleText = (n: FtaNode, words?: FtaWords): string | undefined => n.gate === undefined && (n.kind === 'basic' || n.kind === 'undeveloped') ? (n.kind === 'basic' ? wordsOf(words).singlePoint : wordsOf(words).undevelopedAlone) : undefined;

/** The variables that alone bring the top event about. Throws when the tree has too many cut sets to find them (a tree with `cutSets: true` is never analysed by guessing). */
export function ftaSinglePoints(root: FtaNode): Set<string> {
  const cuts = minimalCutSets(root);
  if (cuts.truncated) throw new Error('faultTree({cutSets: true}): the tree has too many cut sets to find the single points of failure; simplify the tree (fewer vote gates, fewer events under an AND of ORs)');
  return singlePoints(cuts);
}

export function ftaTexts(band: FtaBand, roles: Roles): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  const {root, nodes} = ftaResolve(band.root);
  const single = band.cutSets ? ftaSinglePoints(root) : new Set<string>();
  for (const n of nodes) {
    out.push([n.label, roles.body, 700, 'sans']);
    const sub = stateSub(n, band.quant, band.words);
    if (sub) out.push([sub, roles.note, 400, 'sans']);
    const bt = single.has(ftaVar(n)) ? singleText(n, band.words) : undefined;
    if (bt) out.push([bt, roles.note, 700, 'sans']);
  }
  if (band.quant) out.push([ftaQuant(root, band.quantPeriod, band.words), roles.note, 400, 'sans']);
  return out;
}

// sizes of the parts of a compound node
const NOTE_GAP = 16;
const BADGE_GAP = 6, BADGE_PAD_X = 10, BADGE_H = 22;
const STEM = 10, GATE_W = 40, GATE_H = 36, MARK_W = 26, MARK_H = 26, COND_MARK_W = 40, COND_MARK_H = 24, COND_GAP = 22, GAP = 24, LEVEL_GAP = 36;

interface Comp {
  node: FtaNode;
  lines: NodeLines;
  /** The rectangle's size and the whole compound node's. */
  rect: {w: number; h: number};
  cond?: {node: FtaNode; lines: NodeLines; w: number; h: number};
  /** A single point of failure's label, under its symbol. */
  badge?: {text: string; w: number};
  w: number;
  h: number;
  /** The height down to the bottom of the gate (the point the children's lines leave from). */
  outY: number;
}

interface Attempt extends FitResult {
  comps: Map<string, Comp>;
  tree: ReturnType<typeof layoutTree>;
  root: FtaNode;
}

export function layoutFta(band: FtaBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles, env: WrapEnv): LaidOutFta {
  const {root} = ftaResolve(band.root);
  const single = band.cutSets ? ftaSinglePoints(root) : new Set<string>();
  const attempt = (maxW: number, floor: boolean): Attempt => {
    const comps = new Map<string, Comp>();
    const measure = (n: FtaNode): Comp => {
      const sub = stateSub(n, band.quant, band.words), lines = measureNode(n.label, sub, maxW, widthOf, roles, env.wrap, floor);
      const c: Comp = {node: n, lines, rect: {w: lines.w, h: lines.h}, w: lines.w, h: 0, outY: 0};
      if (n.gate !== undefined) {
        let below = GATE_H;
        if (n.cond) {
          const cl = measureNode(n.cond.label, stateSub(n.cond, band.quant, band.words), maxW, widthOf, roles, env.wrap, floor);
          c.cond = {node: n.cond, lines: cl, w: cl.w, h: cl.h};
          below = Math.max(GATE_H, cl.h + STEM + COND_MARK_H);
          c.w = Math.max(c.w, GATE_W + 2 * (COND_GAP + cl.w)); // symmetric, so the lines to the children leave from under the event's centre
        }
        c.w = Math.max(c.w, GATE_W);
        c.outY = c.rect.h + STEM + (n.gate === 'or' || n.gate === 'vote' ? GATE_H * 0.83 : GATE_H); // an OR / vote gate's bottom is a curve whose middle is at 0.83 of its height
        c.h = c.rect.h + STEM + below;
      } else {
        c.w = Math.max(c.w, MARK_W);
        c.h = c.outY = c.rect.h + STEM + MARK_H;
        const bt = single.has(ftaVar(n)) ? singleText(n, band.words) : undefined;
        if (bt) {
          c.badge = {text: bt, w: Math.ceil(textWidth(widthOf, bt, roles.note, 700)) + 2 * BADGE_PAD_X};
          c.w = Math.max(c.w, c.badge.w);
          c.h += BADGE_GAP + BADGE_H;
        }
      }
      comps.set(n.key, c);
      for (const k of n.children) measure(k);
      return c;
    };
    measure(root);
    const toTree = (n: FtaNode): TreeNode => { const sz = must(comps.get(n.key)); return {id: n.key, size: {w: sz.w, h: sz.h}, ...(n.children.length ? {children: n.children.map(toTree)} : {})}; };
    const tree = layoutTree(toTree(root), {dir: 'down', gap: Math.round(GAP * (env.space ?? 1)), levelGap: Math.round(LEVEL_GAP * (env.space ?? 1))});
    return {size: {w: tree.w, h: tree.h}, score: {crossings: 0, bends: 0}, comps, tree, root};
  };
  const auto = band.maxNodeW === 'auto';
  const written = typeof band.maxNodeW === 'number' ? band.maxNodeW : undefined;
  const fitted = fitLayout<'down', Attempt>({
    who: 'faultTree()', w, start: 'down', keepWords: env.keepWords, explicitDir: false, mode: auto ? 'auto' : 'omitted', noDir: true,
    axisKept: 'another direction (a fault tree grows down)', ...(written === undefined ? {} : {maxNodeW: written}),
    build: (_d, maxW, floor) => attempt(maxW, floor), fix: "a wider figure (diagram({width})), or a smaller tree",
  });
  const {tree, comps} = fitted.result;
  const dx = x + (w - tree.w) / 2, dy = y;
  const out: LaidOutFta = {
    type: 'fta', ...(band.id === undefined ? {} : {id: band.id}), ...(band.reveal === undefined ? {} : {reveal: band.reveal}), ...(band.until === undefined ? {} : {until: band.until}),
    x, y, w, h: tree.h, nodes: [], marks: [], badges: [], gates: [], edges: [], texts: [], anchors: [], labelBoxes: [],
    ...(fitted.applied.length ? {fitApplied: fitted.applied} : {}),
  } as LaidOutFta;
  // ADR 0054: an event (its box, text, stem and the symbol under it: a gate, or a mark with its badge) is one part
  const partOf = (n: FtaNode, key: string): string => partStep('event', n.id ?? {index: key}, n.label);
  const place = (n: FtaNode, px: number, py: number, pw: number, cl: NodeLines, rw: number, rh: number, part: string): {x: number; y: number; w: number; h: number} => {
    const r = {x: px + (pw - rw) / 2, y: py, w: rw, h: rh};
    out.nodes.push({...r, kind: n.kind, ...(n.id === undefined ? {} : {id: n.id}), part});
    if (n.id !== undefined) out.anchors.push({id: n.id, ...r});
    out.labelBoxes.push({label: n.label, ...r});
    out.texts.push(...nodeRuns(r, cl, roles).map(t => ({...t, part})));
    return r;
  };
  const cx = (p: {x: number; w: number}): number => p.x + p.w / 2;
  const seg = (a: {x: number; y: number}, b: {x: number; y: number}, part?: string) => out.edges.push({points: [a, b], ...(part ? {part} : {})});
  for (const [key, p] of tree.nodes) {
    const c = must(comps.get(key)), n = c.node, px = p.x + dx, py = p.y + dy, mid = px + p.w / 2, part = partOf(n, String(key));
    const r = place(n, px, py, p.w, c.lines, c.rect.w, c.rect.h, part);
    if (n.gate === undefined) {
      const m = {x: mid - MARK_W / 2, y: r.y + r.h + STEM, w: MARK_W, h: MARK_H};
      out.marks.push({...m, kind: n.kind, ...(c.badge ? {single: true as const} : {}), part});
      seg({x: mid, y: r.y + r.h}, {x: mid, y: m.y}, part);
      if (c.badge) out.badges.push({x: mid - c.badge.w / 2, y: m.y + m.h + BADGE_GAP, w: c.badge.w, h: BADGE_H, text: c.badge.text, size: roles.note, part});
      continue;
    }
    const g = {x: mid - GATE_W / 2, y: r.y + r.h + STEM, w: GATE_W, h: GATE_H};
    out.gates.push({...g, gate: n.gate, ...(n.gate === 'vote' ? {label: {text: `${n.k}/${n.children.length}`, size: roles.note}} : {}), part});
    seg({x: mid, y: r.y + r.h}, {x: mid, y: g.y}, part);
    if (c.cond) {
      const cr = {x: g.x + g.w + COND_GAP, y: g.y}, cpart = partOf(c.cond.node, `${key}.cond`);
      const cr2 = place(c.cond.node, cr.x, cr.y, c.cond.w, c.cond.lines, c.cond.w, c.cond.h, cpart);
      const m = {x: cx(cr2) - COND_MARK_W / 2, y: cr2.y + cr2.h + STEM, w: COND_MARK_W, h: COND_MARK_H};
      out.marks.push({...m, kind: 'condition', part: cpart});
      seg({x: cx(cr2), y: cr2.y + cr2.h}, {x: cx(cr2), y: m.y}, cpart);
      const ly = Math.min(Math.max(g.y + GATE_H / 2, cr2.y + 8), cr2.y + cr2.h - 8); // the gate's output height, kept on the condition's box
      seg({x: g.x + g.w, y: ly}, {x: cr2.x, y: ly});
    }
  }
  for (const e of tree.edges) {
    const from = must(comps.get(e.from)), pts = e.points.map(q => ({x: q.x + dx, y: q.y + dy}));
    pts[0] = {x: must(pts[0]).x, y: must(tree.nodes.get(e.from)).y + dy + from.outY}; // the lines leave from the bottom of the gate
    out.edges.push({points: pts});
  }
  if (band.quant) { // the probability of the top event and what it assumes, wrapped to the band, centred under the tree
    const note = ftaQuant(root, band.quantPeriod, band.words), lh = Math.round(roles.note * 1.4);
    const lines = wrapText(note, {maxWidth: w, atomWidth: a => widthOf(a, roles.note, 400, 'sans'), mode: env.wrap});
    out.note = note;
    lines.forEach((t, i) => out.texts.push({text: t, x: x + w / 2, y: y + tree.h + NOTE_GAP + i * lh + roles.note, size: roles.note, bold: false, muted: true}));
    out.h = tree.h + NOTE_GAP + lines.length * lh;
  }
  return out;
}
