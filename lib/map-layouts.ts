// Layouts for mindmap({layout}) besides the radial one: org chart and outline (hanging lists), brace map, fishbone, timeline, and
// mirrors of a tree. Pure, like graph-layout.ts: sizes in, rectangles and edge polylines out.
import {layoutTree} from './graph-layout.ts';
import type {Placed, Pt, TreeLayout, TreeNode} from './graph-layout.ts';

const GAP = 20;

const dup = (seen: Set<string>, id: string): void => {
  if (seen.has(id)) throw new Error(`graph layout: duplicate node id "${id}"`);
  seen.add(id);
};

/** Flips a layout left to right (x') or top to bottom: positions, edges and braces. */
export function mirror(t: TreeLayout, axis: 'x' | 'y'): TreeLayout {
  const fx = (p: Pt): Pt => axis === 'x' ? {x: t.w - p.x, y: p.y} : {x: p.x, y: t.h - p.y};
  const nodes = new Map<string, Placed>();
  for (const [id, p] of t.nodes) nodes.set(id, axis === 'x' ? {...p, x: t.w - p.x - p.w} : {...p, y: t.h - p.y - p.h});
  return {...t, nodes, edges: t.edges.map(e => ({...e, points: e.points.map(fx)})), ...(t.braces ? {braces: t.braces.map(b => axis === 'x' ? {...b, x: t.w - b.x, tipX: t.w - b.tipX, side: 'left' as const} : {...b, y1: t.h - b.y2, y2: t.h - b.y1, ymid: t.h - b.ymid})} : {})};
}

/**
 * Hanging lists. Every node of a list sits under its parent, indented, and a line drops from the parent and turns into each child
 * (an outline). With `rowFirst` the root's children stand side by side under the root, each with its own list below (an org chart
 * whose lower levels are lists).
 */
export function layoutHanging(root: TreeNode, opts: {rowFirst?: boolean; gap?: number; indent?: number; rowGap?: number} = {}): TreeLayout {
  const vgap = opts.gap ?? 12, indent = opts.indent ?? 28, colGap = opts.rowGap ?? 28;
  const seen = new Set<string>(), nodes = new Map<string, Placed>(), edges: TreeLayout['edges'] = [];
  /** places `n` at (x, y) and its descendants below; returns the bottom edge and the right edge used */
  const list = (n: TreeNode, x: number, y: number): {bottom: number; right: number} => {
    dup(seen, n.id);
    nodes.set(n.id, {x, y, ...n.size});
    let bottom = y + n.size.h, right = x + n.size.w;
    for (const c of n.children ?? []) {
      const top = bottom + vgap, cx = x + indent;
      const r = list(c, cx, top);
      const cy = top + c.size.h / 2;
      edges.push({from: n.id, to: c.id, points: [{x: x + 14, y: y + n.size.h}, {x: x + 14, y: cy}, {x: cx, y: cy}]});
      bottom = r.bottom; right = Math.max(right, r.right);
    }
    return {bottom, right};
  };
  if (!opts.rowFirst) { const r = list(root, 0, 0); return {nodes, edges, w: r.right, h: r.bottom}; }
  const kids = root.children ?? [];
  dup(seen, root.id);
  const rowTop = root.size.h + 44;
  let cx = 0, h = rowTop;
  const cols: {id: string; x: number; w: number}[] = [];
  for (const k of kids) {
    const r = list(k, cx, rowTop);
    cols.push({id: k.id, x: cx, w: k.size.w});
    h = Math.max(h, r.bottom);
    cx = r.right + colGap;
  }
  const w = Math.max(kids.length ? cx - colGap : 0, root.size.w);
  const first = cols[0], last = cols[cols.length - 1];
  const rootX = kids.length ? (first.x + first.w / 2 + last.x + last.w / 2) / 2 - root.size.w / 2 : 0;
  const shift = Math.max(0, -rootX);
  if (shift) { for (const [id, p] of nodes) nodes.set(id, {...p, x: p.x + shift}); for (const e of edges) e.points = e.points.map(p => ({x: p.x + shift, y: p.y})); for (const c of cols) c.x += shift; }
  nodes.set(root.id, {x: rootX + shift, y: 0, ...root.size});
  const bus = root.size.h + 22, rcx = rootX + shift + root.size.w / 2;
  const rootL = rootX + shift + 8, rootR = rootX + shift + root.size.w - 8;
  for (const c of cols) {
    const ccx = c.x + c.w / 2;
    // a child 1-4px off the root's centre would get a 1-4px step in its bus line: drop straight from the root at the child's own x instead
    if (ccx !== rcx && Math.abs(ccx - rcx) <= 4 && ccx >= rootL && ccx <= rootR) { edges.push({from: root.id, to: c.id, points: [{x: ccx, y: root.size.h}, {x: ccx, y: rowTop}]}); continue; }
    edges.push({from: root.id, to: c.id, points: [{x: rcx, y: root.size.h}, {x: rcx, y: bus}, {x: ccx, y: bus}, {x: ccx, y: rowTop}]});
  }
  return {nodes, edges, w: Math.max(w + shift, rootX + shift + root.size.w), h};
}

