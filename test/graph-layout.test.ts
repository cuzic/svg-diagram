import test from 'node:test';
import assert from 'node:assert/strict';
import {breakCycles, layoutBalanced, layoutLayered, layoutTree} from '../lib/graph-layout.ts';
import type {Placed, TreeNode} from '../lib/graph-layout.ts';

const n = (id: string, children?: TreeNode[], w = 80, h = 30): TreeNode => ({id, size: {w, h}, ...(children ? {children} : {})});
const overlap = (a: Placed, b: Placed): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const noOverlaps = (m: Map<string, Placed>): void => {
  const all = [...m.entries()];
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) assert.ok(!overlap(all[i][1], all[j][1]), `${all[i][0]} overlaps ${all[j][0]}`);
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
  const edges = [['idle', 'running'], ['running', 'paused'], ['paused', 'running'], ['running', 'done'], ['running', 'failed'], ['idle', 'done']].map(([from, to]) => ({from, to}));
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
