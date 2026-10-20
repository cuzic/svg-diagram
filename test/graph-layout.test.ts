import test from 'node:test';
import assert from 'node:assert/strict';
import {breakCycles, layoutBalanced, layoutLayered, layoutTree} from '../lib/graph-layout.ts';
import type {Placed, TreeNode} from '../lib/graph-layout.ts';

const n = (id: string, children?: TreeNode[], w = 80, h = 30): TreeNode => ({id, size: {w, h}, ...(children ? {children} : {})});
const overlap = (a: Placed, b: Placed): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const noOverlaps = (m: Map<string, Placed>): void => {
  const all = [...m.entries()];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(!overlap(all[i]![1], all[j]![1]), `${all[i]![0]} overlaps ${all[j]![0]}`);
};
const inside = (m: Map<string, Placed>, w: number, h: number): void => {
  for (const [id, p] of m) assert.ok(p.x >= -0.01 && p.y >= -0.01 && p.x + p.w <= w + 0.01 && p.y + p.h <= h + 0.01, `${id} is outside ${w}x${h}`);
};

const org = n('ceo', [n('cto', [n('a'), n('b'), n('c')]), n('cfo', [n('d')]), n('coo')]);

test('layoutTree: a parent is centred over its children, levels line up, nothing overlaps', () => {
  const t = layoutTree(org);
  noOverlaps(t.nodes);
  inside(t.nodes, t.w, t.h);
  const mid = (id: string): number => t.nodes.get(id)!.x + t.nodes.get(id)!.w / 2;
  assert.ok(Math.abs(mid('cto') - mid('b')) < 0.01);
  assert.ok(mid('ceo') > mid('cto') && mid('ceo') < mid('coo')); // between its first and last child
  assert.equal(t.nodes.get('cto')!.y, t.nodes.get('cfo')!.y);
  assert.ok(t.nodes.get('a')!.y > t.nodes.get('cto')!.y + 30);
  assert.equal(t.edges.length, 7);
});

test('layoutTree dir right grows to the right and is a transposed down layout for equal squares', () => {
  const sq = (id: string, k?: TreeNode[]): TreeNode => n(id, k, 40, 40);
  const tree = sq('r', [sq('x', [sq('x1'), sq('x2')]), sq('y')]);
  const down = layoutTree(tree), right = layoutTree(tree, {dir: 'right'});
  for (const [id, p] of down.nodes) { const q = right.nodes.get(id)!; assert.deepEqual([q.x, q.y], [p.y, p.x], id); }
  assert.deepEqual([right.w, right.h], [down.h, down.w]);
});

test('layoutTree is deterministic, makes wide nodes room, and rejects a duplicate id', () => {
  assert.deepEqual([...layoutTree(org).nodes], [...layoutTree(org).nodes]);
  const wide = layoutTree(n('r', [n('a', undefined, 300), n('b', undefined, 300)]));
  noOverlaps(wide.nodes);
  assert.throws(() => layoutTree(n('r', [n('a'), n('a')])), /duplicate node id "a"/);
});

test('layoutBalanced: root in the middle, both sides used, nothing overlaps, edges leave the root sides', () => {
  const map = n('root', [n('p', [n('p1'), n('p2')]), n('q', [n('q1'), n('q2'), n('q3')]), n('r'), n('s', [n('s1')])], 100, 40);
  const t = layoutBalanced(map);
  noOverlaps(t.nodes);
  inside(t.nodes, t.w, t.h);
  const root = t.nodes.get('root')!;
  const left = ['p', 'q', 'r', 's'].filter(id => t.nodes.get(id)!.x + t.nodes.get(id)!.w <= root.x);
  const right = ['p', 'q', 'r', 's'].filter(id => t.nodes.get(id)!.x >= root.x + root.w);
  assert.equal(left.length + right.length, 4);
  assert.ok(left.length > 0 && right.length > 0);
  // a grandchild stays on its parent's side
  for (const [c, p] of [['p1', 'p'], ['q3', 'q'], ['s1', 's']] as const) assert.equal(t.nodes.get(c)!.x > root.x, t.nodes.get(p)!.x > root.x, c);
  assert.equal(t.edges.length, 10);
  assert.equal(t.edges.filter(e => e.from === 'root').length, 4);
});

