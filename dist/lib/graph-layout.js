import { must } from './must.js';
const GAP = 24, LEVEL_GAP = 40;
const dupCheck = (seen, id) => {
    if (seen.has(id))
        throw new Error(`graph layout: duplicate node id "${id}"`);
    seen.add(id);
};
/**
 * A tidy tree. Levels are aligned (every node of a level starts at the same depth offset), a parent is centred over its
 * children, and a subtree never overlaps its sibling. Not the most compact tree (no contour packing) but never overlaps and
 * reads as an org chart.
 */
export function layoutTree(root, opts = {}) {
    const dir = opts.dir ?? 'down', gap = opts.gap ?? GAP, levelGap = opts.levelGap ?? LEVEL_GAP;
    // across = the axis siblings spread on, along = the axis levels grow on
    const across = (s) => dir === 'down' ? s.w : s.h, along = (s) => dir === 'down' ? s.h : s.w;
    const seen = new Set(), levelDepth = [];
    const span = new Map();
    const measure = (n, level) => {
        dupCheck(seen, n.id);
        levelDepth[level] = Math.max(levelDepth[level] ?? 0, along(n.size));
        const kids = n.children ?? [];
        const kidsSpan = kids.reduce((s, k, i) => s + measure(k, level + 1) + (i ? gap : 0), 0);
        const mine = Math.max(across(n.size), kidsSpan);
        span.set(n, mine);
        return mine;
    };
    measure(root, 0);
    const levelAt = [];
    levelDepth.reduce((at, d, i) => (levelAt[i] = at, at + d + levelGap), 0);
    const centres = new Map(), levels = new Map();
    const place = (n, from, level) => {
        const mine = must(span.get(n)), kids = n.children ?? [];
        centres.set(n.id, from + mine / 2);
        levels.set(n.id, level);
        const kidsSpan = kids.reduce((s, k, i) => s + must(span.get(k)) + (i ? gap : 0), 0);
        let at = from + (mine - kidsSpan) / 2;
        for (const k of kids) {
            place(k, at, level + 1);
            at += must(span.get(k)) + gap;
        }
    };
    place(root, 0, 0);
    const nodes = new Map();
    const index = (n) => {
        const c = must(centres.get(n.id)), l = must(levels.get(n.id));
        nodes.set(n.id, dir === 'down' ? { x: c - n.size.w / 2, y: must(levelAt[l]), ...n.size } : { x: must(levelAt[l]), y: c - n.size.h / 2, ...n.size });
        for (const k of n.children ?? [])
            index(k);
    };
    index(root);
    const edges = [];
    const link = (n) => {
        const p = must(nodes.get(n.id));
        for (const k of n.children ?? []) {
            const q = must(nodes.get(k.id));
            const [a, b] = dir === 'down' ? [{ x: p.x + p.w / 2, y: p.y + p.h }, { x: q.x + q.w / 2, y: q.y }] : [{ x: p.x + p.w, y: p.y + p.h / 2 }, { x: q.x, y: q.y + q.h / 2 }];
            const mid = dir === 'down' ? (a.y + b.y) / 2 : (a.x + b.x) / 2;
            edges.push({ from: n.id, to: k.id, points: dir === 'down' ? [a, { x: a.x, y: mid }, { x: b.x, y: mid }, b] : [a, { x: mid, y: a.y }, { x: mid, y: b.y }, b] });
            link(k);
        }
    };
    link(root);
    const total = must(span.get(root)), depth = must(levelAt[levelAt.length - 1]) + must(levelDepth[levelDepth.length - 1]);
    return { nodes, edges, w: dir === 'down' ? total : depth, h: dir === 'down' ? depth : total };
}
/**
 * A mind map: the root in the middle, its children split into a right and a left half (balanced by height, input order kept
 * inside each half), each half a tree growing outward. `sides` pins a child to a side.
 */
