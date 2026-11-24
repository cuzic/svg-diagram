import {resolveAnchor} from './anchor-scope.ts';
import {appendPlacedBand, originOf} from './layout-placed.ts';
import {restoreCtx, snapshotCtx} from './layout-ctx.ts';
import type {LayoutCtx} from './layout-ctx.ts';
import {must} from './must.ts';
import {layoutTreeBand, treeItems} from './tree.ts';
import type {Rect} from './types/core.ts';
import type {LaidOutTree, TreeBand, TreeItem} from './types/diagrams.ts';
import type {Band, LaidOutBand} from './types/index.ts';

// A tree whose nodes are bands (ADR 0049): each band is measured once per width (laid out, then taken back), the tree is placed from those sizes, and
// every band is laid out for real inside its node's rectangle.
function measureBandHeight(ctx: LayoutCtx, band: Band, w: number): number {
  const before = snapshotCtx(ctx);
  try {
    ctx.y = 0;
    ctx.stack([band], 0, w);
    return Math.max(0, ctx.y - ctx.d.gap); // every handler leaves the cursor one gap below what it placed (a raw() of height 0 leaves none: clamped)
  } finally { restoreCtx(ctx, before); }
}
/** A band node is laid out on the grid like any band: its rectangle (and the ends of the lines that reach it) move to where the band will really sit. */
function snapBandNodes(placed: LaidOutTree, band: TreeBand): void {
  treeItems(band.root).forEach((n, i) => {
    const node = placed.nodes[i];
    if (!n.band || !node) return;
    const dy = originOf(n.band.type, node.y) - node.y;
    if (dy === 0) return;
    const touches = (p: {x: number; y: number}, o: {x: number; y: number; w: number; h: number}): boolean => p.y >= o.y - 0.5 && p.y <= o.y + o.h + 0.5 && p.x >= o.x - 0.5 && p.x <= o.x + o.w + 0.5;
    const on = (p: {x: number; y: number}): boolean => p.y >= node.y - 0.5 && p.y <= node.y + node.h + 0.5 && (Math.abs(p.x - node.x) < 0.5 || Math.abs(p.x - node.x - node.w) < 0.5 || (p.x >= node.x - 0.5 && p.x <= node.x + node.w + 0.5 && (Math.abs(p.y - node.y) < 0.5 || Math.abs(p.y - node.y - node.h) < 0.5)));
    const mid = node.y + node.h / 2;
    for (const e of placed.edges) {
      const pts = e.points, last = pts.length - 1;
      for (const [k, next] of [[0, 1], [last, last - 1]] as const) {
        const p = must(pts[k]), q = pts[next];
        if (!on(p)) continue;
        // a horizontal leg stays horizontal; a line of two points keeps the end that sits on another node, but moves one that ends on a `{` or a spine
        if (q && q.y === p.y && (pts.length > 2 || !placed.nodes.some(o => o !== node && touches(q, o)))) q.y += dy;
        p.y += dy;
      }
    }
    for (const br of placed.braces ?? []) { // a `{` reaches the middle of its children's sides: its end moves with the child
      if (Math.abs(br.y1 - mid) <= 3) br.y1 += dy;
      if (Math.abs(br.y2 - mid) <= 3) br.y2 += dy;
    }
    node.y += dy;
    const anchor = placed.anchors.find((a: {id: string}) => a.id === n.id);
    if (anchor && n.id) anchor.y += dy;
  });
}
export function layoutTree(band: TreeBand, ctx: LayoutCtx, padX: number, cw: number): void {
  const placed = layoutTreeBand(band, padX, originOf(band.type, ctx.y), cw, ctx.widthOf, ctx.roles, ctx,
    ctx.d.canvas?.height ?? ctx.d.maxDisplayHeight, (b, bw) => measureBandHeight(ctx, b, bw));
  snapBandNodes(placed, band);
  appendPlacedBand(band, placed, ctx, 'a tree takes an id that another anchor already has', 'a tree node takes an id that another anchor already has');
  const items = treeItems(band.root);
  if (!items.some(n => n.band)) return;
  const after = ctx.y;
  const first = new Map<TreeItem, LaidOutBand | undefined>(); // what each band node put down first: its own figure (a group's frame comes before what is inside it)
  items.forEach((n, i) => {
    const node = placed.nodes[i];
    if (!n.band || !node) return;
    ctx.y = node.y;
    const n0 = ctx.laidOut.length;
    ctx.stack([n.band], node.x, node.w);
    first.set(n, ctx.laidOut[n0]);
  });
  ctx.y = after;
  funnelEdges(band, placed, items, first, ctx);
}
/** The two end points of the side of a shape that faces `dir` ('bottom' / 'top'): the corners of the drawn polygons when the shape is a flow shape (a chevron's side stops short of its point), else the rectangle's. */
function facingEnds(rect: Rect, polygons: [number, number][][], dir: 'bottom' | 'top'): [{x: number; y: number}, {x: number; y: number}] {
  const pts = polygons.flat();
  if (!pts.length) { const y = dir === 'bottom' ? rect.y + rect.h : rect.y; return [{x: rect.x, y}, {x: rect.x + rect.w, y}]; }
  const edge = dir === 'bottom' ? Math.max(...pts.map(p => p[1])) : Math.min(...pts.map(p => p[1])), onEdge = pts.filter(p => Math.abs(p[1] - edge) < 0.5);
  return [{x: Math.min(...onEdge.map(p => p[0])), y: edge}, {x: Math.max(...onEdge.map(p => p[0])), y: edge}];
}
const polygonsOf = (b: LaidOutBand | undefined): [number, number][][] => ((b as {primitives?: {k: string; points?: [number, number][]}[]} | undefined)?.primitives ?? []).flatMap(pr => pr.k === 'polygon' && pr.points ? [pr.points] : []);
const polygonsIn = (ctx: LayoutCtx, within: (pts: [number, number][]) => boolean, node?: (id: string | undefined) => boolean): [number, number][][] =>
  ctx.laidOut.flatMap(b => ((b as {primitives?: {k: string; points?: [number, number][]; node?: string}[]}).primitives ?? []).flatMap(pr => pr.k === 'polygon' && pr.points && within(pr.points) && (!node || node(pr.node)) ? [pr.points] : []));