test('layoutBalanced honours sides and a lone child', () => {
  const t = layoutBalanced(n('root', [n('a'), n('b')]), {sides: {a: 'left', b: 'left'}});
  const root = t.nodes.get('root')!;
  assert.ok(t.nodes.get('a')!.x + 80 <= root.x && t.nodes.get('b')!.x + 80 <= root.x);
  const one = layoutBalanced(n('root', [n('a')]));
  assert.equal(one.nodes.size, 2);
  noOverlaps(one.nodes);
  assert.equal(layoutBalanced(n('root')).nodes.size, 1);
});

const box = (id: string): {id: string; size: {w: number; h: number}} => ({id, size: {w: 90, h: 36}});

test('layoutLayered: edges point forward in layers, nothing overlaps, long edges get a path through the gap', () => {
  const nodes = ['idle', 'running', 'paused', 'done', 'failed'].map(box);
  const edges = [['idle', 'running'], ['running', 'paused'], ['paused', 'running'], ['running', 'done'], ['running', 'failed'], ['idle', 'done']].map(([from, to]) => ({from: from!, to: to!}));
  const t = layoutLayered(nodes, edges, {start: ['idle']});
  noOverlaps(t.nodes);
  inside(t.nodes, t.w, t.h);
  assert.equal(t.layers.get('idle'), 0);
  assert.equal(t.layers.get('running'), 1);
  assert.ok(t.layers.get('done')! > t.layers.get('running')!);
  const back = t.edges.find(e => e.from === 'paused' && e.to === 'running')!;
  assert.equal(back.reversed, true);
  const skip = t.edges.find(e => e.from === 'idle' && e.to === 'done')!;
  assert.ok(skip.points.length >= 3, 'the idle -> done edge goes through a dummy slot');
  for (const e of t.edges) {
    const a = t.nodes.get(e.from)!, b = t.nodes.get(e.to)!;
    assert.deepEqual(e.points[0], {x: a.x + a.w / 2, y: a.y + a.h / 2}, `${e.from} -> ${e.to} starts at its tail`);
    assert.deepEqual(e.points[e.points.length - 1], {x: b.x + b.w / 2, y: b.y + b.h / 2}, `${e.from} -> ${e.to} ends at its head`);
  }
});

test('layoutLayered: self loops, disconnected nodes, dir down, determinism, bad edges', () => {
  const nodes = ['a', 'b', 'c', 'lonely'].map(box);
  const edges = [{from: 'a', to: 'b'}, {from: 'b', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'a'}];
  const r = layoutLayered(nodes, edges), d = layoutLayered(nodes, edges, {dir: 'down'});
  assert.ok(r.edges.find(e => e.self)!.self);
  assert.equal(r.nodes.size, 4);
  noOverlaps(r.nodes); noOverlaps(d.nodes);
  assert.ok(d.nodes.get('b')!.y > d.nodes.get('a')!.y);
  assert.ok(r.nodes.get('b')!.x > r.nodes.get('a')!.x);
  assert.deepEqual([...layoutLayered(nodes, edges).nodes], [...r.nodes]);
  assert.throws(() => layoutLayered(nodes, [{from: 'a', to: 'zzz'}]), /unknown node "zzz"/);
  assert.throws(() => layoutLayered([box('a'), box('a')], []), /duplicate node id/);
});

test('layoutLayered: a wide layer of siblings keeps its crossings low (a diamond has none)', () => {
  const t = layoutLayered(['s', 'l', 'r', 'e'].map(box), [{from: 's', to: 'l'}, {from: 's', to: 'r'}, {from: 'l', to: 'e'}, {from: 'r', to: 'e'}]);
  noOverlaps(t.nodes);
  const y = (id: string): number => t.nodes.get(id)!.y;
  assert.ok(Math.abs((y('l') + y('r')) / 2 - y('s')) < 1 && Math.abs(y('s') - y('e')) < 1, 'the diamond is symmetric about its spine');
});

