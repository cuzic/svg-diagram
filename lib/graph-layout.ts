// Pure graph layout for the diagram parts that place themselves: org charts and trees (layoutTree), mind maps (layoutBalanced),
// state machines and flows (layoutLayered). No bands, fonts or SVG here: sizes in, rectangles and edge polylines out, so each
// part measures its own boxes, calls one of these, and draws the result. Deterministic: the same input is the same output,
// ties are broken by input order.

export interface Size {w: number; h: number}
export interface Placed extends Size {x: number; y: number}
export interface Pt {x: number; y: number}
export type Dir = 'down' | 'right';

export interface TreeNode {id: string; size: Size; children?: TreeNode[]}
export interface TreeOpts {dir?: Dir; /** space between siblings */ gap?: number; /** space between a level and the next */ levelGap?: number}
/** A `{` brace gathering the children of one parent (map-layouts.ts): its spine at x from y1 to y2, the tip at (tipX, ymid) pointing at the parent. */
export interface Brace {x: number; y1: number; y2: number; ymid: number; tipX: number; side: 'right' | 'left'}
export interface TreeLayout {
  nodes: Map<string, Placed>;
  /** parent -> child polylines (centre to centre, elbow at the half-way level); `curve`: drawn as a smooth S along that axis; `bold`: a spine */
  edges: {from: string; to: string; points: Pt[]; curve?: 'x' | 'y'; bold?: boolean}[];
  braces?: Brace[];
  w: number;
  h: number;
}

const GAP = 24, LEVEL_GAP = 40;

const dupCheck = (seen: Set<string>, id: string): void => {
  if (seen.has(id)) throw new Error(`graph layout: duplicate node id "${id}"`);
  seen.add(id);
};

/**
 * A tidy tree. Levels are aligned (every node of a level starts at the same depth offset), a parent is centred over its
 * children, and a subtree never overlaps its sibling. Not the most compact tree (no contour packing) but never overlaps and
 * reads as an org chart.
 */
export function layoutTree(root: TreeNode, opts: TreeOpts = {}): TreeLayout {
  const dir = opts.dir ?? 'down', gap = opts.gap ?? GAP, levelGap = opts.levelGap ?? LEVEL_GAP;
  // across = the axis siblings spread on, along = the axis levels grow on
  const across = (s: Size): number => dir === 'down' ? s.w : s.h, along = (s: Size): number => dir === 'down' ? s.h : s.w;
  const seen = new Set<string>(), levelDepth: number[] = [];
  const span = new Map<TreeNode, number>();
  const measure = (n: TreeNode, level: number): number => {
    dupCheck(seen, n.id);
    levelDepth[level] = Math.max(levelDepth[level] ?? 0, along(n.size));
    const kids = n.children ?? [];
    const kidsSpan = kids.reduce((s, k, i) => s + measure(k, level + 1) + (i ? gap : 0), 0);
    const mine = Math.max(across(n.size), kidsSpan);
    span.set(n, mine);
    return mine;
  };
  measure(root, 0);
  const levelAt: number[] = [];
  levelDepth.reduce((at, d, i) => (levelAt[i] = at, at + d + levelGap), 0);
  const centres = new Map<string, number>(), levels = new Map<string, number>();
  const place = (n: TreeNode, from: number, level: number): void => {
    const mine = span.get(n)!, kids = n.children ?? [];
    centres.set(n.id, from + mine / 2);
    levels.set(n.id, level);
    const kidsSpan = kids.reduce((s, k, i) => s + span.get(k)! + (i ? gap : 0), 0);
    let at = from + (mine - kidsSpan) / 2;
    for (const k of kids) { place(k, at, level + 1); at += span.get(k)! + gap; }
  };
  place(root, 0, 0);
  const nodes = new Map<string, Placed>();
  const index = (n: TreeNode): void => {
    const c = centres.get(n.id)!, l = levels.get(n.id)!;
    nodes.set(n.id, dir === 'down' ? {x: c - n.size.w / 2, y: levelAt[l], ...n.size} : {x: levelAt[l], y: c - n.size.h / 2, ...n.size});
    for (const k of n.children ?? []) index(k);
  };
  index(root);
  const edges: TreeLayout['edges'] = [];
  const link = (n: TreeNode): void => {
    const p = nodes.get(n.id)!;
    for (const k of n.children ?? []) {
      const q = nodes.get(k.id)!;
      const [a, b] = dir === 'down' ? [{x: p.x + p.w / 2, y: p.y + p.h}, {x: q.x + q.w / 2, y: q.y}] : [{x: p.x + p.w, y: p.y + p.h / 2}, {x: q.x, y: q.y + q.h / 2}];
      const mid = dir === 'down' ? (a.y + b.y) / 2 : (a.x + b.x) / 2;
      edges.push({from: n.id, to: k.id, points: dir === 'down' ? [a, {x: a.x, y: mid}, {x: b.x, y: mid}, b] : [a, {x: mid, y: a.y}, {x: mid, y: b.y}, b]});
      link(k);
    }
  };
  link(root);
  const total = span.get(root)!, depth = levelAt[levelAt.length - 1] + levelDepth[levelDepth.length - 1];
  return {nodes, edges, w: dir === 'down' ? total : depth, h: dir === 'down' ? depth : total};
}

