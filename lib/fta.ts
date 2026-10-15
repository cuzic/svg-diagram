// faultTree(): a fault tree (FTA, ADR 0025). The top event is a rectangle; under it a gate (AND / OR / k-of-n vote / inhibit) and the events
// that cause it, down to basic events (circle), undeveloped events (diamond) and house events (house). Each event's text is always in a
// rectangle; its kind's symbol hangs under it (a circle inside which the text sits would grow with the text and widen the tree).
// An event and the gate under it are one "compound node" laid out by layoutTree (a pure tree: a repeated event is drawn again, never joined).
import {layoutTree} from './graph-layout.ts';
import type {TreeNode} from './graph-layout.ts';
import {fitLayout} from './fit-width.ts';
import type {FitResult} from './fit-width.ts';
import {measureNode, nodeRuns} from './tree.ts';
import {textWidth} from './atoms.ts';
import {wrapText} from './wrap.ts';
import {SHARED_LIMIT, ftaVar, minimalCutSets, singlePoints, topProbability} from './fta-analysis.ts';
import type {NodeLines} from './tree.ts';
import type {FontFamily, Roles, WidthOf} from './types/core.ts';
import type {FtaBand, FtaEvent, FtaGate, FtaKind, LaidOutFta} from './types/diagrams.ts';

export const FTA_KINDS = ['event', 'basic', 'undeveloped', 'house', 'condition'] as const;
export const FTA_GATES = ['and', 'or', 'vote', 'inhibit'] as const;
const LEAVES: readonly FtaKind[] = ['basic', 'undeveloped', 'house', 'condition'];

/** An event as drawn: `ref` events are resolved to the event they repeat. */
export interface FtaNode {
  key: string;
  label: string;
  sub?: string;
  kind: FtaKind;
  /** Set on the first drawing of an event with an id (the anchor); a repeat has none. */
  id?: string;
  /** A repeat of the event with this id. */
  copyOf?: string;
  gate?: FtaGate;
  k?: number;
  state?: boolean;
  p?: number;
  children: FtaNode[];
  cond?: FtaNode;
}

const STATE_TEXT = {true: '常に発生すると仮定', false: '発生しないと仮定'} as const;
/** A probability as written on an event and in the note: 2 significant digits, in exponent form below 0.001. */
export const fmtP = (p: number): string => p === 0 ? '0' : p === 1 ? '1' : p >= 0.001 ? String(Number(p.toPrecision(2))) : p.toExponential(1);
const stateSub = (n: Pick<FtaNode, 'kind' | 'state' | 'sub' | 'p'>, quant = false): string | undefined => {
  const base = n.sub ?? (n.kind === 'house' && n.state !== undefined ? STATE_TEXT[`${n.state}`] : undefined);
  if (!quant || n.p === undefined || n.kind === 'house') return base;
  return base ? `${base} (p = ${fmtP(n.p)})` : `p = ${fmtP(n.p)}`;
};