test('layoutLayered: a start node with an edge into it is placed after its tail, not pinned to layer 0', () => {
  const t = layoutLayered(['A', 'X', 'B'].map(box), [{from: 'A', to: 'B'}, {from: 'X', to: 'A'}], {start: ['A']});
  assert.ok(t.layers.get('A')! > t.layers.get('X')!, 'X comes before A');
  for (const e of t.edges) assert.ok(t.layers.get(e.from)! < t.layers.get(e.to)!, `${e.from} -> ${e.to} runs forward`);
  const pinned = layoutLayered(['A', 'B'].map(box), [{from: 'A', to: 'B'}], {start: ['A']});
  assert.equal(pinned.layers.get('A'), 0);
});

// ---- declared back edges (ADR 0016 D9) ----
const sq = (id: string) => ({id, size: {w: 80, h: 30}});
const rng = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;

test('breakCycles: declared edges are reversed first; with none it is the DFS (the same edges as before)', () => {
  const nodes = ['a', 'b', 'c'].map(id => ({id}));
  const e = [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'a'}];
  assert.deepEqual([...breakCycles(nodes, e)], [2]);
  assert.deepEqual([...breakCycles(nodes, e, [1])], [1]);
  assert.deepEqual([...breakCycles(nodes, e, [])], [...breakCycles(nodes, e)]);
});

test('breakCycles: a declared edge that closes no cycle, or a second one on the same cycle, throws with a fix', () => {
  const nodes = ['a', 'b', 'c'].map(id => ({id}));
  assert.throws(() => breakCycles(nodes, [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}], [0]), /a -> b closes no cycle/);
  const cyc = [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'a'}];
  assert.throws(() => breakCycles(nodes, cyc, [0, 2]), /a -> b and c -> a are on one cycle.*keep back on the one edge/);
  assert.throws(() => breakCycles(nodes, cyc, [7]), /not one of the 3 edges/);
  // two cycles that only share a node each take their own declared edge
  const two = ['a', 'b', 'c', 'd', 'e'].map(id => ({id}));
  const e = [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'a'}, {from: 'c', to: 'd'}, {from: 'd', to: 'e'}, {from: 'e', to: 'c'}];
  assert.deepEqual([...breakCycles(two, e, [2, 5])].sort(), [2, 5]);
});

test('layoutLayered back: the layers of a graph with declared returns do not depend on the order of the nodes (200 small graphs)', () => {
  const rand = rng(7);
  let tried = 0, checked = 0;
  while (checked < 200 && tried < 5000) {
    tried++;
    const n = 4 + Math.floor(rand() * 5), names = Array.from({length: n}, (_, i) => `n${i}`);
    const edges: {from: string; to: string}[] = [], back: number[] = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (rand() < 0.3) edges.push({from: names[i], to: names[j]});
    for (let k = 0; k < 2; k++) {
      const j = 1 + Math.floor(rand() * (n - 1)), i = Math.floor(rand() * j);
      if (rand() < 0.6) { back.push(edges.length); edges.push({from: names[j], to: names[i]}); }
    }
    if (!back.length) continue;
    try { breakCycles(names.map(id => ({id})), edges, back); } catch { continue; } // keep the inputs that are valid declarations
    checked++;
    const lay = (order: string[]) => layoutLayered(order.map(sq), edges, {back}).layers;
    const base = lay(names);
    for (let k = 0; k < 3; k++) {
      const shuffled = [...names].sort(() => rand() - 0.5), l = lay(shuffled);
      for (const id of names) assert.equal(l.get(id), base.get(id), `layer of ${id}`);
    }
    const out = layoutLayered(names.map(sq), edges, {back}).edges;
    for (const o of out) {
      if (back.includes(o.index)) assert.ok(o.reversed && base.get(o.from)! > base.get(o.to)!, `declared ${o.from} -> ${o.to} is a return`);
      else if (!o.reversed) assert.ok(base.get(o.from)! < base.get(o.to)!, `${o.from} -> ${o.to} runs forward`);
    }
  }
  assert.equal(checked, 200);
});