/**
 * A mind map: the root in the middle, its children split into a right and a left half (balanced by height, input order kept
 * inside each half), each half a tree growing outward. `sides` pins a child to a side.
 */
export function layoutBalanced(root: TreeNode, opts: Omit<TreeOpts, 'dir'> & {sides?: Record<string, 'left' | 'right'>} = {}): TreeLayout {
  const levelGap = opts.levelGap ?? LEVEL_GAP, gap = opts.gap ?? GAP;
  const kids = root.children ?? [];
  const heightOf = (k: TreeNode): number => layoutTree(k, {dir: 'right', gap, levelGap}).h;
  const heights = kids.map(heightOf);
  const side: ('left' | 'right')[] = kids.map(k => opts.sides?.[k.id] ?? 'right');
  const load = {left: 0, right: 0};
  kids.forEach((k, i) => { if (opts.sides?.[k.id]) load[side[i]] += heights[i]; });
  // unpinned children: in the order written, the first half of what is left (by height) goes right, the rest left; each side reads top to bottom
  const free = kids.map((_, i) => i).filter(i => !opts.sides?.[kids[i].id]);
  const freeTotal = free.reduce((s, i) => s + heights[i], 0);
  let acc = 0;
  for (const i of free) {
    const mid = acc + heights[i] / 2;
    side[i] = load.right + mid <= (load.left + load.right + freeTotal) / 2 ? 'right' : 'left';
    acc += heights[i];
  }
  const half = (which: 'left' | 'right'): TreeLayout | null => {
    const ks = kids.filter((_, i) => side[i] === which);
    return ks.length ? layoutTree({id: `${root.id}\u0000${which}`, size: {w: 0, h: 0}, children: ks}, {dir: 'right', gap, levelGap}) : null;
  };
  const right = half('right'), left = half('left');
  const rightW = right ? right.w - levelGap : 0, leftW = left ? left.w - levelGap : 0; // a half's own root (0 wide) plus a gap leads each half
  const H = Math.max(right?.h ?? 0, left?.h ?? 0, root.size.h);
  const rootX = leftW + (left ? levelGap : 0);
  const nodes = new Map<string, Placed>(), edges: TreeLayout['edges'] = [];
  const seen = new Set<string>([root.id]);
  nodes.set(root.id, {x: rootX, y: (H - root.size.h) / 2, ...root.size});
  const rootP = nodes.get(root.id)!;
  const take = (t: TreeLayout | null, which: 'left' | 'right'): void => {
    if (!t) return;
    const ghost = `${root.id}\u0000${which}`, dy = (H - t.h) / 2;
    const shiftX = which === 'right' ? rootX + root.size.w : 0;
    for (const [id, p] of t.nodes) {
      if (id === ghost) continue;
      dupCheck(seen, id);
      // the left half is mirrored: its depth runs from the root outward to the left
      nodes.set(id, {...p, x: which === 'right' ? p.x + shiftX : t.w - p.x - p.w, y: p.y + dy});
    }
    const rootEdge = (to: string): Pt[] => {
      const q = nodes.get(to)!;
      const a = {x: which === 'right' ? rootP.x + rootP.w : rootP.x, y: rootP.y + rootP.h / 2}, b = {x: which === 'right' ? q.x : q.x + q.w, y: q.y + q.h / 2};
      const m = (a.x + b.x) / 2;
      return [a, {x: m, y: a.y}, {x: m, y: b.y}, b];
    };
    for (const e of t.edges) {
      if (e.from === ghost) { edges.push({from: root.id, to: e.to, points: rootEdge(e.to)}); continue; }
      const pts = e.points.map(p => ({x: which === 'right' ? p.x + shiftX : t.w - p.x, y: p.y + dy}));
      edges.push({from: e.from, to: e.to, points: pts});
    }
  };
  take(right, 'right');
  take(left, 'left');
  return {nodes, edges, w: leftW + (left ? levelGap : 0) + root.size.w + (right ? levelGap : 0) + rightW, h: H};
}

// ---- layered (Sugiyama-lite): state machines, flows ----