/** The note under a tree with `quant`: the probability of the top event and what it assumes. Throws naming the events that have no `p`. */
export function ftaQuant(root: FtaNode, period?: string): string {
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
  const head = bound ? `頂上事象の確率 ≦ ${fmtP(p)}（上限の概算。共有の基本事象が ${SHARED_LIMIT} 個を超えたため min-cut upper bound）` : `頂上事象の確率 ${fmtP(p)}`;
  return `${period ? `期間: ${period}。` : ''}${head}。基本事象は互いに独立と仮定`;
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

/** Validates the tree (every error throws, naming the event) and resolves the repeats. */
export function ftaResolve(top: FtaEvent): {root: FtaNode; nodes: FtaNode[]} {
  if (!top || typeof top !== 'object') throw new Error('faultTree(top) needs the top event: {label: "...", gate: "or", children: [...]}');
  type Slot = 'top' | 'child' | 'condition';
  const defs = new Map<string, {ev: FtaEvent; slot: Slot}>();
  const collect = (e: FtaEvent, slot: Slot): void => {
    if (!e || typeof e !== 'object') throw new Error('faultTree(): every event must be an object');
    if (e.ref !== undefined) return;
    if (e.id !== undefined) {
      if (typeof e.id !== 'string' || !e.id) throw new Error(`faultTree(): the id of "${e.label}" must be a non-empty string`);
      if (defs.has(e.id)) throw new Error(`faultTree(): duplicate event id "${e.id}"`);
      defs.set(e.id, {ev: e, slot});
    }
    if (e.children !== undefined && !Array.isArray(e.children)) throw new Error(`faultTree(): "${e.label}": children must be an array`);
    for (const c of e.children ?? []) collect(c, 'child');
    if (e.condition !== undefined) collect(e.condition, 'condition');
  };
  collect(top, 'top');
  const kindOf = (e: FtaEvent, slot: Slot): FtaKind => {
    const k = e.kind ?? (slot === 'condition' ? 'condition' : 'event');
    if (!(FTA_KINDS as readonly string[]).includes(k)) throw new Error(`faultTree(): "${e.label}" has kind ${String(k)} (use ${FTA_KINDS.join(' | ')})`);
    return k;
  };
  const check = (e: FtaEvent, slot: Slot): FtaKind => {
    const name = `"${e.label}"`, kind = kindOf(e, slot);
    if (typeof e.label !== 'string' || !e.label.trim()) throw new Error('faultTree(): every event needs a label');
    if (e.p !== undefined && !(typeof e.p === 'number' && e.p >= 0 && e.p <= 1)) throw new Error(`faultTree(): ${name}: p is a probability, a number from 0 to 1 (got ${String(e.p)})`);
    if (slot === 'condition' && kind !== 'condition') throw new Error(`faultTree(): the condition of an inhibit gate ${name} must be a condition event (kind: 'condition', or leave kind out)`);
    if (slot !== 'condition' && kind === 'condition') throw new Error(`faultTree(): ${name} is a condition event: it only goes in the \`condition\` of an inhibit gate`);
    if (slot === 'top' && kind !== 'event' && kind !== 'basic' && kind !== 'undeveloped') throw new Error(`faultTree(): the top event ${name} cannot be a ${kind} event`);
    if (kind === 'event') {
      if (e.gate === undefined || !e.children?.length) throw new Error(`faultTree(): ${name} needs a gate and children (an event that goes no further is kind: 'undeveloped' or 'basic')`);
      if (!(FTA_GATES as readonly string[]).includes(e.gate)) throw new Error(`faultTree(): ${name} has gate ${String(e.gate)} (use ${FTA_GATES.join(' | ')})`);
      if (e.state !== undefined) throw new Error(`faultTree(): ${name}: state is for a house event`);
      if (e.gate === 'vote') {
        const n = e.children.length;
        if (!(typeof e.k === 'number' && Number.isInteger(e.k) && e.k >= 1 && e.k <= n)) throw new Error(`faultTree(): ${name}: a vote gate needs k, a whole number from 1 to the number of inputs (${n}); got ${String(e.k)}`);
      } else if (e.k !== undefined) throw new Error(`faultTree(): ${name}: k is for a vote gate`);
      if (e.gate === 'inhibit') {
        if (e.children.length !== 1) throw new Error(`faultTree(): ${name}: an inhibit gate has one input in children (got ${e.children.length}) and one condition`);
        if (e.condition === undefined) throw new Error(`faultTree(): ${name}: an inhibit gate needs a condition`);
      } else if (e.condition !== undefined) throw new Error(`faultTree(): ${name}: condition is for an inhibit gate`);
    } else {
      for (const f of ['gate', 'children', 'condition', 'k'] as const) if (e[f] !== undefined) throw new Error(`faultTree(): ${name} is a ${kind} event: it takes no ${f}`);
      if (kind === 'house') { if (typeof e.state !== 'boolean') throw new Error(`faultTree(): the house event ${name} needs state: true (it always happens) or false (it never does)`); }
      else if (e.state !== undefined) throw new Error(`faultTree(): ${name}: state is for a house event`);
    }
    return kind;
  };
  let counter = 0;
  const nodes: FtaNode[] = [];
  const build = (e: FtaEvent, slot: Slot): FtaNode => {
    let src = e, copyOf: string | undefined;
    if (e.ref !== undefined) {
      const extra = Object.keys(e).filter(k => k !== 'ref');
      if (extra.length) throw new Error(`faultTree(): {ref: "${e.ref}"} takes no other field (${extra.join(', ')}): write them on the event it repeats`);
      const def = defs.get(e.ref);
      if (!def) throw new Error(`faultTree(): {ref: "${e.ref}"} names no event (ids: ${[...defs.keys()].join(', ') || 'none'})`);
      const k = kindOf(def.ev, def.slot);
      if (!LEAVES.includes(k)) throw new Error(`faultTree(): {ref: "${e.ref}"} repeats an event with a gate under it; only a basic, undeveloped, house or condition event can be repeated`);
      if ((k === 'condition') !== (slot === 'condition')) throw new Error(`faultTree(): {ref: "${e.ref}"} is ${k === 'condition' ? 'a condition event: it only goes in the `condition` of an inhibit gate' : 'not a condition event: the condition of an inhibit gate must be one'}`);
      src = def.ev;
      copyOf = e.ref;
    }
    const kind = check(src, src === e ? slot : def_slot(src));
        const node: FtaNode = {
      key: `n${counter++}`, label: src.label as string, kind, children: [],
      ...(src.sub === undefined ? {} : {sub: src.sub}), ...(copyOf !== undefined ? {copyOf} : src.id !== undefined ? {id: src.id} : {}),
      ...(src.gate === undefined ? {} : {gate: src.gate}), ...(src.k === undefined ? {} : {k: src.k}), ...(src.state === undefined ? {} : {state: src.state}), ...(src.p === undefined ? {} : {p: src.p}),
    };
    nodes.push(node);
    if (copyOf === undefined) {
      node.children = (src.children ?? []).map(c => build(c, 'child'));
      if (src.condition !== undefined) node.cond = build(src.condition, 'condition');
    }
    return node;
  };
  const def_slot = (ev: FtaEvent): Slot => [...defs.values()].find(d => d.ev === ev)?.slot ?? 'child';
  const root = build(top, 'top');
  return {root, nodes};
}

/** The label under a single point of failure: an event that was never developed is not called a failure point. */
const SINGLE_TEXT = {basic: '単一故障点', undeveloped: '未展開・単独で頂上へ'} as const;
const singleText = (n: FtaNode): string | undefined => n.gate === undefined && (n.kind === 'basic' || n.kind === 'undeveloped') ? SINGLE_TEXT[n.kind] : undefined;

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
    const sub = stateSub(n, band.quant);
    if (sub) out.push([sub, roles.note, 400, 'sans']);
    const bt = single.has(ftaVar(n)) ? singleText(n) : undefined;
    if (bt) out.push([bt, roles.note, 700, 'sans']);
  }
  if (band.quant) out.push([ftaQuant(root, band.quantPeriod), roles.note, 400, 'sans']);
  return out;
}