test('layoutLayered back: a CRT with a vicious circle puts the UDE above the root cause only when the return is declared', () => {
  const ids = ['late', 'cost', 'switch', 'rush', 'wip', 'start', 'kpi'];
  const e = [['kpi', 'start'], ['start', 'wip'], ['wip', 'switch'], ['wip', 'rush'], ['switch', 'late'], ['switch', 'cost'], ['rush', 'cost'], ['late', 'kpi']].map(([from, to]) => ({from, to}));
  const undeclared = layoutLayered(ids.map(sq), e).layers;
  assert.ok(undeclared.get('late')! <= undeclared.get('kpi')!, 'the DFS from the first node cuts switch -> late instead');
  for (const order of [ids, [...ids].reverse()]) {
    const l = layoutLayered(order.map(sq), e, {back: [7]}).layers;
    assert.ok(l.get('late')! > l.get('kpi')!, 'late comes after kpi');
    assert.deepEqual(ids.map(id => l.get(id)), ids.map(id => layoutLayered(ids.map(sq), e, {back: [7]}).layers.get(id)));
  }
});

test('layoutLayered back: a cycle the declaration leaves is still cut, and no declaration is the plain DFS layout', () => {
  const nodes = ['a', 'b', 'c', 'd'].map(sq);
  const e = [{from: 'a', to: 'b'}, {from: 'b', to: 'a'}, {from: 'b', to: 'c'}, {from: 'c', to: 'd'}, {from: 'd', to: 'c'}];
  const t = layoutLayered(nodes, e, {back: [1]});
  assert.equal(t.edges.filter(x => x.reversed).length, 2);
  assert.deepEqual(layoutLayered(nodes, e, {back: []}), layoutLayered(nodes, e));
});

// ---- tighten and transpose (ADR 0016 D4): opt-in, the default layout is the plain one ----
const randomGraph = (rand: () => number): {names: string[]; edges: {from: string; to: string}[]; start: string[]} => {
  const n = 4 + Math.floor(rand() * 6), names = Array.from({length: n}, (_, i) => `n${i}`);
  const edges: {from: string; to: string}[] = [];
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (i !== j && rand() < (i < j ? 0.28 : 0.05)) edges.push({from: names[i], to: names[j]});
  return {names, edges, start: rand() < 0.3 ? [names[0]] : []};
};
/** Crossings of the drawn chains, read from their centre lines: two chains cross between two layers when their order flips. */
const chainCrossings = (t: ReturnType<typeof layoutLayered>): number => {
  const cs = t.edges.filter(e => !e.self);
  let c = 0;
  for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
    const a = cs[i].points, b = cs[j].points;
    for (let p = 0; p + 1 < a.length; p++) for (let q = 0; q + 1 < b.length; q++) {
      const [a0, a1] = a[p].x <= a[p + 1].x ? [a[p], a[p + 1]] : [a[p + 1], a[p]], [b0, b1] = b[q].x <= b[q + 1].x ? [b[q], b[q + 1]] : [b[q + 1], b[q]];
      if (a0.x !== b0.x || a1.x !== b1.x || a0.x === a1.x) continue; // the same two layers
      if ((a0.y - b0.y) * (a1.y - b1.y) < 0) c++;
    }
  }
  return c;
};

test('layoutLayered tighten: a node with only outgoing edges moves to just before its nearest target; the default is unchanged', () => {
  const nodes = ['a', 'b', 'c', 'est'].map(sq);
  const e = [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'est', to: 'c'}];
  const plain = layoutLayered(nodes, e), tight = layoutLayered(nodes, e, {tighten: true});
  assert.equal(plain.layers.get('est'), 0);
  assert.equal(tight.layers.get('est'), 1);
  assert.deepEqual(layoutLayered(nodes, e, {tighten: false, transpose: false}), plain);
  assert.ok(tight.edges.find(x => x.from === 'est')!.points.length < plain.edges.find(x => x.from === 'est')!.points.length);
  assert.equal(layoutLayered(nodes, e, {tighten: true, start: ['est']}).layers.get('est'), 0, 'a start stays where it is');
});