export interface LayeredNode {id: string; size: Size}
export interface LayeredEdge {from: string; to: string}
export interface LayeredOpts {
  dir?: Dir; gap?: number; levelGap?: number; /** crossing-reduction sweeps (default 4) */ sweeps?: number;
  /** Pull a node that only has edges going out (no edge into it, not a `start`) down to just before its nearest target, so its edges stop being long (default false: the longest-path layer, layer 0). */
  tighten?: boolean;
  /** ALAP (ADR 0019 D1): every node of the input side (no edge into it, or only edges from other such nodes) moves down to just before its nearest target, in turn from the targets back,
   *  so a chain of inputs (obstacle → action → goal) is short too. `keep` ids stay on their longest-path layer (and so do `start` nodes). Layers only grow; the cycle breaking is not changed. Default: off. */
  alap?: {keep: readonly string[]};
  /** Keep the order with the fewest crossings seen in the sweeps, then swap neighbours in a layer while that cuts crossings (default false: the order the last sweep left). */
  transpose?: boolean;
  /** How the across coordinates are found: 'relax' (default: centre each layer, then pull toward the neighbours) or 'bk' (Brandes-Köpf: long edges and chains come out straight). */
  coord?: 'relax' | 'bk';
  /**
   * Returns (reversed edges) that skip two layers or more run in a lane outside the figure instead of through dummies: `which` is 'all'
   * of them or only the `declared` ones (`back`). The first lane is `gap` beyond the boxes on the far across side, the next ones `step` further out,
   * the longest return outermost. Such an edge comes out with `outer` set and four points (its two centres and two points on its lane); the router draws it.
   */
  outer?: {which: 'all' | 'declared'; gap: number; step: number};
  /**
   * The most a row may take on the across axis (ADR 0010 D7). A layer whose nodes (and the dummies of the arrows passing through it) add up to more is cut,
   * in input order, into rows, and each row is a layer of its own (the later layers move down one number per row), so the corridors between layers still
   * hold. A layer that fits is not touched; without `fold` nothing is added to the layering. `folded` in the result lists the layers that were cut.
   */
  fold?: number;
}
export interface LayeredEdgeOut {from: string; to: string; /** index of this edge in the input list */ index: number; /** centre to centre, through the layers it skips; reversed edges are drawn from `from` anyway */ points: Pt[]; reversed: boolean; self: boolean; /** runs in an outer lane (see LayeredOpts.outer) */ outer?: true}
export interface LayeredLayout {nodes: Map<string, Placed>; edges: LayeredEdgeOut[]; /** layer index of each node (0 = first) */ layers: Map<string, number>; w: number; h: number; /** only with `fold`, when a layer was cut: its number before the cut (from 0) and the rows it became */ folded?: {layer: number; rows: number}[]}

/**
 * Which edges (by index in `edges`) a layering reverses to be acyclic. The `declared` ones (a return the author named, `back: true`)
 * are reversed first and the DFS only runs over the rest, so the layers no longer depend on the order the nodes are written in; with
 * none declared it is the plain DFS (from `start`, then the nodes in input order; an edge to a node on the stack is reversed).
 * A declared edge must close a cycle through the other edges, and one cycle takes one declared edge: otherwise it throws.
 */
export function breakCycles(nodes: readonly {id: string}[], edges: readonly LayeredEdge[], declared: readonly number[] = [], start: readonly string[] = []): Set<number> {
  const decl = new Set<number>();
  for (const i of declared) {
    if (!Number.isInteger(i) || i < 0 || i >= edges.length) throw new Error(`graph layout: back edge index ${i} is not one of the ${edges.length} edges`);
    if (edges[i].from !== edges[i].to) decl.add(i);
  }
  const name = (i: number): string => `${edges[i].from} -> ${edges[i].to}`;
  const rest = new Map<string, string[]>(nodes.map(n => [n.id, []]));
  edges.forEach((e, i) => { if (e.from !== e.to && !decl.has(i)) rest.get(e.from)?.push(e.to); });
  const reach = (from: string, to: string, avoid: ReadonlySet<string> = new Set()): boolean => {
    const seen = new Set<string>([from]), todo = [from];
    while (todo.length) {
      const u = todo.pop()!;
      if (u === to) return true;
      for (const v of rest.get(u) ?? []) if (!seen.has(v) && !avoid.has(v)) { seen.add(v); todo.push(v); }
    }
    return false;
  };
  const list = [...decl];
  // two declared edges on one simple cycle: two vertex-disjoint ways d1.to => d2.from and d2.to => d1.from (search capped: a huge graph is not refused for it)
  let budget = 20000;
  const twoOnOneCycle = (d1: number, d2: number): boolean => {
    const goal = edges[d2].from, onPath = new Set<string>();
    const walk = (u: string): boolean => {
      if (--budget < 0) return false;
      onPath.add(u);
      let found = false;
      if (u === goal) found = reach(edges[d2].to, edges[d1].from, onPath) && !onPath.has(edges[d2].to);
      else for (const v of rest.get(u) ?? []) if (!onPath.has(v) && walk(v)) { found = true; break; }
      onPath.delete(u);
      return found;
    };
    return walk(edges[d1].to);
  };
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
    if (twoOnOneCycle(list[i], list[j])) throw new Error(`graph layout: back edges ${name(list[i])} and ${name(list[j])} are on one cycle. One back edge cuts a cycle: keep back on the one edge that is the return in meaning`);
  }
  for (const d of list) {
    if (!reach(edges[d].to, edges[d].from)) throw new Error(`graph layout: back edge ${name(d)} closes no cycle: there is no way from ${edges[d].to} back to ${edges[d].from} along the other edges. Mark only the edge that returns to the start of a loop`);
  }
  const state = new Map<string, 0 | 1 | 2>(), backPairs = new Set<string>();
  const dfs = (u: string): void => {
    state.set(u, 1);
    for (const v of rest.get(u)!) {
      if (state.get(v) === 1) backPairs.add(`${u}\u0000${v}`);
      else if (!state.get(v)) dfs(v);
    }
    state.set(u, 2);
  };
  const known = new Set(nodes.map(n => n.id));
  for (const s of [...start.filter(s => known.has(s)), ...nodes.map(n => n.id)]) if (!state.get(s)) dfs(s);
  const out = new Set<number>(decl);
  edges.forEach((e, i) => { if (e.from !== e.to && !decl.has(i) && backPairs.has(`${e.from}\u0000${e.to}`)) out.add(i); });
  return out;
}