/** A brace map: a tree growing right whose branches are gathered by `{` braces (the parent's tip, then the children). */
export function layoutBrace(root: TreeNode, opts: {gap?: number} = {}): TreeLayout {
  const t = layoutTree(root, {dir: 'right', gap: opts.gap ?? GAP, levelGap: 64});
  const braces: NonNullable<TreeLayout['braces']> = [], edges: TreeLayout['edges'] = [];
  const walk = (n: TreeNode): void => {
    const p = t.nodes.get(n.id)!, kids = (n.children ?? []).map(c => ({c, p: t.nodes.get(c.id)!}));
    if (!kids.length) return;
    if (kids.length === 1) { // one child: nothing to gather, a plain line
      const k = kids[0], cy = k.p.y + k.p.h / 2;
      edges.push({from: n.id, to: k.c.id, points: [{x: p.x + p.w, y: p.y + p.h / 2}, {x: k.p.x, y: cy}]});
      walk(k.c);
      return;
    }
    const left = Math.min(...kids.map(k => k.p.x)), spine = left - 26;
    const y1 = Math.min(...kids.map(k => k.p.y + k.p.h / 2)), y2 = Math.max(...kids.map(k => k.p.y + k.p.h / 2)), ymid = p.y + p.h / 2;
    braces.push({x: spine, y1, y2, ymid, tipX: spine - 10, side: 'right'});
    edges.push({from: n.id, to: n.id, points: [{x: p.x + p.w, y: ymid}, {x: spine - 10, y: ymid}]});
    for (const k of kids) { edges.push({from: n.id, to: k.c.id, points: [{x: spine + 8, y: k.p.y + k.p.h / 2}, {x: k.p.x, y: k.p.y + k.p.h / 2}]}); walk(k.c); }
  };
  walk(root);
  return {nodes: t.nodes, edges, braces, w: t.w, h: t.h};
}

/**
 * A fishbone (cause and effect): the root is the head on the right, a spine runs to it, each child of the root is a category at
 * the end of a slanted bone (alternately above and below the spine), and its children are causes hung on that bone by short
 * horizontal lines. A cause's own children (and theirs) hang under it as an outline, indented toward the tail, so the fishbone
 * of the QC seven tools (large bone, medium bone, small bone) is three levels under the root, or more.
 */