test('layoutLayered tighten / transpose: 200 small graphs keep edge directions and starts, never add crossings, and are deterministic', () => {
  const rand = rng(11);
  for (let k = 0; k < 200; k++) {
    const {names, edges, start} = randomGraph(rand), nodes = names.map(sq);
    const plain = layoutLayered(nodes, edges, {start});
    const tight = layoutLayered(nodes, edges, {start, tighten: true});
    assert.deepEqual(tight.edges.map(x => x.reversed), plain.edges.map(x => x.reversed), 'the same edges are reversed');
    for (const x of tight.edges) if (!x.self) {
      const [lf, lt] = [tight.layers.get(x.from)!, tight.layers.get(x.to)!];
      assert.ok(x.reversed ? lt < lf : lf < lt, `${x.from} -> ${x.to} keeps its direction`);
    }
    for (const s of start) assert.equal(tight.layers.get(s), plain.layers.get(s), 'a start does not move');
    for (const [id, l] of tight.layers) assert.ok(l >= plain.layers.get(id)!, 'a node only moves toward its targets');
    assert.deepEqual(layoutLayered(nodes, edges, {start, tighten: true}), tight);
    for (const opts of [{}, {tighten: true}]) {
      const base = layoutLayered(nodes, edges, {start, ...opts}), tr = layoutLayered(nodes, edges, {start, ...opts, transpose: true});
      assert.ok(chainCrossings(tr) <= chainCrossings(base), `transpose does not add crossings (${chainCrossings(tr)} vs ${chainCrossings(base)})`);
      assert.deepEqual(layoutLayered(nodes, edges, {start, ...opts, transpose: true}), tr);
      assert.deepEqual([...tr.layers], [...base.layers]);
    }
  }
});

// ---- Brandes-Köpf coordinates and components (ADR 0016 D2, D8) ----
test("layoutLayered coord 'bk': the dummies of a long edge line up, so the edge has no bend between layers", () => {
  const nodes = ['a', 'b', 'c', 'd'].map(sq), e = [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'd'}, {from: 'a', to: 'd'}];
  const long = layoutLayered(nodes, e, {coord: 'bk'}).edges.find(x => x.from === 'a' && x.to === 'd')!;
  assert.equal(long.points.length, 4);
  assert.equal(long.points[1].y, long.points[2].y, 'the two dummies are on one line');
});

test("layoutLayered coord 'bk': 200 small graphs keep layers, never overlap, stay inside the size and are deterministic; 'relax' is the default", () => {
  const rand = rng(21);
  for (let k = 0; k < 200; k++) {
    const {names, edges, start} = randomGraph(rand), nodes = names.map(sq);
    const plain = layoutLayered(nodes, edges, {start}), bk = layoutLayered(nodes, edges, {start, coord: 'bk'});
    assert.deepEqual(layoutLayered(nodes, edges, {start, coord: 'relax'}), plain);
    assert.deepEqual([...bk.layers], [...plain.layers]);
    noOverlaps(bk.nodes);
    inside(bk.nodes, bk.w, bk.h);
    assert.deepEqual(layoutLayered(nodes, edges, {start, coord: 'bk'}), bk);
    // the nodes of one layer keep the order the sweeps gave them: a node never jumps over its neighbour
    const byLayer = new Map<number, string[]>();
    for (const [id, l] of bk.layers) byLayer.set(l, [...(byLayer.get(l) ?? []), id]);
    for (const ids of byLayer.values()) {
      const ys = ids.map(id => bk.nodes.get(id)!.y).sort((p, q) => p - q);
      for (let i = 1; i < ys.length; i++) assert.ok(ys[i] - ys[i - 1] >= 30 + 24 - 0.01, 'gap kept inside a layer');
    }
  }
});