// sizes of the parts of a compound node
const NOTE_GAP = 16;
const BADGE_GAP = 6, BADGE_PAD_X = 10, BADGE_H = 22;
const STEM = 10, GATE_W = 40, GATE_H = 36, MARK_W = 26, MARK_H = 26, COND_MARK_W = 40, COND_MARK_H = 24, COND_GAP = 22, GAP = 24, LEVEL_GAP = 36;
const NODE_MAX = 200;

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

export function layoutFta(band: FtaBand, x: number, y: number, w: number, widthOf: WidthOf, roles: Roles): LaidOutFta {
  const {root} = ftaResolve(band.root);
  const single = band.cutSets ? ftaSinglePoints(root) : new Set<string>();
  const attempt = (maxW: number): Attempt => {
    const comps = new Map<string, Comp>();
    const measure = (n: FtaNode): Comp => {
      const sub = stateSub(n, band.quant), lines = measureNode(n.label, sub, maxW, widthOf, roles);
      const c: Comp = {node: n, lines, rect: {w: lines.w, h: lines.h}, w: lines.w, h: 0, outY: 0};
      if (n.gate !== undefined) {
        let below = GATE_H;
        if (n.cond) {
          const cl = measureNode(n.cond.label, stateSub(n.cond, band.quant), maxW, widthOf, roles);
          c.cond = {node: n.cond, lines: cl, w: cl.w, h: cl.h};
          below = Math.max(GATE_H, cl.h + STEM + COND_MARK_H);
          c.w = Math.max(c.w, GATE_W + 2 * (COND_GAP + cl.w)); // symmetric, so the lines to the children leave from under the event's centre
        }
        c.w = Math.max(c.w, GATE_W);
        c.outY = c.rect.h + STEM + GATE_H;
        c.h = c.rect.h + STEM + below;
      } else {
        c.w = Math.max(c.w, MARK_W);
        c.h = c.outY = c.rect.h + STEM + MARK_H;
        const bt = single.has(ftaVar(n)) ? singleText(n) : undefined;
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
    const toTree = (n: FtaNode): TreeNode => ({id: n.key, size: {w: comps.get(n.key)!.w, h: comps.get(n.key)!.h}, ...(n.children.length ? {children: n.children.map(toTree)} : {})});
    const tree = layoutTree(toTree(root), {dir: 'down', gap: GAP, levelGap: LEVEL_GAP});
    return {size: {w: tree.w, h: tree.h}, score: {crossings: 0, bends: 0}, comps, tree, root};
  };
  const auto = band.maxNodeW === 'auto';
  const written = typeof band.maxNodeW === 'number' ? band.maxNodeW : undefined;
  const fitted = fitLayout<'down', Attempt>({
    who: 'faultTree()', w, start: 'down', explicitDir: false, mode: auto ? 'auto' : 'omitted', noDir: true,
    axisKept: 'another direction (a fault tree grows down)', ...(written === undefined ? {} : {maxNodeW: written}),
    build: (_d, maxW) => attempt(maxW), fix: "a wider figure (diagram({width})), or a smaller tree",
  });
  const {tree, comps} = fitted.result;
  const dx = x + (w - tree.w) / 2, dy = y;
  const out: LaidOutFta = {
    type: 'fta', ...(band.id === undefined ? {} : {id: band.id}), ...(band.reveal === undefined ? {} : {reveal: band.reveal}), ...(band.until === undefined ? {} : {until: band.until}),
    x, y, w, h: tree.h, nodes: [], marks: [], badges: [], gates: [], edges: [], texts: [], anchors: [], labelBoxes: [],
    ...(fitted.applied.length ? {fitApplied: fitted.applied} : {}),
  } as LaidOutFta;
  const place = (n: FtaNode, px: number, py: number, pw: number, cl: NodeLines, rw: number, rh: number): {x: number; y: number; w: number; h: number} => {
    const r = {x: px + (pw - rw) / 2, y: py, w: rw, h: rh};
    out.nodes.push({...r, kind: n.kind, ...(n.id === undefined ? {} : {id: n.id})});
    if (n.id !== undefined) out.anchors.push({id: n.id, ...r});
    out.labelBoxes.push({label: n.label, ...r});
    out.texts.push(...nodeRuns(r, cl, roles));
    return r;
  };
  const cx = (p: {x: number; w: number}): number => p.x + p.w / 2;
  const seg = (a: {x: number; y: number}, b: {x: number; y: number}) => out.edges.push({points: [a, b]});
  for (const [key, p] of tree.nodes) {
    const c = comps.get(key)!, n = c.node, px = p.x + dx, py = p.y + dy, mid = px + p.w / 2;
    const r = place(n, px, py, p.w, c.lines, c.rect.w, c.rect.h);
    if (n.gate === undefined) {
      const m = {x: mid - MARK_W / 2, y: r.y + r.h + STEM, w: MARK_W, h: MARK_H};
      out.marks.push({...m, kind: n.kind, ...(c.badge ? {single: true as const} : {})});
      seg({x: mid, y: r.y + r.h}, {x: mid, y: m.y});
      if (c.badge) out.badges.push({x: mid - c.badge.w / 2, y: m.y + m.h + BADGE_GAP, w: c.badge.w, h: BADGE_H, text: c.badge.text, size: roles.note});
      continue;
    }
    const g = {x: mid - GATE_W / 2, y: r.y + r.h + STEM, w: GATE_W, h: GATE_H};
    out.gates.push({...g, gate: n.gate, ...(n.gate === 'vote' ? {label: {text: `${n.k}/${n.children.length}`, size: roles.note}} : {})});
    seg({x: mid, y: r.y + r.h}, {x: mid, y: g.y});
    if (c.cond) {
      const cr = {x: g.x + g.w + COND_GAP, y: g.y};
      const cr2 = place(c.cond.node, cr.x, cr.y, c.cond.w, c.cond.lines, c.cond.w, c.cond.h);
      const m = {x: cx(cr2) - COND_MARK_W / 2, y: cr2.y + cr2.h + STEM, w: COND_MARK_W, h: COND_MARK_H};
      out.marks.push({...m, kind: 'condition'});
      seg({x: cx(cr2), y: cr2.y + cr2.h}, {x: cx(cr2), y: m.y});
      const ly = Math.min(Math.max(g.y + GATE_H / 2, cr2.y + 8), cr2.y + cr2.h - 8); // the gate's output height, kept on the condition's box
      seg({x: g.x + g.w, y: ly}, {x: cr2.x, y: ly});
    }
  }
  for (const e of tree.edges) {
    const from = comps.get(e.from)!, pts = e.points.map(q => ({x: q.x + dx, y: q.y + dy}));
    pts[0] = {x: pts[0].x, y: tree.nodes.get(e.from)!.y + dy + from.outY}; // the lines leave from the bottom of the gate
    out.edges.push({points: pts});
  }
  if (band.quant) { // the probability of the top event and what it assumes, wrapped to the band, centred under the tree
    const note = ftaQuant(root, band.quantPeriod), lh = Math.round(roles.note * 1.4);
    const lines = wrapText(note, {maxWidth: w, atomWidth: a => widthOf(a, roles.note, 400, 'sans')});
    out.note = note;
    lines.forEach((t, i) => out.texts.push({text: t, x: x + w / 2, y: y + tree.h + NOTE_GAP + i * lh + roles.note, size: roles.note, bold: false, muted: true}));
    out.h = tree.h + NOTE_GAP + lines.length * lh;
  }
  return out;
}