export function layoutBalanced(root, opts = {}) {
    const levelGap = opts.levelGap ?? LEVEL_GAP, gap = opts.gap ?? GAP;
    const kids = root.children ?? [];
    const heightOf = (k) => layoutTree(k, { dir: 'right', gap, levelGap }).h;
    const heights = kids.map(heightOf);
    const side = kids.map(k => opts.sides?.[k.id] ?? 'right');
    const load = { left: 0, right: 0 };
    kids.forEach((k, i) => { if (opts.sides?.[k.id])
        load[must(side[i])] += must(heights[i]); });
    // unpinned children: in the order written, the first half of what is left (by height) goes right, the rest left; each side reads top to bottom
    const free = kids.map((_, i) => i).filter(i => !opts.sides?.[must(kids[i]).id]);
    const freeTotal = free.reduce((s, i) => s + must(heights[i]), 0);
    let acc = 0;
    for (const i of free) {
        const mid = acc + must(heights[i]) / 2;
        side[i] = load.right + mid <= (load.left + load.right + freeTotal) / 2 ? 'right' : 'left';
        acc += must(heights[i]);
    }
    const half = (which) => {
        const ks = kids.filter((_, i) => side[i] === which);
        return ks.length ? layoutTree({ id: `${root.id}\u0000${which}`, size: { w: 0, h: 0 }, children: ks }, { dir: 'right', gap, levelGap }) : null;
    };
    const right = half('right'), left = half('left');
    const rightW = right ? right.w - levelGap : 0, leftW = left ? left.w - levelGap : 0; // a half's own root (0 wide) plus a gap leads each half
    const H = Math.max(right?.h ?? 0, left?.h ?? 0, root.size.h);
    const rootX = leftW + (left ? levelGap : 0);
    const nodes = new Map(), edges = [];
    const seen = new Set([root.id]);
    nodes.set(root.id, { x: rootX, y: (H - root.size.h) / 2, ...root.size });
    const rootP = must(nodes.get(root.id));
    const take = (t, which) => {
        if (!t)
            return;
        const ghost = `${root.id}\u0000${which}`, dy = (H - t.h) / 2;
        const shiftX = which === 'right' ? rootX + root.size.w : 0;
        for (const [id, p] of t.nodes) {
            if (id === ghost)
                continue;
            dupCheck(seen, id);
            // the left half is mirrored: its depth runs from the root outward to the left
            nodes.set(id, { ...p, x: which === 'right' ? p.x + shiftX : t.w - p.x - p.w, y: p.y + dy });
        }
        const rootEdge = (to) => {
            const q = must(nodes.get(to));
            const a = { x: which === 'right' ? rootP.x + rootP.w : rootP.x, y: rootP.y + rootP.h / 2 }, b = { x: which === 'right' ? q.x : q.x + q.w, y: q.y + q.h / 2 };
            const m = (a.x + b.x) / 2;
            return [a, { x: m, y: a.y }, { x: m, y: b.y }, b];
        };
        for (const e of t.edges) {
            if (e.from === ghost) {
                edges.push({ from: root.id, to: e.to, points: rootEdge(e.to) });
                continue;
            }
            const pts = e.points.map(p => ({ x: which === 'right' ? p.x + shiftX : t.w - p.x, y: p.y + dy }));
            edges.push({ from: e.from, to: e.to, points: pts });
        }
    };
    take(right, 'right');
    take(left, 'left');
    return { nodes, edges, w: leftW + (left ? levelGap : 0) + root.size.w + (right ? levelGap : 0) + rightW, h: H };
}
/**
 * Which edges (by index in `edges`) a layering reverses to be acyclic. The `declared` ones (a return the author named, `back: true`)
 * are reversed first and the DFS only runs over the rest, so the layers no longer depend on the order the nodes are written in; with
 * none declared it is the plain DFS (from `start`, then the nodes in input order; an edge to a node on the stack is reversed).
 * A declared edge must close a cycle through the other edges, and one cycle takes one declared edge: otherwise it throws.
 */