test("layoutLayered coord 'bk': separate components are packed one gap apart, whatever order they are written in", () => {
  const big = (p: string) => ({nodes: [`${p}r`, ...[1, 2, 3, 4, 5].map(i => `${p}m${i}`), `${p}x`], edges: [1, 2, 3, 4, 5].flatMap(i => [{from: `${p}r`, to: `${p}m${i}`}, {from: `${p}m${i}`, to: `${p}x`}])});
  const chain = (p: string) => ({nodes: [1, 2, 3, 4].map(i => `${p}${i}`), edges: [1, 2, 3].map(i => ({from: `${p}${i}`, to: `${p}${i + 1}`}))});
  const box2 = (id: string) => ({id, size: {w: 120, h: 40}});
  for (const parts of [[chain('b'), big('a')], [big('a'), chain('b')], [chain('b'), big('a'), big('c')], [big('a'), chain('b'), big('c')]]) {
    const names = parts.flatMap(p => p.nodes), edges = parts.flatMap(p => p.edges);
    const t = layoutLayered(names.map(box2), edges, {dir: 'right', gap: 24, levelGap: 60, coord: 'bk'});
    const range = (p: {nodes: string[]}): [number, number] => [Math.min(...p.nodes.map(id => t.nodes.get(id)!.y)), Math.max(...p.nodes.map(id => t.nodes.get(id)!.y + 40))];
    const rs = parts.map(range).sort((p, q) => p[0] - q[0]);
    for (let i = 1; i < rs.length; i++) assert.equal(rs[i][0] - rs[i - 1][1], 24, 'one gap between two components');
    assert.equal(rs[0][0], 0);
    noOverlaps(t.nodes);
  }
});

test("layoutLayered coord 'bk': a connected input has the one component's own range (no extra room)", () => {
  const nodes = ['a', 'b', 'c', 'd'].map(sq), e = [{from: 'a', to: 'b'}, {from: 'a', to: 'c'}, {from: 'b', to: 'd'}, {from: 'c', to: 'd'}];
  const t = layoutLayered(nodes, e, {coord: 'bk'});
  assert.equal(Math.min(...[...t.nodes.values()].map(p => p.y)), 0);
  assert.equal(Math.max(...[...t.nodes.values()].map(p => p.y + p.h)), t.h);
});

// ---- returns in an outer lane (ADR 0016 D7) ----
const outerOpt = (which: 'all' | 'declared') => ({outer: {which, gap: 18, step: 14}});

test('layoutLayered outer: a return that skips two layers or more runs in a lane past the boxes with no dummies; an adjacent return and forward edges do not', () => {
  const nodes = ['a', 'b', 'c', 'd'].map(sq);
  const e = [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'd'}, {from: 'd', to: 'a'}, {from: 'c', to: 'b'}];
  const plain = layoutLayered(nodes, e, {back: [3]}), outer = layoutLayered(nodes, e, {back: [3], ...outerOpt('declared')});
  const long = outer.edges.find(x => x.index === 3)!;
  assert.ok(long.outer && long.reversed);
  assert.equal(long.points.length, 4);
  assert.ok(long.points[1].y >= Math.max(...[...outer.nodes.values()].map(p => p.y + p.h)) + 18, 'the lane is past every box');
  assert.equal(outer.edges.filter(x => x.outer).length, 1, 'the adjacent return c -> b stays inline');
  assert.deepEqual([...outer.layers], [...plain.layers], 'layers do not change');
  // without a declaration, "declared" leaves the DFS return inline; "all" moves it out
  const dfs = layoutLayered(nodes, e.slice(0, 4), outerOpt('declared'));
  assert.equal(dfs.edges.filter(x => x.outer).length, 0);
  assert.equal(layoutLayered(nodes, e.slice(0, 4), outerOpt('all')).edges.filter(x => x.outer).length, 1);
});

test('layoutLayered outer: the longer return is the outer lane; no outer option is the plain layout', () => {
  const nodes = ['a', 'b', 'c', 'd', 'e'].map(sq);
  const e = [{from: 'a', to: 'b'}, {from: 'b', to: 'c'}, {from: 'c', to: 'd'}, {from: 'd', to: 'e'}, {from: 'd', to: 'b'}, {from: 'e', to: 'a'}];
  const t = layoutLayered(nodes, e, {...outerOpt('all')});
  const short = t.edges.find(x => x.index === 4)!, long = t.edges.find(x => x.index === 5)!;
  assert.ok(short.outer && long.outer && long.points[1].y - short.points[1].y === 14, 'the long one is one step further out');
  assert.deepEqual(layoutLayered(nodes, e), layoutLayered(nodes, e, {}));
});