export function layoutFishbone(root: TreeNode, opts: {gap?: number} = {}): TreeLayout {
  const gap = opts.gap ?? 8, seen = new Set<string>([root.id]);
  const cats = root.children ?? [];
  for (const c of cats) dup(seen, c.id);
  // each cause is a hanging list (its causes under it, indented to the left of the bone's side), read right to left
  const lists = new Map<string, TreeLayout>();
  for (const c of cats) for (const k of c.children ?? []) { const l = layoutHanging(k, {gap: 6, indent: 20}); for (const id of l.nodes.keys()) dup(seen, id); lists.set(k.id, mirror(l, 'x')); }
  const blocksH = (c: TreeNode): number => (c.children ?? []).reduce((s, k, i) => s + lists.get(k.id)!.h + (i ? gap : 0), 0);
  const lengthOf = (c: TreeNode): number => 16 + blocksH(c) + 22;
  const half = Math.max(0, ...cats.map(c => c.size.h + lengthOf(c)), root.size.h / 2), spineY = half;
  const causeW = (c: TreeNode): number => Math.max(0, ...(c.children ?? []).map(k => lists.get(k.id)!.w));
  const nodes = new Map<string, Placed>(), edges: TreeLayout['edges'] = [];
  // each row (the categories above the spine, the ones below) runs left to right: a category sits where its causes (to the left of
  // its bone) and its own box clear the one before; the bone leans toward the spine
  const rows: TreeNode[][] = [[], []];
  cats.forEach((c, i) => rows[i % 2].push(c));
  let spineEnd = 120;
  rows.forEach((row, ri) => {
    const top = ri === 0;
    let cursor = top ? 0 : 56; // the lower row starts a little in, so the bones do not all meet the spine at one place
    for (const c of row) {
      const catY = top ? 0 : 2 * half - c.size.h, startY = top ? catY + c.size.h : catY, dir = top ? 1 : -1;
      const run = Math.abs(spineY - startY), dxs = run * 0.4;
      const bx = cursor + Math.max(causeW(c) + 12, c.size.w / 2);
      nodes.set(c.id, {x: bx - c.size.w / 2, y: catY, ...c.size});
      edges.push({from: c.id, to: c.id, points: [{x: bx, y: startY}, {x: bx + dxs, y: spineY}]});
      let y = startY + dir * 16;
      for (const k of c.children ?? []) {
        // above the spine a block hangs downward from its cause; below it the block is turned over (its small bones are above the cause, toward the spine)
        const raw = lists.get(k.id)!, block = top ? raw : mirror(raw, 'y');
        const y0 = top ? y : y - block.h, kp = block.nodes.get(k.id)!, cyk = y0 + kp.y + kp.h / 2;
        const bxk = bx + dxs * (Math.abs(cyk - startY) / run), sx = bxk - 12 - block.w;
        for (const [id, p] of block.nodes) nodes.set(id, {...p, x: p.x + sx, y: p.y + y0});
        for (const e of block.edges) edges.push({...e, points: e.points.map(q => ({x: q.x + sx, y: q.y + y0}))});
        edges.push({from: c.id, to: k.id, points: [{x: bxk - 12, y: cyk}, {x: bxk, y: cyk}]});
        y += dir * (block.h + gap);
      }
      cursor = Math.max(bx + c.size.w / 2, bx + dxs) + 28;
      spineEnd = Math.max(spineEnd, bx + dxs + 24);
    }
  });
  const rx = spineEnd + 16;
  nodes.set(root.id, {x: rx, y: spineY - root.size.h / 2, ...root.size});
  edges.unshift({from: root.id, to: root.id, points: [{x: 0, y: spineY}, {x: rx, y: spineY}], bold: true});
  let minX = 0;
  for (const p of nodes.values()) minX = Math.min(minX, p.x);
  if (minX < 0) { for (const [id, p] of nodes) nodes.set(id, {...p, x: p.x - minX}); for (const e of edges) e.points = e.points.map(p => ({x: p.x - minX, y: p.y})); }
  return {nodes, edges, w: rx - minX + root.size.w, h: 2 * half};
}

/**
 * A timeline: the root at the left end of a horizontal axis; its children stand along the axis, alternately above and below it,
 * each with its own list (an outline) growing away from the axis.
 */
export function layoutTimelineMap(root: TreeNode, opts: {gap?: number} = {}): TreeLayout {
  const colGap = opts.gap ?? 28, seen = new Set<string>([root.id]);
  const kids = root.children ?? [];
  const lists = kids.map(k => { const sub = layoutHanging(k, {gap: 10, indent: 24}); for (const id of sub.nodes.keys()) dup(seen, id); return sub; });
  const above = Math.max(0, ...lists.filter((_, i) => i % 2 === 0).map(l => l.h)), below = Math.max(0, ...lists.filter((_, i) => i % 2 === 1).map(l => l.h));
  const stub = 26, axisY = Math.max(above + stub, root.size.h / 2), nodes = new Map<string, Placed>(), edges: TreeLayout['edges'] = [];
  nodes.set(root.id, {x: 0, y: axisY - root.size.h / 2, ...root.size});
  let cx = root.size.w + 36;
  const stems: number[] = [];
  kids.forEach((k, i) => {
    const sub = lists[i], up = i % 2 === 0, x = cx;
    const dy = up ? axisY - stub - sub.h : axisY + stub;
    // an upper list is read upward from the axis: it is placed flipped, so the child sits next to the axis and its list grows away
    const placed = up ? mirror(sub, 'y') : sub;
    for (const [id, p] of placed.nodes) nodes.set(id, {...p, x: p.x + x, y: p.y + dy});
    for (const e of placed.edges) edges.push({from: e.from, to: e.to, points: e.points.map(p => ({x: p.x + x, y: p.y + dy}))});
    const kp = nodes.get(k.id)!;
    const stemX = kp.x + kp.w / 2;
    stems.push(stemX);
    edges.push({from: root.id, to: k.id, points: [{x: stemX, y: axisY}, {x: stemX, y: up ? kp.y + kp.h : kp.y}]});
    cx += sub.w + colGap;
  });
  const endX = Math.max(cx - colGap, root.size.w);
  edges.unshift({from: root.id, to: root.id, points: [{x: root.size.w, y: axisY}, {x: endX, y: axisY}], bold: true});
  return {nodes, edges, w: endX, h: axisY + Math.max(below + stub, root.size.h / 2)};
}