export function breakCycles(nodes, edges, declared = [], start = []) {
    const decl = new Set();
    for (const i of declared) {
        if (!Number.isInteger(i) || i < 0 || i >= edges.length)
            throw new Error(`graph layout: back edge index ${i} is not one of the ${edges.length} edges`);
        const e = must(edges[i]);
        if (e.from !== e.to)
            decl.add(i);
    }
    const edge = (i) => must(edges[i]); // i is one of the declared indices, bounds-checked above
    const name = (i) => `${edge(i).from} -> ${edge(i).to}`;
    const rest = new Map(nodes.map(n => [n.id, []]));
    edges.forEach((e, i) => { if (e.from !== e.to && !decl.has(i))
        rest.get(e.from)?.push(e.to); });
    const reach = (from, to, avoid = new Set()) => {
        const seen = new Set([from]), todo = [from];
        while (todo.length) {
            const u = must(todo.pop());
            if (u === to)
                return true;
            for (const v of rest.get(u) ?? [])
                if (!seen.has(v) && !avoid.has(v)) {
                    seen.add(v);
                    todo.push(v);
                }
        }
        return false;
    };
    const list = [...decl];
    // two declared edges on one simple cycle: two vertex-disjoint ways d1.to => d2.from and d2.to => d1.from (search capped: a huge graph is not refused for it)
    let budget = 20000;
    const twoOnOneCycle = (d1, d2) => {
        const e1 = edge(d1), e2 = edge(d2), goal = e2.from, onPath = new Set();
        const walk = (u) => {
            if (--budget < 0)
                return false;
            onPath.add(u);
            let found = false;
            if (u === goal)
                found = reach(e2.to, e1.from, onPath) && !onPath.has(e2.to);
            else
                for (const v of rest.get(u) ?? [])
                    if (!onPath.has(v) && walk(v)) {
                        found = true;
                        break;
                    }
            onPath.delete(u);
            return found;
        };
        return walk(e1.to);
    };
    for (const [i, d1] of list.entries())
        for (const d2 of list.slice(i + 1)) {
            if (twoOnOneCycle(d1, d2))
                throw new Error(`graph layout: back edges ${name(d1)} and ${name(d2)} are on one cycle. One back edge cuts a cycle: keep back on the one edge that is the return in meaning`);
        }
    for (const d of list) {
        const e = edge(d);
        if (!reach(e.to, e.from))
            throw new Error(`graph layout: back edge ${name(d)} closes no cycle: there is no way from ${e.to} back to ${e.from} along the other edges. Mark only the edge that returns to the start of a loop`);
    }
    const state = new Map(), backPairs = new Set();
    const dfs = (u) => {
        state.set(u, 1);
        for (const v of must(rest.get(u))) {
            if (state.get(v) === 1)
                backPairs.add(`${u}\u0000${v}`);
            else if (!state.get(v))
                dfs(v);
        }
        state.set(u, 2);
    };
    const known = new Set(nodes.map(n => n.id));
    for (const s of [...start.filter(s => known.has(s)), ...nodes.map(n => n.id)])
        if (!state.get(s))
            dfs(s);
    const out = new Set(decl);
    edges.forEach((e, i) => { if (e.from !== e.to && !decl.has(i) && backPairs.has(`${e.from}\u0000${e.to}`))
        out.add(i); });
    return out;
}
/**
 * Brandes-Köpf coordinates for one connected component: rows of slot ids in order, `succ` / `pred` the links to the next / previous
 * row. Four alignments (each long edge or chain lined up with its median neighbour, long edges between dummies first), each packed
 * to the left or to the right, then the average of the two middle values per node. Returns the centre of each slot across the rows
 * (any origin; the caller sets the range down).
 */