/**
 * Brandes-Köpf coordinates for one connected component: rows of slot ids in order, `succ` / `pred` the links to the next / previous
 * row. Four alignments (each long edge or chain lined up with its median neighbour, long edges between dummies first), each packed
 * to the left or to the right, then the average of the two middle values per node. Returns the centre of each slot across the rows
 * (any origin; the caller sets the range down).
 */
function brandesKoepf(rows: string[][], succ: Map<string, string[]>, pred: Map<string, string[]>, width: (id: string) => number, gap: number, dummy: (id: string) => boolean): Map<string, number> {
  const ids = rows.flat(), layouts: Map<string, number>[] = [];
  for (const up of [false, true]) for (const right of [false, true]) {
    const view = (up ? [...rows].reverse() : rows).map(r => right ? [...r].reverse() : r);
    const prev = up ? succ : pred; // the neighbours in the row before, in this view
    const pos = new Map<string, number>(), rowOf = new Map<string, string[]>();
    for (const r of view) r.forEach((id, i) => { pos.set(id, i); rowOf.set(id, r); });
    const before = (v: string): string[] => [...prev.get(v)!].sort((a, b) => pos.get(a)! - pos.get(b)!);
    // 1. a segment that crosses an inner one (dummy to dummy) never gets aligned
    const conflict = new Set<string>();
    for (let i = 0; i + 1 < view.length; i++) {
      const high = view[i], low = view[i + 1];
      let k0 = 0, l = 0;
      for (let l1 = 0; l1 < low.length; l1++) {
        const inner = dummy(low[l1]) ? prev.get(low[l1])!.find(dummy) : undefined;
        if (l1 === low.length - 1 || inner !== undefined) {
          const k1 = inner !== undefined ? pos.get(inner)! : high.length - 1;
          for (; l <= l1; l++) for (const u of prev.get(low[l])!) { const k = pos.get(u)!; if (k < k0 || k > k1) conflict.add(`${u}\u0000${low[l]}`); }
          k0 = k1;
        }
      }
    }
    // 2. vertical alignment with a median neighbour
    const root = new Map(ids.map(id => [id, id])), align = new Map(ids.map(id => [id, id]));
    for (const r of view.slice(1)) {
      let last = -1;
      for (const v of r) {
        const ns = before(v), d = ns.length;
        if (!d) continue;
        for (const m of d % 2 ? [ns[(d - 1) / 2]] : [ns[d / 2 - 1], ns[d / 2]]) {
          if (align.get(v) === v && !conflict.has(`${m}\u0000${v}`) && last < pos.get(m)!) {
            align.set(m, v); root.set(v, root.get(m)!); align.set(v, root.get(v)!); last = pos.get(m)!;
          }
        }
      }
    }
    // 3. horizontal compaction of the blocks (a block is a chain of aligned slots: one x)
    const sink = new Map(ids.map(id => [id, id])), shift = new Map(ids.map(id => [id, Infinity])), x = new Map<string, number>();
    const placeBlock = (v: string): void => {
      if (x.has(v)) return;
      x.set(v, 0);
      let w = v;
      do {
        const i = pos.get(w)!;
        if (i > 0) {
          const p = rowOf.get(w)![i - 1], u = root.get(p)!, d = (width(p) + width(w)) / 2 + gap;
          placeBlock(u);
          if (sink.get(v) === v) sink.set(v, sink.get(u)!);
          if (sink.get(v) !== sink.get(u)) shift.set(sink.get(u)!, Math.min(shift.get(sink.get(u)!)!, x.get(v)! - x.get(u)! - d));
          else x.set(v, Math.max(x.get(v)!, x.get(u)! + d));
        }
        w = align.get(w)!;
      } while (w !== v);
    };
    for (const id of ids) if (root.get(id) === id) placeBlock(id);
    const out = new Map<string, number>();
    for (const id of ids) {
      const rt = root.get(id)!, sh = shift.get(sink.get(rt)!)!;
      out.set(id, (x.get(rt)! + (sh < Infinity ? sh : 0)) * (right ? -1 : 1));
    }
    layouts.push(out);
  }
  // line the four up on the narrowest (the left ones by their left end, the right ones by their right end), then take the middle two
  const lo = (m: Map<string, number>): number => Math.min(...ids.map(id => m.get(id)! - width(id) / 2)), hi = (m: Map<string, number>): number => Math.max(...ids.map(id => m.get(id)! + width(id) / 2));
  const narrow = layouts.reduce((a, b) => hi(b) - lo(b) < hi(a) - lo(a) ? b : a);
  const aligned = layouts.map((m, k) => { const d = k % 2 === 0 ? lo(narrow) - lo(m) : hi(narrow) - hi(m); return new Map(ids.map(id => [id, m.get(id)! + d] as const)); });
  const result = new Map<string, number>();
  for (const id of ids) { const v = aligned.map(m => m.get(id)!).sort((a, b) => a - b); result.set(id, (v[1] + v[2]) / 2); }
  // averaging can leave two neighbours closer than they may be: push them apart, left to right
  for (const r of rows) for (let i = 1; i < r.length; i++) result.set(r[i], Math.max(result.get(r[i])!, result.get(r[i - 1])! + (width(r[i - 1]) + width(r[i])) / 2 + gap));
  return result;
}

