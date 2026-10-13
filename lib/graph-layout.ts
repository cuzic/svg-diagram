import {must} from './must.ts';
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
    const mine = must(span.get(n)), kids = n.children ?? [];
    centres.set(n.id, from + mine / 2);
    levels.set(n.id, level);
    const kidsSpan = kids.reduce((s, k, i) => s + must(span.get(k)) + (i ? gap : 0), 0);
    let at = from + (mine - kidsSpan) / 2;
    for (const k of kids) { place(k, at, level + 1); at += must(span.get(k)) + gap; }
  };
  place(root, 0, 0);
  const nodes = new Map<string, Placed>();
  const index = (n: TreeNode): void => {
    const c = must(centres.get(n.id)), l = must(levels.get(n.id));
    nodes.set(n.id, dir === 'down' ? {x: c - n.size.w / 2, y: levelAt[l], ...n.size} : {x: levelAt[l], y: c - n.size.h / 2, ...n.size});
    for (const k of n.children ?? []) index(k);
  };
  index(root);
  const edges: TreeLayout['edges'] = [];
  const link = (n: TreeNode): void => {
    const p = must(nodes.get(n.id));
    for (const k of n.children ?? []) {
      const q = must(nodes.get(k.id));
      const [a, b] = dir === 'down' ? [{x: p.x + p.w / 2, y: p.y + p.h}, {x: q.x + q.w / 2, y: q.y}] : [{x: p.x + p.w, y: p.y + p.h / 2}, {x: q.x, y: q.y + q.h / 2}];
      const mid = dir === 'down' ? (a.y + b.y) / 2 : (a.x + b.x) / 2;
      edges.push({from: n.id, to: k.id, points: dir === 'down' ? [a, {x: a.x, y: mid}, {x: b.x, y: mid}, b] : [a, {x: mid, y: a.y}, {x: mid, y: b.y}, b]});
      link(k);
    }
  };
  link(root);
  const total = must(span.get(root)), depth = must(levelAt[levelAt.length - 1]) + must(levelDepth[levelDepth.length - 1]);
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
  const free = kids.map((_, i) => i).filter(i => !opts.sides?.[must(kids[i]).id]);
  const freeTotal = free.reduce((s, i) => s + must(heights[i]), 0);
  let acc = 0;
  for (const i of free) {
    const mid = acc + must(heights[i]) / 2;
    side[i] = load.right + mid <= (load.left + load.right + freeTotal) / 2 ? 'right' : 'left';
    acc += must(heights[i]);
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
  const rootP = must(nodes.get(root.id));
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
      const q = must(nodes.get(to));
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
export interface LayeredOpts {dir?: Dir; gap?: number; levelGap?: number; /** crossing-reduction sweeps (default 4) */ sweeps?: number}
export interface LayeredEdgeOut {from: string; to: string; /** index of this edge in the input list */ index: number; /** centre to centre, through the layers it skips; reversed edges are drawn from `from` anyway */ points: Pt[]; reversed: boolean; self: boolean}
export interface LayeredLayout {nodes: Map<string, Placed>; edges: LayeredEdgeOut[]; /** layer index of each node (0 = first) */ layers: Map<string, number>; w: number; h: number}

/**
 * Layers by longest path after breaking cycles (a DFS back edge is reversed for layering, and drawn from its real tail).
 * Nodes keep input order inside a layer until barycentre sweeps cut crossings; an edge that skips layers goes through a
 * dummy slot per layer so it does not run over the nodes in between. `start` ids (the entry states) are pinned to layer 0.
 */
export function layoutLayered(nodes: LayeredNode[], edges: LayeredEdge[], opts: LayeredOpts & {start?: string[]} = {}): LayeredLayout {
  const dir = opts.dir ?? 'right', gap = opts.gap ?? GAP, levelGap = opts.levelGap ?? LEVEL_GAP * 1.5, sweeps = opts.sweeps ?? 4;
  const ids = new Set<string>();
  for (const n of nodes) dupCheck(ids, n.id);
  for (const e of edges) for (const id of [e.from, e.to]) if (!ids.has(id)) throw new Error(`graph layout: edge ${e.from} -> ${e.to} names unknown node "${id}"`);
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  const across = (s: Size): number => dir === 'down' ? s.w : s.h, along = (s: Size): number => dir === 'down' ? s.h : s.w;

  // 1. break cycles: DFS from the start nodes (then from the rest in input order); an edge to a node on the stack is reversed
  const out = new Map<string, string[]>(nodes.map(n => [n.id, []]));
  for (const e of edges) if (e.from !== e.to) must(out.get(e.from)).push(e.to);
  const state = new Map<string, 0 | 1 | 2>(), back = new Set<string>();
  const dfs = (u: string): void => {
    state.set(u, 1);
    for (const v of must(out.get(u))) {
      if (state.get(v) === 1) back.add(`${u}\u0000${v}`);
      else if (!state.get(v)) dfs(v);
    }
    state.set(u, 2);
  };
  const starts = (opts.start ?? []).filter(s => ids.has(s));
  for (const s of [...starts, ...nodes.map(n => n.id)]) if (!state.get(s)) dfs(s);
  const dag = edges.map((e, index) => ({e, index})).filter(({e}) => e.from !== e.to).map(({e, index}) => back.has(`${e.from}\u0000${e.to}`) ? {a: e.to, b: e.from, e, index, rev: true} : {a: e.from, b: e.to, e, index, rev: false});

  // 2. longest-path layering (a start node stays on layer 0)
  const layer = new Map<string, number>(), preds = new Map<string, string[]>(nodes.map(n => [n.id, []]));
  for (const d of dag) must(preds.get(d.b)).push(d.a);
  const depth = (u: string, trail: Set<string>): number => {
    if (layer.has(u)) return must(layer.get(u));
    if (starts.includes(u) && !must(preds.get(u)).length) { layer.set(u, 0); return 0; } // a start with an edge into it is placed by that edge
    if (trail.has(u)) return 0;
    trail.add(u);
    const l = must(preds.get(u)).reduce((m, p) => Math.max(m, depth(p, trail) + 1), 0);
    trail.delete(u);
    layer.set(u, l);
    return l;
  };
  for (const n of nodes) depth(n.id, new Set());

  // 3. dummies for edges that skip layers
  interface Slot {id: string; real: boolean; size: Size; layer: number}
  const slots = new Map<string, Slot>(nodes.map(n => [n.id, {id: n.id, real: true, size: n.size, layer: must(layer.get(n.id))}]));
  const chains: {e: LayeredEdge; index: number; ids: string[]; rev: boolean}[] = [];
  const succ = new Map<string, string[]>(), pred = new Map<string, string[]>();
  for (const s of slots.keys()) { succ.set(s, []); pred.set(s, []); }
  const link = (a: string, b: string): void => { must(succ.get(a)).push(b); must(pred.get(b)).push(a); };
  dag.forEach((d, i) => {
    const la = must(layer.get(d.a)), lb = must(layer.get(d.b));
    const chain = [d.a];
    // longest-path layering puts the head of every edge below its tail, so ends on one layer cannot happen; kept straight if it ever does
    const to = d.b, step = lb >= la ? 1 : -1;
    if (la === lb) { chain.push(d.b); chains.push({e: d.e, index: d.index, ids: chain, rev: d.rev}); return; }
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
  const rows: string[][] = Array.from({length: nLayers}, () => []);
  for (const s of [...slots.values()].sort((p, q) => rank(p.id) - rank(q.id) || (p.id < q.id ? -1 : 1))) must(rows[s.layer]).push(s.id);

  // 4. barycentre sweeps, down then up, keeping the order of nodes with no neighbour
  const pos = new Map<string, number>();
  const reindex = (): void => rows.forEach(r => r.forEach((id, i) => pos.set(id, i)));
  reindex();
  const sortBy = (r: string[], nb: Map<string, string[]>): void => {
    const key = new Map(r.map((id, i) => {
      const ns = must(nb.get(id));
      return [id, ns.length ? ns.reduce((s, n) => s + must(pos.get(n)), 0) / ns.length : i] as const;
    }));
    r.sort((a, b) => must(key.get(a)) - must(key.get(b)) || must(pos.get(a)) - must(pos.get(b)));
    r.forEach((id, i) => pos.set(id, i));
  };
  for (let s = 0; s < sweeps; s++) {
    for (let l = 1; l < nLayers; l++) sortBy(rows[l], pred);
    for (let l = nLayers - 2; l >= 0; l--) sortBy(rows[l], succ);
  }

  // 5. coordinates: layers along one axis, each layer centred on the widest, then relaxed toward the neighbours without overlap
  const thick = rows.map(r => Math.max(0, ...r.map(id => along(must(slots.get(id)).size))));
  const at: number[] = [];
  thick.reduce((a, t, i) => (at[i] = a, a + t + levelGap), 0);
  const cross = new Map<string, number>(); // centre on the across axis
  const extent = (r: string[]): number => r.reduce((s, id, i) => s + across(must(slots.get(id)).size) + (i ? gap : 0), 0);
  const widest = Math.max(0, ...rows.map(extent));
  for (const r of rows) {
    let a = (widest - extent(r)) / 2;
    for (const id of r) { const w = across(must(slots.get(id)).size); cross.set(id, a + w / 2); a += w + gap; }
  }
  const settle = (r: string[], nb: Map<string, string[]>): void => {
    const want = r.map(id => { const ns = must(nb.get(id)); return ns.length ? ns.reduce((s, n) => s + must(cross.get(n)), 0) / ns.length : must(cross.get(id)); });
    // left to right push-apart, then right to left, so the result is the closest non-overlapping arrangement to `want`
    const w = r.map(id => across(must(slots.get(id)).size));
    const c = want.slice();
    for (let i = 1; i < r.length; i++) c[i] = Math.max(c[i], must(c[i - 1]) + (must(w[i - 1]) + must(w[i])) / 2 + gap);
    const shift = (want.reduce((s, v, i) => s + v - must(c[i]), 0)) / Math.max(1, r.length);
    for (let i = 0; i < r.length; i++) c[i] += shift;
    for (let i = 1; i < r.length; i++) c[i] = Math.max(c[i], must(c[i - 1]) + (must(w[i - 1]) + must(w[i])) / 2 + gap);
    r.forEach((id, i) => cross.set(id, c[i]));
  };
  for (let s = 0; s < 3; s++) {
    for (let l = 1; l < nLayers; l++) settle(rows[l], pred);
    for (let l = nLayers - 2; l >= 0; l--) settle(rows[l], succ);
  }
  const lo = Math.min(...[...slots.values()].map(s => (cross.get(s.id) ?? 0) - across(s.size) / 2));
  for (const [id, c] of cross) cross.set(id, c - lo);
  const hi = Math.max(0, ...[...slots.values()].map(s => (cross.get(s.id) ?? 0) + across(s.size) / 2));

  const centre = (id: string): Pt => {
    const s = must(slots.get(id)), a = must(at[s.layer]) + must(thick[s.layer]) / 2, c = must(cross.get(id));
    return dir === 'down' ? {x: c, y: a} : {x: a, y: c};
  };
  const placed = new Map<string, Placed>();
  for (const n of nodes) {
    const p = centre(n.id);
    placed.set(n.id, {x: p.x - n.size.w / 2, y: p.y - n.size.h / 2, ...n.size});
  }
  const edgesOut: LayeredEdgeOut[] = [];
  edges.forEach((e, index) => { if (e.from === e.to) edgesOut.push({from: e.from, to: e.to, index, points: [centre(e.from)], reversed: false, self: true}); });
  for (const c of chains) {
    // the chain runs in layering order; a reversed edge's real direction is the other way
    const pts = (c.rev ? [...c.ids].reverse() : c.ids).map(centre);
    edgesOut.push({from: c.e.from, to: c.e.to, index: c.index, points: pts, reversed: c.rev, self: false});
  }
  const total = must(at[nLayers - 1]) + must(thick[nLayers - 1]);
  return {nodes: placed, edges: edgesOut, layers: layer, w: dir === 'down' ? hi : total, h: dir === 'down' ? total : hi};
}