function brandesKoepf(rows, succ, pred, width, gap, dummy) {
    const ids = rows.flat(), layouts = [];
    for (const up of [false, true])
        for (const right of [false, true]) {
            const view = (up ? [...rows].reverse() : rows).map(r => right ? [...r].reverse() : r);
            const prev = up ? succ : pred; // the neighbours in the row before, in this view
            const pos = new Map(), rowOf = new Map();
            for (const r of view)
                r.forEach((id, i) => { pos.set(id, i); rowOf.set(id, r); });
            const before = (v) => [...must(prev.get(v))].sort((a, b) => must(pos.get(a)) - must(pos.get(b)));
            // 1. a segment that crosses an inner one (dummy to dummy) never gets aligned
            const conflict = new Set();
            for (let i = 0; i + 1 < view.length; i++) {
                const high = must(view[i]), low = must(view[i + 1]); // i + 1 < view.length
                let k0 = 0, l = 0;
                for (let l1 = 0; l1 < low.length; l1++) {
                    const lowId = must(low[l1]);
                    const inner = dummy(lowId) ? must(prev.get(lowId)).find(dummy) : undefined;
                    if (l1 === low.length - 1 || inner !== undefined) {
                        const k1 = inner !== undefined ? must(pos.get(inner)) : high.length - 1;
                        for (; l <= l1; l++) {
                            const lid = must(low[l]);
                            for (const u of must(prev.get(lid))) {
                                const k = must(pos.get(u));
                                if (k < k0 || k > k1)
                                    conflict.add(`${u}\u0000${lid}`);
                            }
                        }
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
                    if (!d)
                        continue;
                    for (const m of d % 2 ? [must(ns[(d - 1) / 2])] : [must(ns[d / 2 - 1]), must(ns[d / 2])]) {
                        if (align.get(v) === v && !conflict.has(`${m}\u0000${v}`) && last < must(pos.get(m))) {
                            align.set(m, v);
                            root.set(v, must(root.get(m)));
                            align.set(v, must(root.get(v)));
                            last = must(pos.get(m));
                        }
                    }
                }
            }
            // 3. horizontal compaction of the blocks (a block is a chain of aligned slots: one x)
            const sink = new Map(ids.map(id => [id, id])), shift = new Map(ids.map(id => [id, Infinity])), x = new Map();
            const placeBlock = (v) => {
                if (x.has(v))
                    return;
                x.set(v, 0);
                let w = v;
                do {
                    const i = must(pos.get(w));
                    if (i > 0) {
                        const p = must(must(rowOf.get(w))[i - 1]), u = must(root.get(p)), d = (width(p) + width(w)) / 2 + gap;
                        placeBlock(u);
                        if (sink.get(v) === v)
                            sink.set(v, must(sink.get(u)));
                        if (sink.get(v) !== sink.get(u))
                            shift.set(must(sink.get(u)), Math.min(must(shift.get(must(sink.get(u)))), must(x.get(v)) - must(x.get(u)) - d));
                        else
                            x.set(v, Math.max(must(x.get(v)), must(x.get(u)) + d));
                    }
                    w = must(align.get(w));
                } while (w !== v);
            };
            for (const id of ids)
                if (root.get(id) === id)
                    placeBlock(id);
            const out = new Map();
            for (const id of ids) {
                const rt = must(root.get(id)), sh = must(shift.get(must(sink.get(rt))));
                out.set(id, (must(x.get(rt)) + (sh < Infinity ? sh : 0)) * (right ? -1 : 1));
            }
            layouts.push(out);
        }
    // line the four up on the narrowest (the left ones by their left end, the right ones by their right end), then take the middle two
    const lo = (m) => Math.min(...ids.map(id => must(m.get(id)) - width(id) / 2)), hi = (m) => Math.max(...ids.map(id => must(m.get(id)) + width(id) / 2));
    const narrow = layouts.reduce((a, b) => hi(b) - lo(b) < hi(a) - lo(a) ? b : a);
    const aligned = layouts.map((m, k) => { const d = k % 2 === 0 ? lo(narrow) - lo(m) : hi(narrow) - hi(m); return new Map(ids.map(id => [id, must(m.get(id)) + d])); });
    const result = new Map();
    for (const id of ids) {
        const v = aligned.map(m => must(m.get(id))).sort((a, b) => a - b);
        result.set(id, (must(v[1]) + must(v[2])) / 2);
    }
    // averaging can leave two neighbours closer than they may be: push them apart, left to right
    for (const r of rows)
        for (let i = 1; i < r.length; i++) {
            const cur = must(r[i]), prv = must(r[i - 1]);
            result.set(cur, Math.max(must(result.get(cur)), must(result.get(prv)) + (width(prv) + width(cur)) / 2 + gap));
        }
    return result;
}
/**
 * Layers by longest path after breaking cycles (a DFS back edge is reversed for layering, and drawn from its real tail).
 * Nodes keep input order inside a layer until barycentre sweeps cut crossings; an edge that skips layers goes through a
 * dummy slot per layer so it does not run over the nodes in between. `start` ids (the entry states) are pinned to layer 0.
 */
export function layoutLayered(nodes, edges, opts = {}) {
    const dir = opts.dir ?? 'right', gap = opts.gap ?? GAP, levelGap = opts.levelGap ?? LEVEL_GAP * 1.5, sweeps = opts.sweeps ?? 4;
    const ids = new Set();
    for (const n of nodes)
        dupCheck(ids, n.id);
    for (const e of edges)
        for (const id of [e.from, e.to])
            if (!ids.has(id))
                throw new Error(`graph layout: edge ${e.from} -> ${e.to} names unknown node "${id}"`);
    const order = new Map(nodes.map((n, i) => [n.id, i]));
    const across = (s) => dir === 'down' ? s.w : s.h, along = (s) => dir === 'down' ? s.h : s.w;
    // 1. break cycles: edges declared as returns first, then a DFS (from the start nodes, then the rest in input order) over the others
    const reversedAt = breakCycles(nodes, edges, opts.back ?? [], opts.start);
    const starts = (opts.start ?? []).filter(s => ids.has(s));
    const dag = edges.map((e, index) => ({ e, index })).filter(({ e }) => e.from !== e.to).map(({ e, index }) => reversedAt.has(index) ? { a: e.to, b: e.from, e, index, rev: true } : { a: e.from, b: e.to, e, index, rev: false });
    // 2. longest-path layering (a start node stays on layer 0)
    const layer = new Map(), preds = new Map(nodes.map(n => [n.id, []]));
    for (const d of dag)
        must(preds.get(d.b)).push(d.a);
    const depth = (u, trail) => {
        if (layer.has(u))
            return must(layer.get(u));
        if (starts.includes(u) && !must(preds.get(u)).length) {
            layer.set(u, 0);
            return 0;
        } // a start with an edge into it is placed by that edge
        if (trail.has(u))
            return 0;
        trail.add(u);
        const l = must(preds.get(u)).reduce((m, p) => Math.max(m, depth(p, trail) + 1), 0);
        trail.delete(u);
        layer.set(u, l);
        return l;
    };
    for (const n of nodes)
        depth(n.id, new Set());
    if (opts.tighten) {
        // a node with edges only going out moves up to its nearest target - 1 (one pass: a mover has no edge into it, so no layer it reads moves)
        const nearest = new Map();
        for (const d of dag)
            nearest.set(d.a, Math.min(nearest.get(d.a) ?? Infinity, must(layer.get(d.b))));
        for (const [u, l] of nearest)
            if (!must(preds.get(u)).length && !starts.includes(u) && l - 1 > must(layer.get(u)))
                layer.set(u, l - 1);
    }
    if (opts.alap) {
        const keep = new Set([...opts.alap.keep, ...starts]), movers = new Set(), succs = new Map(nodes.map(n => [n.id, []]));
        for (const d of dag)
            must(succs.get(d.a)).push(d.b);
        // the input side, from the first layer on (a node's predecessors lie on lower layers): all of a node's in-edges come from the input side
        const byLayer = [...layer.keys()].sort((p, q) => must(layer.get(p)) - must(layer.get(q)));
        for (const u of byLayer)
            if (!keep.has(u) && must(preds.get(u)).every(p => movers.has(p)))
                movers.add(u);
        // then from the last layer back, so a mover's targets (movers too) have already moved
        for (const u of [...byLayer].reverse()) {
            const ts = must(succs.get(u));
            if (!movers.has(u) || !ts.length)
                continue;
            const l = Math.min(...ts.map(t => must(layer.get(t)))) - 1;
            if (l > must(layer.get(u)))
                layer.set(u, l);
        }
    }
    // 2b. fold: a layer wider than `fold` becomes rows, each its own layer (ADR 0010 D7). The order is not known yet, so the nodes go to the rows in input order.
    const folded = opts.fold === undefined ? [] : foldLayers();
    function foldLayers() {
        const limit = must(opts.fold), nOld = Math.max(0, ...layer.values()) + 1;
        const outerEdge = (d) => !!opts.outer && d.rev && Math.abs(must(layer.get(d.b)) - must(layer.get(d.a))) >= 2 && (opts.outer.which === 'all' || (opts.back ?? []).includes(d.index));
        const through = dag.filter(d => must(layer.get(d.a)) !== must(layer.get(d.b)) && !outerEdge(d)); // the edges that get dummies
        const skips = Array.from({ length: nOld }, () => 0); // dummies of the arrows that pass over a whole layer: in every row of it
        const inOf = new Map(), outOf = new Map(); // edges that begin / end at a node and go to another layer
        for (const d of through) {
            for (let l = must(layer.get(d.a)) + 1; l < must(layer.get(d.b)); l++)
                skips[l] = must(skips[l]) + 1;
            outOf.set(d.a, (outOf.get(d.a) ?? 0) + 1);
            inOf.set(d.b, (inOf.get(d.b) ?? 0) + 1);
        }
        const members = Array.from({ length: nOld }, () => []);
        for (const n of nodes)
            must(members[must(layer.get(n.id))]).push(n);
        const used = (ns, dummies) => ns.reduce((t, n) => t + across(n.size), 0) + gap * (Math.max(0, ns.length - 1) + dummies);
        const rowsOf = [];
        const cut = [];
        members.forEach((ns, l) => {
            const skip = skips[l] ?? 0;
            if (ns.length < 2 || used(ns, skip) <= limit) {
                rowsOf.push([ns]);
                return;
            }
            // The dummies of a row depend on the cut: an arrow into a node of a later row passes the rows before it, an arrow out of a node of an earlier row the rows after it.
            // So the cut is made, the dummies counted, and made again with those counted, until every row fits (the counts only grow).
            let extra = [], rows = [];
            for (let round = 0; round <= ns.length * 2; round++) {
                rows = [[]];
                for (const n of ns) {
                    const cur = must(rows[rows.length - 1]);
                    if (cur.length && used([...cur, n], skip + (extra[rows.length - 1] ?? 0)) > limit)
                        rows.push([n]);
                    else
                        cur.push(n);
                }
                const counted = rows.map(() => 0);
                rows.forEach((r, k) => { for (const n of r) {
                    for (let j = 0; j < k; j++)
                        counted[j] = (counted[j] ?? 0) + (inOf.get(n.id) ?? 0);
                    for (let j = k + 1; j < rows.length; j++)
                        counted[j] = (counted[j] ?? 0) + (outOf.get(n.id) ?? 0);
                } });
                if (rows.every((r, k) => r.length < 2 || used(r, skip + (counted[k] ?? 0)) <= limit))
                    break;
                extra = counted.map((c, k) => Math.max(c, extra[k] ?? 0));
            }
            rowsOf.push(rows);
            cut.push({ layer: l, rows: rows.length });
        });
        if (!cut.length)
            return cut;
        let base = 0;
        rowsOf.forEach(rows => { rows.forEach((r, k) => { for (const n of r)
            layer.set(n.id, base + k); }); base += rows.length; });
        return cut;
    }
    const slots = new Map(nodes.map(n => [n.id, { id: n.id, real: true, size: n.size, layer: must(layer.get(n.id)) }]));
    const chains = [];
    const declaredSet = new Set(opts.back ?? []);
    const succ = new Map(), pred = new Map();
    for (const s of slots.keys()) {
        succ.set(s, []);
        pred.set(s, []);
    }
    const link = (a, b) => { must(succ.get(a)).push(b); must(pred.get(b)).push(a); };
    dag.forEach((d, i) => {
        const la = must(layer.get(d.a)), lb = must(layer.get(d.b));
        const chain = [d.a];
        // longest-path layering puts the head of every edge below its tail, so ends on one layer cannot happen; kept straight if it ever does
        const to = d.b, step = lb >= la ? 1 : -1;
        if (la === lb) {
            chain.push(d.b);
            chains.push({ e: d.e, index: d.index, ids: chain, rev: d.rev });
            return;
        }
        // a return two layers or more long that runs outside the figure: no dummies, so it neither crosses the layers it skips nor widens them
        if (opts.outer && d.rev && Math.abs(lb - la) >= 2 && (opts.outer.which === 'all' || declaredSet.has(d.index))) {
            chains.push({ e: d.e, index: d.index, ids: [d.a, d.b], rev: true, outer: true });
            return;
        }
        for (let l = la + step; l !== lb; l += step) {
            const id = `\u0000d${i}.${l}`;
            slots.set(id, { id, real: false, size: { w: 1, h: 1 }, layer: l });
            succ.set(id, []);
            pred.set(id, []);
            chain.push(id);
        }
        chain.push(to);
        chains.push({ e: d.e, index: d.index, ids: chain, rev: d.rev });
        // links always run from the lower layer to the higher one
        const asc = la < lb ? chain : [...chain].reverse();
        for (let k = 0; k + 1 < asc.length; k++)
            link(must(asc[k]), must(asc[k + 1]));
    });
    const nLayers = Math.max(0, ...[...slots.values()].map(s => s.layer)) + 1;
    const rank = (id) => id.startsWith('\u0000') ? 1e6 + (order.get(id) ?? 0) : order.get(id) ?? 0;
    // connected components of the slot graph, numbered by the earliest node written: with coord 'bk' each stays together in a row and is placed on its own (D8)
    const parent = new Map([...slots.keys()].map(k => [k, k]));
    const find = (a) => { while (parent.get(a) !== a) {
        parent.set(a, must(parent.get(must(parent.get(a)))));
        a = must(parent.get(a));
    } return a; };
    for (const [a, bs] of succ)
        for (const b of bs)
            parent.set(find(a), find(b));
    const byRank = [...slots.values()].sort((p, q) => rank(p.id) - rank(q.id) || (p.id < q.id ? -1 : 1));
    const compIdx = new Map(), compOfRoot = new Map();
    for (const sl of byRank) {
        const r = opts.coord === 'bk' ? find(sl.id) : ''; // the plain layout keeps one component: its sweeps and its settling are as they were
        if (!compOfRoot.has(r))
            compOfRoot.set(r, compOfRoot.size);
        compIdx.set(sl.id, must(compOfRoot.get(r)));
    }
    const nComp = compOfRoot.size;
    const rows = Array.from({ length: nLayers }, () => []);
    const rowAt = (l) => must(rows[l]); // l < nLayers at every call
    for (const sl of [...byRank].sort((p, q) => must(compIdx.get(p.id)) - must(compIdx.get(q.id))))
        rowAt(sl.layer).push(sl.id); // stable: input order inside a component
    // 4. barycentre sweeps, down then up, keeping the order of nodes with no neighbour
    const pos = new Map();
    const reindex = () => rows.forEach(r => r.forEach((id, i) => pos.set(id, i)));
    reindex();
    const sortBy = (r, nb) => {
        const key = new Map(r.map((id, i) => {
            const ns = must(nb.get(id));
            return [id, ns.length ? ns.reduce((s, n) => s + must(pos.get(n)), 0) / ns.length : i];
        }));
        r.sort((a, b) => must(compIdx.get(a)) - must(compIdx.get(b)) || must(key.get(a)) - must(key.get(b)) || must(pos.get(a)) - must(pos.get(b)));
        r.forEach((id, i) => pos.set(id, i));
    };
    // crossings of the links between layer l and l + 1 (two links cross when their ends are in opposite orders)
    const crossingsAt = (l) => {
        const ls = [];
        for (const u of rowAt(l))
            for (const v of must(succ.get(u)))
                ls.push([must(pos.get(u)), must(pos.get(v))]);
        let c = 0;
        for (const [i, a] of ls.entries())
            for (const b of ls.slice(i + 1))
                if ((a[0] - b[0]) * (a[1] - b[1]) < 0)
                    c++;
        return c;
    };
    const allCrossings = () => { let c = 0; for (let l = 0; l + 1 < nLayers; l++)
        c += crossingsAt(l); return c; };
    let best = opts.transpose ? { rows: rows.map(r => [...r]), cross: allCrossings() } : undefined;
    for (let s = 0; s < sweeps; s++) {
        for (let l = 1; l < nLayers; l++)
            sortBy(rowAt(l), pred);
        for (let l = nLayers - 2; l >= 0; l--)
            sortBy(rowAt(l), succ);
        if (best) {
            const c = allCrossings();
            if (c < best.cross)
                best = { rows: rows.map(r => [...r]), cross: c };
        }
    }
    if (best) {
        best.rows.forEach((r, l) => rowAt(l).splice(0, rowAt(l).length, ...r));
        reindex();
        const local = (l) => (l > 0 ? crossingsAt(l - 1) : 0) + (l + 1 < nLayers ? crossingsAt(l) : 0);
        for (let pass = 0, improved = true; improved && pass < 20; pass++) {
            improved = false;
            for (let l = 0; l < nLayers; l++)
                for (let i = 0; i + 1 < rowAt(l).length; i++) {
                    const before = local(l), r = rowAt(l);
                    const ri = must(r[i]), rj = must(r[i + 1]);
                    if (compIdx.get(ri) !== compIdx.get(rj))
                        continue;
                    r[i] = rj;
                    r[i + 1] = ri;
                    pos.set(rj, i);
                    pos.set(ri, i + 1);
                    if (local(l) < before)
                        improved = true;
                    else {
                        r[i] = ri;
                        r[i + 1] = rj;
                        pos.set(ri, i);
                        pos.set(rj, i + 1);
                    }
                }
        }
    }
    // 5. coordinates: layers along one axis, each layer centred on the widest, then relaxed toward the neighbours without overlap
    const thick = rows.map(r => Math.max(0, ...r.map(id => along(must(slots.get(id)).size))));
    const at = [];
    thick.reduce((a, t, i) => (at[i] = a, a + t + levelGap), 0);
    const cross = new Map(); // centre on the across axis
    const wOf = (id) => across(must(slots.get(id)).size);
    let packed = 0, hi = 0;
    for (let c = 0; c < nComp; c++) {
        const mine = rows.map(r => r.filter(id => compIdx.get(id) === c)), members = mine.flat();
        if (opts.coord === 'bk') {
            for (const [id, x] of brandesKoepf(mine, succ, pred, wOf, gap, id => !must(slots.get(id)).real))
                cross.set(id, x);
        }
        else {
            const extent = (r) => r.reduce((t, id, i) => t + wOf(id) + (i ? gap : 0), 0);
            const widest = Math.max(0, ...mine.map(extent));
            for (const r of mine) {
                let a = (widest - extent(r)) / 2;
                for (const id of r) {
                    const w = wOf(id);
                    cross.set(id, a + w / 2);
                    a += w + gap;
                }
            }
            const settle = (r, nb) => {
                const want = r.map(id => { const ns = must(nb.get(id)); return ns.length ? ns.reduce((t, n) => t + must(cross.get(n)), 0) / ns.length : must(cross.get(id)); });
                // left to right push-apart, then right to left, so the result is the closest non-overlapping arrangement to `want`
                const w = r.map(wOf);
                const cs = want.slice();
                // cs, w and want all have one entry per node of r, so every index below is in range
                for (let i = 1; i < r.length; i++)
                    cs[i] = Math.max(must(cs[i]), must(cs[i - 1]) + (must(w[i - 1]) + must(w[i])) / 2 + gap);
                const shift = (want.reduce((t, v, i) => t + v - must(cs[i]), 0)) / Math.max(1, r.length);
                for (let i = 0; i < r.length; i++)
                    cs[i] = must(cs[i]) + shift;
                for (let i = 1; i < r.length; i++)
                    cs[i] = Math.max(must(cs[i]), must(cs[i - 1]) + (must(w[i - 1]) + must(w[i])) / 2 + gap);
                r.forEach((id, i) => cross.set(id, must(cs[i])));
            };
            // the rows of one component only: the average shift of a row must not be pulled by a node of another component
            for (let t = 0; t < 3; t++) {
                for (let l = 1; l < nLayers; l++)
                    settle(must(mine[l]), pred);
                for (let l = nLayers - 2; l >= 0; l--)
                    settle(must(mine[l]), succ);
            }
        }
        // the component's own range, set down after the previous one (the first starts at 0)
        const lo = Math.min(...members.map(id => must(cross.get(id)) - wOf(id) / 2));
        for (const id of members)
            cross.set(id, must(cross.get(id)) - lo + packed);
        packed = Math.max(...members.map(id => must(cross.get(id)) + wOf(id) / 2)) + gap;
        hi = packed - gap;
    }
    // outer lanes: past the boxes on the across side the return is assigned to (far = the high side; near = the side its ends are nearer to), the shortest return nearest
    const laneOf = new Map();
    const outers = chains.filter(c => c.outer).sort((p, q) => Math.abs(must(layer.get(p.e.from)) - must(layer.get(p.e.to))) - Math.abs(must(layer.get(q.e.from)) - must(layer.get(q.e.to))) || p.index - q.index);
    const lowSide = (c) => must(opts.outer).side === 'low' || (must(opts.outer).side === 'near' && (must(cross.get(c.e.from)) + must(cross.get(c.e.to))) / 2 < hi / 2);
    const lows = outers.filter(lowSide), highs = outers.filter(c => !lowSide(c));
    const lowShift = lows.length ? must(opts.outer).gap + (lows.length - 1) * must(opts.outer).step + 2 : 0; // the figure moves over by what the low lanes take
    lows.forEach((c, k) => laneOf.set(c.e, lowShift - must(opts.outer).gap - k * must(opts.outer).step));
    highs.forEach((c, k) => laneOf.set(c.e, lowShift + hi + must(opts.outer).gap + k * must(opts.outer).step));
    hi = lowShift + hi + (highs.length ? must(opts.outer).gap + (highs.length - 1) * must(opts.outer).step + 2 : 0);
    const centre = (id) => {
        const s = must(slots.get(id)), a = must(at[s.layer]) + must(thick[s.layer]) / 2, c = must(cross.get(id)) + lowShift;
        return dir === 'down' ? { x: c, y: a } : { x: a, y: c };
    };
    const placed = new Map();
    for (const n of nodes) {
        const p = centre(n.id);
        placed.set(n.id, { x: p.x - n.size.w / 2, y: p.y - n.size.h / 2, ...n.size });
    }
    const edgesOut = [];
    edges.forEach((e, index) => { if (e.from === e.to)
        edgesOut.push({ from: e.from, to: e.to, index, points: [centre(e.from)], reversed: false, self: true }); });
    for (const c of chains) {
        if (c.outer) {
            const a = centre(c.e.from), b = centre(c.e.to), lane = must(laneOf.get(c.e));
            const at2 = (p, d) => dir === 'down' ? { x: lane, y: p.y + d } : { x: p.x + d, y: lane };
            edgesOut.push({ from: c.e.from, to: c.e.to, index: c.index, points: [a, at2(a, -1), at2(b, 1), b], reversed: true, self: false, outer: true });
            continue;
        }
        // the chain runs in layering order; a reversed edge's real direction is the other way
        const pts = (c.rev ? [...c.ids].reverse() : c.ids).map(centre);
        edgesOut.push({ from: c.e.from, to: c.e.to, index: c.index, points: pts, reversed: c.rev, self: false });
    }
    const total = must(at[nLayers - 1]) + must(thick[nLayers - 1]);
    return { nodes: placed, edges: edgesOut, layers: layer, w: dir === 'down' ? hi : total, h: dir === 'down' ? total : hi, ...(folded.length ? { folded } : {}) };
}