/**
 * Layers by longest path after breaking cycles (a DFS back edge is reversed for layering, and drawn from its real tail).
 * Nodes keep input order inside a layer until barycentre sweeps cut crossings; an edge that skips layers goes through a
 * dummy slot per layer so it does not run over the nodes in between. `start` ids (the entry states) are pinned to layer 0.
 */
export function layoutLayered(nodes: LayeredNode[], edges: LayeredEdge[], opts: LayeredOpts & {start?: string[]; back?: readonly number[]} = {}): LayeredLayout {
  const dir = opts.dir ?? 'right', gap = opts.gap ?? GAP, levelGap = opts.levelGap ?? LEVEL_GAP * 1.5, sweeps = opts.sweeps ?? 4;
  const ids = new Set<string>();
  for (const n of nodes) dupCheck(ids, n.id);
  for (const e of edges) for (const id of [e.from, e.to]) if (!ids.has(id)) throw new Error(`graph layout: edge ${e.from} -> ${e.to} names unknown node "${id}"`);
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  const across = (s: Size): number => dir === 'down' ? s.w : s.h, along = (s: Size): number => dir === 'down' ? s.h : s.w;

  // 1. break cycles: edges declared as returns first, then a DFS (from the start nodes, then the rest in input order) over the others
  const reversedAt = breakCycles(nodes, edges, opts.back ?? [], opts.start);
  const starts = (opts.start ?? []).filter(s => ids.has(s));
  const dag = edges.map((e, index) => ({e, index})).filter(({e}) => e.from !== e.to).map(({e, index}) => reversedAt.has(index) ? {a: e.to, b: e.from, e, index, rev: true} : {a: e.from, b: e.to, e, index, rev: false});

  // 2. longest-path layering (a start node stays on layer 0)
  const layer = new Map<string, number>(), preds = new Map<string, string[]>(nodes.map(n => [n.id, []]));
  for (const d of dag) preds.get(d.b)!.push(d.a);
  const depth = (u: string, trail: Set<string>): number => {
    if (layer.has(u)) return layer.get(u)!;
    if (starts.includes(u) && !preds.get(u)!.length) { layer.set(u, 0); return 0; } // a start with an edge into it is placed by that edge
    if (trail.has(u)) return 0;
    trail.add(u);
    const l = preds.get(u)!.reduce((m, p) => Math.max(m, depth(p, trail) + 1), 0);
    trail.delete(u);
    layer.set(u, l);
    return l;
  };
  for (const n of nodes) depth(n.id, new Set());
  if (opts.tighten) {
    // a node with edges only going out moves up to its nearest target - 1 (one pass: a mover has no edge into it, so no layer it reads moves)
    const nearest = new Map<string, number>();
    for (const d of dag) nearest.set(d.a, Math.min(nearest.get(d.a) ?? Infinity, layer.get(d.b)!));
    for (const [u, l] of nearest) if (!preds.get(u)!.length && !starts.includes(u) && l - 1 > layer.get(u)!) layer.set(u, l - 1);
  }
  if (opts.alap) {
    const keep = new Set([...opts.alap.keep, ...starts]), movers = new Set<string>(), succs = new Map<string, string[]>(nodes.map(n => [n.id, []]));
    for (const d of dag) succs.get(d.a)!.push(d.b);
    // the input side, from the first layer on (a node's predecessors lie on lower layers): all of a node's in-edges come from the input side
    const byLayer = [...layer.keys()].sort((p, q) => layer.get(p)! - layer.get(q)!);
    for (const u of byLayer) if (!keep.has(u) && preds.get(u)!.every(p => movers.has(p))) movers.add(u);
    // then from the last layer back, so a mover's targets (movers too) have already moved
    for (const u of [...byLayer].reverse()) {
      const ts = succs.get(u)!;
      if (!movers.has(u) || !ts.length) continue;
      const l = Math.min(...ts.map(t => layer.get(t)!)) - 1;
      if (l > layer.get(u)!) layer.set(u, l);
    }
  }

  // 2b. fold: a layer wider than `fold` becomes rows, each its own layer (ADR 0010 D7). The order is not known yet, so the nodes go to the rows in input order.
  const folded = opts.fold === undefined ? [] : foldLayers();
  function foldLayers(): {layer: number; rows: number}[] {
    const limit = opts.fold!, nOld = Math.max(0, ...layer.values()) + 1;
    const outerEdge = (d: typeof dag[number]): boolean => !!opts.outer && d.rev && Math.abs(layer.get(d.b)! - layer.get(d.a)!) >= 2 && (opts.outer.which === 'all' || (opts.back ?? []).includes(d.index));
    const through = dag.filter(d => layer.get(d.a)! !== layer.get(d.b)! && !outerEdge(d)); // the edges that get dummies
    const skips = Array.from({length: nOld}, () => 0); // dummies of the arrows that pass over a whole layer: in every row of it
    const inOf = new Map<string, number>(), outOf = new Map<string, number>(); // edges that begin / end at a node and go to another layer
    for (const d of through) {
      for (let l = layer.get(d.a)! + 1; l < layer.get(d.b)!; l++) skips[l]++;
      outOf.set(d.a, (outOf.get(d.a) ?? 0) + 1); inOf.set(d.b, (inOf.get(d.b) ?? 0) + 1);
    }
    const members = Array.from({length: nOld}, () => [] as LayeredNode[]);
    for (const n of nodes) members[layer.get(n.id)!].push(n);
    const used = (ns: LayeredNode[], dummies: number): number => ns.reduce((t, n) => t + across(n.size), 0) + gap * (Math.max(0, ns.length - 1) + dummies);
    const rowsOf: LayeredNode[][][] = [];
    const cut: {layer: number; rows: number}[] = [];
    members.forEach((ns, l) => {
      if (ns.length < 2 || used(ns, skips[l]) <= limit) { rowsOf.push([ns]); return; }
      // The dummies of a row depend on the cut: an arrow into a node of a later row passes the rows before it, an arrow out of a node of an earlier row the rows after it.
      // So the cut is made, the dummies counted, and made again with those counted, until every row fits (the counts only grow).
      let extra: number[] = [], rows: LayeredNode[][] = [];
      for (let round = 0; round <= ns.length * 2; round++) {
        rows = [[]];
        for (const n of ns) {
          const cur = rows[rows.length - 1];
          if (cur.length && used([...cur, n], skips[l] + (extra[rows.length - 1] ?? 0)) > limit) rows.push([n]); else cur.push(n);
        }
        const counted = rows.map(() => 0);
        rows.forEach((r, k) => { for (const n of r) { for (let j = 0; j < k; j++) counted[j] += inOf.get(n.id) ?? 0; for (let j = k + 1; j < rows.length; j++) counted[j] += outOf.get(n.id) ?? 0; } });
        if (rows.every((r, k) => r.length < 2 || used(r, skips[l] + counted[k]) <= limit)) break;
        extra = counted.map((c, k) => Math.max(c, extra[k] ?? 0));
      }
      rowsOf.push(rows);
      cut.push({layer: l, rows: rows.length});
    });
    if (!cut.length) return cut;
    let base = 0;
    rowsOf.forEach(rows => { rows.forEach((r, k) => { for (const n of r) layer.set(n.id, base + k); }); base += rows.length; });
    return cut;
  }

  // 3. dummies for edges that skip layers
  interface Slot {id: string; real: boolean; size: Size; layer: number}
  const slots = new Map<string, Slot>(nodes.map(n => [n.id, {id: n.id, real: true, size: n.size, layer: layer.get(n.id)!}]));
  const chains: {e: LayeredEdge; index: number; ids: string[]; rev: boolean; outer?: true}[] = [];
  const declaredSet = new Set(opts.back ?? []);
  const succ = new Map<string, string[]>(), pred = new Map<string, string[]>();
  for (const s of slots.keys()) { succ.set(s, []); pred.set(s, []); }
  const link = (a: string, b: string): void => { succ.get(a)!.push(b); pred.get(b)!.push(a); };
  dag.forEach((d, i) => {
    const la = layer.get(d.a)!, lb = layer.get(d.b)!;
    const chain = [d.a];
    // longest-path layering puts the head of every edge below its tail, so ends on one layer cannot happen; kept straight if it ever does
    const to = d.b, step = lb >= la ? 1 : -1;
    if (la === lb) { chain.push(d.b); chains.push({e: d.e, index: d.index, ids: chain, rev: d.rev}); return; }
    // a return two layers or more long that runs outside the figure: no dummies, so it neither crosses the layers it skips nor widens them
    if (opts.outer && d.rev && Math.abs(lb - la) >= 2 && (opts.outer.which === 'all' || declaredSet.has(d.index))) { chains.push({e: d.e, index: d.index, ids: [d.a, d.b], rev: true, outer: true}); return; }
    for (let l = la + step; l !== lb; l += step) {
      const id = `\u0000d${i}.${l}`;
      slots.set(id, {id, real: false, size: {w: 1, h: 1}, layer: l});
      succ.set(id, []); pred.set(id, []);
      chain.push(id);
    }
    chain.push(to);
    chains.push({e: d.e, index: d.index, ids: chain, rev: d.rev});
    // links always run from the lower layer to the higher one
    const asc = la < lb ? chain : [...chain].reverse();
    for (let k = 0; k + 1 < asc.length; k++) link(asc[k], asc[k + 1]);
  });

  const nLayers = Math.max(0, ...[...slots.values()].map(s => s.layer)) + 1;
  const rank = (id: string): number => id.startsWith('\u0000') ? 1e6 + (order.get(id) ?? 0) : order.get(id) ?? 0;
  // connected components of the slot graph, numbered by the earliest node written: with coord 'bk' each stays together in a row and is placed on its own (D8)
  const parent = new Map<string, string>([...slots.keys()].map(k => [k, k]));
  const find = (a: string): string => { while (parent.get(a) !== a) { parent.set(a, parent.get(parent.get(a)!)!); a = parent.get(a)!; } return a; };
  for (const [a, bs] of succ) for (const b of bs) parent.set(find(a), find(b));
  const byRank = [...slots.values()].sort((p, q) => rank(p.id) - rank(q.id) || (p.id < q.id ? -1 : 1));
  const compIdx = new Map<string, number>(), compOfRoot = new Map<string, number>();
  for (const sl of byRank) { const r = opts.coord === 'bk' ? find(sl.id) : ''; // the plain layout keeps one component: its sweeps and its settling are as they were
     if (!compOfRoot.has(r)) compOfRoot.set(r, compOfRoot.size); compIdx.set(sl.id, compOfRoot.get(r)!); }
  const nComp = compOfRoot.size;
  const rows: string[][] = Array.from({length: nLayers}, () => []);
  for (const sl of [...byRank].sort((p, q) => compIdx.get(p.id)! - compIdx.get(q.id)!)) rows[sl.layer].push(sl.id); // stable: input order inside a component

  // 4. barycentre sweeps, down then up, keeping the order of nodes with no neighbour
  const pos = new Map<string, number>();
  const reindex = (): void => rows.forEach(r => r.forEach((id, i) => pos.set(id, i)));
  reindex();
  const sortBy = (r: string[], nb: Map<string, string[]>): void => {
    const key = new Map(r.map((id, i) => {
      const ns = nb.get(id)!;
      return [id, ns.length ? ns.reduce((s, n) => s + pos.get(n)!, 0) / ns.length : i] as const;
    }));
    r.sort((a, b) => compIdx.get(a)! - compIdx.get(b)! || key.get(a)! - key.get(b)! || pos.get(a)! - pos.get(b)!);
    r.forEach((id, i) => pos.set(id, i));
  };
  // crossings of the links between layer l and l + 1 (two links cross when their ends are in opposite orders)
  const crossingsAt = (l: number): number => {
    const ls: [number, number][] = [];
    for (const u of rows[l]) for (const v of succ.get(u)!) ls.push([pos.get(u)!, pos.get(v)!]);
    let c = 0;
    for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) if ((ls[i][0] - ls[j][0]) * (ls[i][1] - ls[j][1]) < 0) c++;
    return c;
  };
  const allCrossings = (): number => { let c = 0; for (let l = 0; l + 1 < nLayers; l++) c += crossingsAt(l); return c; };
  let best = opts.transpose ? {rows: rows.map(r => [...r]), cross: allCrossings()} : undefined;
  for (let s = 0; s < sweeps; s++) {
    for (let l = 1; l < nLayers; l++) sortBy(rows[l], pred);
    for (let l = nLayers - 2; l >= 0; l--) sortBy(rows[l], succ);
    if (best) { const c = allCrossings(); if (c < best.cross) best = {rows: rows.map(r => [...r]), cross: c}; }
  }
  if (best) {
    best.rows.forEach((r, l) => rows[l].splice(0, rows[l].length, ...r));
    reindex();
    const local = (l: number): number => (l > 0 ? crossingsAt(l - 1) : 0) + (l + 1 < nLayers ? crossingsAt(l) : 0);
    for (let pass = 0, improved = true; improved && pass < 20; pass++) {
      improved = false;
      for (let l = 0; l < nLayers; l++) for (let i = 0; i + 1 < rows[l].length; i++) {
        const before = local(l), r = rows[l];
        if (compIdx.get(r[i]) !== compIdx.get(r[i + 1])) continue;
        [r[i], r[i + 1]] = [r[i + 1], r[i]];
        pos.set(r[i], i); pos.set(r[i + 1], i + 1);
        if (local(l) < before) improved = true;
        else { [r[i], r[i + 1]] = [r[i + 1], r[i]]; pos.set(r[i], i); pos.set(r[i + 1], i + 1); }
      }
    }
  }

  // 5. coordinates: layers along one axis, each layer centred on the widest, then relaxed toward the neighbours without overlap
  const thick = rows.map(r => Math.max(0, ...r.map(id => along(slots.get(id)!.size))));
  const at: number[] = [];
  thick.reduce((a, t, i) => (at[i] = a, a + t + levelGap), 0);
  const cross = new Map<string, number>(); // centre on the across axis
  const wOf = (id: string): number => across(slots.get(id)!.size);
  let packed = 0, hi = 0;
  for (let c = 0; c < nComp; c++) {
    const mine = rows.map(r => r.filter(id => compIdx.get(id) === c)), members = mine.flat();
    if (opts.coord === 'bk') {
      for (const [id, x] of brandesKoepf(mine, succ, pred, wOf, gap, id => !slots.get(id)!.real)) cross.set(id, x);
    } else {
      const extent = (r: string[]): number => r.reduce((t, id, i) => t + wOf(id) + (i ? gap : 0), 0);
      const widest = Math.max(0, ...mine.map(extent));
      for (const r of mine) {
        let a = (widest - extent(r)) / 2;
        for (const id of r) { const w = wOf(id); cross.set(id, a + w / 2); a += w + gap; }
      }
      const settle = (r: string[], nb: Map<string, string[]>): void => {
        const want = r.map(id => { const ns = nb.get(id)!; return ns.length ? ns.reduce((t, n) => t + cross.get(n)!, 0) / ns.length : cross.get(id)!; });
        // left to right push-apart, then right to left, so the result is the closest non-overlapping arrangement to `want`
        const w = r.map(wOf);
        const cs = want.slice();
        for (let i = 1; i < r.length; i++) cs[i] = Math.max(cs[i], cs[i - 1] + (w[i - 1] + w[i]) / 2 + gap);
        const shift = (want.reduce((t, v, i) => t + v - cs[i], 0)) / Math.max(1, r.length);
        for (let i = 0; i < r.length; i++) cs[i] += shift;
        for (let i = 1; i < r.length; i++) cs[i] = Math.max(cs[i], cs[i - 1] + (w[i - 1] + w[i]) / 2 + gap);
        r.forEach((id, i) => cross.set(id, cs[i]));
      };
      // the rows of one component only: the average shift of a row must not be pulled by a node of another component
      for (let t = 0; t < 3; t++) {
        for (let l = 1; l < nLayers; l++) settle(mine[l], pred);
        for (let l = nLayers - 2; l >= 0; l--) settle(mine[l], succ);
      }
    }
    // the component's own range, set down after the previous one (the first starts at 0)
    const lo = Math.min(...members.map(id => cross.get(id)! - wOf(id) / 2));
    for (const id of members) cross.set(id, cross.get(id)! - lo + packed);
    packed = Math.max(...members.map(id => cross.get(id)! + wOf(id) / 2)) + gap;
    hi = packed - gap;
  }

  const centre = (id: string): Pt => {
    const s = slots.get(id)!, a = at[s.layer] + thick[s.layer] / 2, c = cross.get(id)!;
    return dir === 'down' ? {x: c, y: a} : {x: a, y: c};
  };
  const placed = new Map<string, Placed>();
  for (const n of nodes) {
    const p = centre(n.id);
    placed.set(n.id, {x: p.x - n.size.w / 2, y: p.y - n.size.h / 2, ...n.size});
  }
  const edgesOut: LayeredEdgeOut[] = [];
  // outer lanes: past the boxes on the far across side, the shortest return nearest
  const laneOf = new Map<LayeredEdge, number>();
  const outers = chains.filter(c => c.outer).sort((p, q) => Math.abs(layer.get(p.e.from)! - layer.get(p.e.to)!) - Math.abs(layer.get(q.e.from)! - layer.get(q.e.to)!) || p.index - q.index);
  outers.forEach((c, k) => laneOf.set(c.e, hi + opts.outer!.gap + k * opts.outer!.step));
  if (outers.length) hi = hi + opts.outer!.gap + (outers.length - 1) * opts.outer!.step + 2;
  edges.forEach((e, index) => { if (e.from === e.to) edgesOut.push({from: e.from, to: e.to, index, points: [centre(e.from)], reversed: false, self: true}); });
  for (const c of chains) {
    if (c.outer) {
      const a = centre(c.e.from), b = centre(c.e.to), lane = laneOf.get(c.e)!;
      const at2 = (p: Pt, d: number): Pt => dir === 'down' ? {x: lane, y: p.y + d} : {x: p.x + d, y: lane};
      edgesOut.push({from: c.e.from, to: c.e.to, index: c.index, points: [a, at2(a, -1), at2(b, 1), b], reversed: true, self: false, outer: true});
      continue;
    }
    // the chain runs in layering order; a reversed edge's real direction is the other way
    const pts = (c.rev ? [...c.ids].reverse() : c.ids).map(centre);
    edgesOut.push({from: c.e.from, to: c.e.to, index: c.index, points: pts, reversed: c.rev, self: false});
  }
  const total = at[nLayers - 1] + thick[nLayers - 1];
  return {nodes: placed, edges: edgesOut, layers: layer, w: dir === 'down' ? hi : total, h: dir === 'down' ? total : hi, ...(folded.length ? {folded} : {})};
}