/** A child with `from` is joined from a part inside its parent's band (known only now that the bands are placed): from the near side of that part (starting at the edge of the parent's band) to the near side of the child, as two lines (a funnel). */
function funnelEdges(tree: TreeBand, placed: LaidOutTree, items: TreeItem[], first: Map<TreeItem, LaidOutBand | undefined>, ctx: LayoutCtx): void {
  if (!items.some(n => n.from !== undefined)) return;
  const kind = tree.balanced ? tree.layout ?? 'radial' : tree.dir === 'right' ? 'right' : 'down'; // (a tree whose direction was left to the layout is judged by where the child landed)
  if (!['down', 'up', 'org'].includes(kind)) throw new Error(`tree(): from draws a funnel to a child under (or over) its parent's band; ${tree.balanced ? `this mindmap's layout is '${kind}'` : "this tree grows to the right"} (use dir: 'down'; a mindmap: layout 'down', 'up' or 'org')`);
  const parentOf = new Map<TreeItem, TreeItem>();
  for (const n of items) for (const c of n.children ?? []) parentOf.set(c, n);
  const rectOf = (n: TreeItem): Rect => must(placed.nodes[items.indexOf(n)]);
  const inside = (r: Rect, o: Rect): boolean => r.x >= o.x - 0.5 && r.y >= o.y - 0.5 && r.x + r.w <= o.x + o.w + 0.5 && r.y + r.h <= o.y + o.h + 0.5;
  const treeIds = new Set(placed.anchors.map(a => a.id));
  items.forEach((child, i) => {
    if (child.from === undefined) return;
    const parent = must(parentOf.get(child)), pr = rectOf(parent), cr = rectOf(child);
    const below = cr.y >= pr.y + pr.h - 0.5, above = cr.y + cr.h <= pr.y + 0.5;
    if (!below && !above) throw new Error(`tree(): "${child.label}": from joins a child that lies below or above its parent's band, but this one is beside it (dir: 'right', a mindmap's radial / right / left / brace ...); use dir: 'down' (a mindmap: layout 'down', 'up' or 'org')`);
    const name = resolveAnchor(ctx.scopes, child.from, n => ctx.anchors.has(n)), part = name === undefined ? undefined : ctx.anchors.get(name);
    const bandId = (must(parent.band) as {id?: string}).id; // a name of the whole band (or of the tree node) is not a part of it
    if (!name || !part || !inside(part, pr) || treeIds.has(name) || name === bandId) {
      const ids = [...ctx.anchors].filter(([k, r]) => !treeIds.has(k) && k !== bandId && inside(r, pr)).map(([k]) => k);
      throw new Error(`tree(): "${child.label}": from "${child.from}" is not an id inside the band of "${parent.label}"${ids.length ? ` (ids there: ${ids.join(', ')})` : ' (that band declares no ids)'}`);
    }
    placed.edges = placed.edges.filter(e => e.child !== i);
    const partPolys = polygonsIn(ctx, pts => pts.every(p => p[0] >= part.x - 0.5 && p[0] <= part.x + part.w + 0.5 && p[1] >= part.y - 0.5 && p[1] <= part.y + part.h + 0.5), id => id !== undefined && (name === id || name.endsWith(`.${id}`)));
    const childPolys = polygonsOf(first.get(child)); // the child's own figure only: a chevron inside a group is not the group's edge
    const [pl, pRight] = facingEnds(part, partPolys, below ? 'bottom' : 'top'), [cl, cRight] = facingEnds(cr, childPolys, below ? 'top' : 'bottom');
    const y0 = below ? pr.y + pr.h : pr.y; // from the edge of the parent's band: a part inside it (a swimlane's step) does not draw a line across the parts below it
    const stage = Math.max((child.band as {reveal?: number}).reveal ?? 0, (must(parent.band) as {reveal?: number}).reveal ?? 0), untils = [(child.band as {until?: number}).until, (must(parent.band) as {until?: number}).until].filter((u): u is number => u !== undefined), until = untils.length ? Math.min(...untils) : undefined; // gone with the earlier of the two
    const own = {child: i, ...(stage > (placed.reveal ?? 0) ? {reveal: stage} : {}), ...(until === undefined ? {} : {until})};
    placed.edges.push({points: [{x: pl.x, y: y0}, cl], ...own}, {points: [{x: pRight.x, y: y0}, cRight], ...own});
  });
}