test('layoutLayered outer: 200 small graphs keep the layers and the boxes apart, and an outer edge is a return of two layers or more (deterministic)', () => {
  const rand = rng(31);
  for (let k = 0; k < 200; k++) {
    const {names, edges, start} = randomGraph(rand), nodes = names.map(sq);
    const plain = layoutLayered(nodes, edges, {start}), t = layoutLayered(nodes, edges, {start, ...outerOpt('all')});
    assert.deepEqual([...t.layers], [...plain.layers]);
    noOverlaps(t.nodes);
    for (const x of t.edges) if (x.outer) assert.ok(x.reversed && t.layers.get(x.from)! - t.layers.get(x.to)! >= 2);
    for (const x of plain.edges) if (x.reversed && !x.self && plain.layers.get(x.from)! - plain.layers.get(x.to)! >= 2) assert.ok(t.edges.find(y => y.index === x.index)!.outer, 'every long return is outer');
    assert.deepEqual(layoutLayered(nodes, edges, {start, ...outerOpt('all')}), t);
  }
});

test('layoutLayered transpose: crossed neighbours in a layer are swapped', () => {
  const nodes = ['a', 'b', 'd', 'c'].map(sq), e = [{from: 'a', to: 'd'}, {from: 'b', to: 'c'}];
  assert.equal(chainCrossings(layoutLayered(nodes, e, {transpose: true})), 0);
});

// ADR 0010 D7: fold. Small directed graphs from a fixed seed.

const randomDag = (seed: number, n: number) => {
  const r = rng(seed);
  const nodes = Array.from({length: n}, (_, i) => ({id: `n${i}`, size: {w: 40 + Math.floor(r() * 50), h: 20}}));
  const edges = [] as {from: string; to: string}[];
  for (let i = 1; i < n; i++) { edges.push({from: `n${Math.floor(r() * i)}`, to: `n${i}`}); if (r() < 0.4) edges.push({from: `n${Math.floor(r() * i)}`, to: `n${i}`}); }
  return {nodes, edges: edges.filter((e, k) => edges.findIndex(f => f.from === e.from && f.to === e.to) === k)};
};

test('layoutLayered fold: without it nothing changes; with a limit nothing needs, the same layout', () => {
  for (const seed of [1, 2, 3]) {
    const {nodes, edges} = randomDag(seed, 14);
    const plain = layoutLayered(nodes, edges, {dir: 'right'});
    assert.deepEqual(layoutLayered(nodes, edges, {dir: 'right', fold: 1e6}), plain);
    assert.equal(plain.folded, undefined);
  }
});

test('layoutLayered fold: rows keep the order of the layers, hold the limit, do not overlap, and keep every node', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    const {nodes, edges} = randomDag(seed, 16);
    const plain = layoutLayered(nodes, edges, {dir: 'right'});
    const widest = Math.max(...nodes.map(n => n.size.h));
    const limit = Math.max(widest * 3 + 24 * 2, (plain.h * 0.6)); // across is h in dir 'right'
    const lay = layoutLayered(nodes, edges, {dir: 'right', fold: limit});
    assert.equal(lay.nodes.size, nodes.length);
    noOverlaps(lay.nodes);
    // an edge still runs from a lower layer to a higher one, and a layer of the plain layout is a run of layers of the folded one, in order
    for (const e of edges) assert.ok(lay.layers.get(e.to)! > lay.layers.get(e.from)!, `${e.from} -> ${e.to}`);
    const ids = nodes.map(n => n.id);
    for (const a of ids) for (const b of ids) if (plain.layers.get(a)! < plain.layers.get(b)!) assert.ok(lay.layers.get(a)! < lay.layers.get(b)!, 'a later layer stays later');
    // every row, the real nodes with the dummies, fits the limit: the layout is no wider than the limit plus what the settling pushes (checked by the real nodes of one row)
    const byLayer = new Map<number, number>();
    for (const [id, l] of lay.layers) byLayer.set(l, (byLayer.get(l) ?? 0) + nodes.find(n => n.id === id)!.size.h);
    for (const [l, sum] of byLayer) assert.ok(sum <= limit, `layer ${l}: ${sum} > ${limit}`);
    if (lay.folded) assert.ok(lay.folded.every(f => f.rows >= 2));
    assert.deepEqual(layoutLayered(nodes, edges, {dir: 'right', fold: limit}), lay, 'deterministic');
  }
});

test('layoutLayered fold: a long layer is cut into rows in input order, and the later layers move down', () => {
  const nodes = [{id: 'r', size: {w: 40, h: 20}}, ...[0, 1, 2, 3, 4, 5].map(i => ({id: `c${i}`, size: {w: 40, h: 20}})), {id: 't', size: {w: 40, h: 20}}];
  const edges = [...[0, 1, 2, 3, 4, 5].map(i => ({from: 'r', to: `c${i}`})), ...[0, 1, 2, 3, 4, 5].map(i => ({from: `c${i}`, to: 't'}))];
  const lay = layoutLayered(nodes, edges, {dir: 'right', gap: 10, fold: 100}); // three nodes would fit (80), but the arrows from r to the later rows and from the earlier rows to t pass each row as dummies, 10px each: two a row
  const rows = [0, 1, 2, 3, 4, 5].map(i => lay.layers.get(`c${i}`)!);
  assert.deepEqual(rows, [1, 1, 2, 2, 3, 3]);
  assert.equal(lay.layers.get('t'), 4);
  assert.deepEqual(lay.folded, [{layer: 1, rows: 3}]);
});

// ---- alap (ADR 0019 D1): the input side moves, a chain of inputs too ----
test('layoutLayered alap: a chain of inputs moves to just before its target; keep ids and the default stay', () => {
  const nodes = ['r', 'i1', 'i2', 'i3', 'i4', 'g', 'o', 'x'].map(sq);
  const e = [['r', 'i1'], ['i1', 'i2'], ['i2', 'i3'], ['i3', 'i4'], ['i4', 'g'], ['o', 'x'], ['x', 'i4']].map(([from, to]) => ({from, to}));
  const plain = layoutLayered(nodes, e), alap = layoutLayered(nodes, e, {alap: {keep: ['r']}});
  assert.deepEqual([plain.layers.get('o'), plain.layers.get('x')], [0, 1]);
  assert.deepEqual([alap.layers.get('x'), alap.layers.get('o')], [3, 2], 'the chain o -> x lies just before i4 (tighten alone leaves x on layer 1)');
  assert.equal(alap.layers.get('r'), 0, 'a kept id stays');
  assert.equal(layoutLayered(nodes, e, {tighten: true}).layers.get('x'), 1);
  assert.deepEqual(layoutLayered(nodes, e, {alap: {keep: []}}).layers.get('r'), 0, 'r heads a chain of its own: i1 and the rest follow it, nothing earlier moves');
  assert.deepEqual(layoutLayered(nodes, e), plain, 'without alap nothing changes');
});

test('layoutLayered alap: 200 small graphs keep edge directions, the reversed edges and never move a node earlier', () => {
  const rand = rng(23);
  for (let k = 0; k < 200; k++) {
    const {names, edges, start} = randomGraph(rand), nodes = names.map(sq);
    const plain = layoutLayered(nodes, edges, {start}), alap = layoutLayered(nodes, edges, {start, alap: {keep: names.slice(0, 1)}});
    assert.deepEqual(alap.edges.map(x => x.reversed), plain.edges.map(x => x.reversed), 'the same edges are reversed (alap does not change the cycle breaking)');
    for (const n of names) assert.ok(alap.layers.get(n)! >= plain.layers.get(n)!, `${n} does not move earlier`);
    for (const x of alap.edges) if (!x.self) {
      const [lf, lt] = [alap.layers.get(x.from)!, alap.layers.get(x.to)!];
      assert.ok(x.reversed ? lt < lf : lf < lt, `${x.from} -> ${x.to} keeps its direction`);
    }
    for (const s of [...start, names[0]]) assert.equal(alap.layers.get(s), plain.layers.get(s), 'a start or kept node does not move');
  }
});
