// ADR 0076 spike (round 2): comic symbols (manpu) and props, anchored to the geometry map of ADR 0074, with a collision check.
// Not part of lib/. It imports the ADR 0074 prototype unchanged and adds a layer on top of its Geometry.
// Placement depends only on the geometry (which never depends on slot values), so it is value-independent by construction.
import type {Geometry, Rect} from '../comic-worksheet/proto.ts';

export type ManpuKind = 'sweat' | 'anger' | 'sparkle' | 'question' | 'exclaim' | 'heart' | 'sigh' | 'idea' | 'gloom' | 'zzz';
export type PropKind = 'pc' | 'coffee' | 'calendar' | 'clock' | 'documents' | 'phone';
export type HeadAnchor = 'top-out' | 'top-in' | 'top' | 'side-out' | 'side-in';
export type PropAnchor = 'hand' | 'floor' | 'wall-out' | 'wall-in';
export type Pt = [number, number];
/** The tail as ADR 0074 U1 / ADR 0077 name it: two base points, a tip, and where it starts. The collision shape is the triangle base[0], tip, base[1]. */
export interface Tail {base: [Pt, Pt]; tip: Pt; from: Pt}
export interface ManpuSpec {kind: ManpuKind; on: string; at?: HeadAnchor; size?: 's' | 'm'}
export interface PropSpec {kind: PropKind; on: string; at?: PropAnchor}
export interface PanelExtras {panel: string; caption?: {w: number}; side: Record<string, 'left' | 'center' | 'right'>; manpu?: ManpuSpec[]; props?: PropSpec[]}
export interface Placed {id: string; kind: string; layer: 'manpu' | 'prop'; box: Rect; at: string; wanted: string; triedBefore: number; svg: string}
export interface ExtraFinding {rule: string; where: string; message: string}

const INK = '#222';
// 24px-box symbols, centred on (0,0). Pure paths, no <text>, no font.
const MANPU: Record<ManpuKind, {name: string; body: string; prefer: HeadAnchor[]}> = {
  sweat: {name: '汗', prefer: ['top-out', 'side-out', 'top'], body: `<path d="M0 -10C6 -2 8 2 8 5a8 8 0 0 1 -16 0C-8 2 -6 -2 0 -10z" fill="#bfe3ff" stroke="${INK}" stroke-width="1.5"/>`},
  anger: {name: '怒り', prefer: ['top-in', 'top', 'top-out'], body: `<path d="M-9 -3Q-3 -3 -3 -9M3 -9Q3 -3 9 -3M9 3Q3 3 3 9M-3 9Q-3 3 -9 3" fill="none" stroke="#c0392b" stroke-width="2.6" stroke-linecap="round"/>`},
  sparkle: {name: 'きらきら', prefer: ['top-out', 'top-in', 'side-out'], body: `<path d="M0 -11Q1.5 -1.5 11 0Q1.5 1.5 0 11Q-1.5 1.5 -11 0Q-1.5 -1.5 0 -11z" fill="#ffd54a" stroke="${INK}" stroke-width="1.5"/>`},
  question: {name: 'はてな', prefer: ['top-in', 'top', 'top-out'], body: `<path d="M-5 -6a5 5 0 1 1 8 4c-2 1.5 -3 2.5 -3 5" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="0" cy="9" r="1.8" fill="${INK}"/>`},
  exclaim: {name: 'びっくり', prefer: ['top-in', 'top', 'top-out'], body: `<path d="M0 -11V3" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="0" cy="9" r="2.2" fill="${INK}"/>`},
  heart: {name: 'ハート', prefer: ['top-out', 'top-in', 'side-out'], body: `<path d="M0 9C-14 -1 -8 -11 0 -4C8 -11 14 -1 0 9z" fill="#e86a8a" stroke="${INK}" stroke-width="1.5"/>`},
  sigh: {name: 'ため息', prefer: ['side-in', 'side-out', 'top-in'], body: `<path d="M-9 4a5 5 0 0 1 2 -9a6 6 0 0 1 11 -1a5 5 0 0 1 4 10z" fill="#fff" stroke="#5a6072" stroke-width="1.6"/>`},
  idea: {name: 'ひらめき', prefer: ['top', 'top-out', 'top-in'], body: `<circle cx="0" cy="-2" r="7" fill="#ffe680" stroke="${INK}" stroke-width="1.5"/><rect x="-3" y="5" width="6" height="4" fill="#999" stroke="${INK}" stroke-width="1"/><path d="M-11 -2h-2M11 -2h2M-8 -10l-1.5 -1.5M8 -10l1.5 -1.5" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>`},
  gloom: {name: '落ち込み', prefer: ['top', 'top-out', 'top-in'], body: `<path d="M-7 -10v14M-2.5 -10v18M2.5 -10v18M7 -10v14" stroke="#4a5a7a" stroke-width="2" stroke-linecap="round"/>`},
  zzz: {name: 'ぐうぐう', prefer: ['top-out', 'top-in', 'side-out'], body: `<path d="M-9 -9h9l-9 9h9M2 -2h6l-6 6h6" fill="none" stroke="#5a6072" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`},
};
// 40px-box props, centred on (0,0) (hand / wall) or bottom-centre on the floor anchor.
const PROP: Record<PropKind, {name: string; body: string}> = {
  pc: {name: 'パソコン', body: `<rect x="-16" y="-14" width="32" height="20" rx="2" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M-20 10h40l-3 -4h-34z" fill="#cfd6e4" stroke="${INK}" stroke-width="2"/>`},
  coffee: {name: 'コーヒー', body: `<path d="M-12 -4h22v10a8 8 0 0 1 -8 8h-6a8 8 0 0 1 -8 -8z" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M10 0h4a4 4 0 0 1 0 9h-4" fill="none" stroke="${INK}" stroke-width="2"/><path d="M-6 -8q-3 -4 0 -8M2 -8q-3 -4 0 -8" fill="none" stroke="#5a6072" stroke-width="1.5" stroke-linecap="round"/>`},
  calendar: {name: 'カレンダー', body: `<rect x="-16" y="-16" width="32" height="32" rx="3" fill="#fff" stroke="${INK}" stroke-width="2"/><rect x="-16" y="-16" width="32" height="9" fill="#c0392b" stroke="${INK}" stroke-width="2"/><path d="M-9 -1h4M-2 -1h4M5 -1h4M-9 7h4M-2 7h4" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`},
  clock: {name: '時計', body: `<circle cx="0" cy="0" r="16" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M0 -9V0l7 4" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>`},
  documents: {name: '書類', body: `<rect x="-12" y="-14" width="24" height="30" fill="#fff" stroke="${INK}" stroke-width="2" transform="rotate(-6)"/><rect x="-12" y="-14" width="24" height="30" fill="#fff" stroke="${INK}" stroke-width="2"/><path d="M-7 -6h14M-7 0h14M-7 6h9" stroke="#5a6072" stroke-width="1.8" stroke-linecap="round"/>`},
  phone: {name: 'スマホ', body: `<rect x="-9" y="-16" width="18" height="32" rx="3" fill="#2d3340" stroke="${INK}" stroke-width="2"/><rect x="-6" y="-11" width="12" height="20" fill="#bfe3ff"/>`},
};

const q4 = (n: number) => Math.round(n * 4) / 4; // every coordinate is a multiple of 1/4 px, so two engines cannot disagree on a digit
/** Head anchors: offsets from the head centre for the two mark sizes (d = r + 8 + half the size, then the 52 deg / 8 deg direction, rounded once, here). `in` mirrors x. */
const HEAD_OFFSET: Record<'s' | 'm', Record<'top-out' | 'top' | 'side-out', Pt>> = {s: {'top-out': [33, -43], top: [0, -54], 'side-out': [53, -8]}, m: {'top-out': [36, -46], top: [0, -58], 'side-out': [57, -8]}};
/** `out` is away from the panel centre; for a `center` character it is the right (`in` is the left). One convention for marks and props. */
const outSign = (side: 'left' | 'center' | 'right') => side === 'left' ? -1 : 1;
function headPoint(head: [number, number, number], side: 'left' | 'center' | 'right', a: HeadAnchor, size: 's' | 'm'): Pt {
  const base = a === 'top-in' ? 'top-out' : a === 'side-in' ? 'side-out' : a, [dx, dy] = HEAD_OFFSET[size][base], o = a.endsWith('-in') ? -outSign(side) : outSign(side);
  return [q4(head[0] + (dx === 0 ? 0 : o * dx)), q4(head[1] + dy)];
}
/** The tail of a bubble from the geometry map (the formula of the ADR 0074 prototype; U1 holds it as ComicLaidBubble.tail, which the placement should read instead). */
export function tailOf(geo: Geometry, bubble: string, speakerKey: string): Tail {
  const b = geo.bubbles[bubble]!, p = geo.points[speakerKey]!, m = p.mouth, [hx0, hy0, hr] = p.head;
  const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2, dx = m[0] - bcx, dy = m[1] - bcy, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  const hx = hx0 - bcx, hy = hy0 - bcy, proj = hx * ux + hy * uy, perp = Math.hypot(hx - proj * ux, hy - proj * uy);
  const tipT = proj - Math.sqrt(Math.max(hr * hr - perp * perp, 0)) - 6, tip: Pt = [q4(bcx + ux * tipT), q4(bcy + uy * tipT)];
  const edgeT = Math.min(b.w / 2 / Math.abs(ux || 1e-9), b.h / 2 / Math.abs(uy || 1e-9)), nx = -uy, ny = ux, mid: Pt = [bcx + ux * edgeT * 0.8, bcy + uy * edgeT * 0.8];
  return {base: [[q4(mid[0] + nx * 8), q4(mid[1] + ny * 8)], [q4(mid[0] - nx * 8), q4(mid[1] - ny * 8)]], tip, from: [q4(bcx), q4(bcy)]};
}
/** The polygon a tail occupies. Only this triangle and the bubble's bounding box are obstacles, so a balloon shape (ADR 0077) that keeps the same base / tip changes nothing here. */
export const tailPolygon = (t: Tail): [Pt, Pt, Pt] => [t.base[0], t.tip, t.base[1]];
const inflate = (r: Rect, m: number): Rect => ({x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m});
const rectsHit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const rectHitsCircle = (r: Rect, cx: number, cy: number, rr: number) => { const dx = Math.max(r.x - cx, 0, cx - (r.x + r.w)), dy = Math.max(r.y - cy, 0, cy - (r.y + r.h)); return dx * dx + dy * dy < rr * rr; };
const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const orient = (a: Pt, b: Pt, c: Pt) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
const segsCross = (p: Pt, q: Pt, r: Pt, s: Pt) => { const d1 = orient(p, q, r), d2 = orient(p, q, s), d3 = orient(r, s, p), d4 = orient(r, s, q); return d1 * d2 < 0 && d3 * d4 < 0; };
const inTriangle = (t: Pt[], x: number, y: number) => { const p: Pt = [x, y], d = [orient(t[0]!, t[1]!, p), orient(t[1]!, t[2]!, p), orient(t[2]!, t[0]!, p)]; return d.every(v => v >= 0) || d.every(v => v <= 0); };
/** Exact: a polygon vertex inside the rect, a rect corner inside the polygon, or an edge crossing an edge. */
export function rectHitsPolygon(r: Rect, poly: Pt[]): boolean {
  const corners: Pt[] = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  if (poly.some(p => inRect(r, p[0], p[1])) || corners.some(c => inTriangle(poly, c[0], c[1]))) return true;
  return poly.some((p, i) => corners.some((c, j) => segsCross(p, poly[(i + 1) % poly.length]!, c, corners[(j + 1) % 4]!)));
}

export interface Obstacles {bubbles: Rect[]; tails: Pt[][]; heads: [number, number, number][]; panel: Rect; placed: Rect[]}
/** Why a candidate box is rejected (empty: free). Margins: bubble 4, head 2, tail 2, other symbol 2, panel edge 8, number badge 24+4. */
export function hits(box: Rect, o: Obstacles): string[] {
  const why: string[] = [], inf = inflate(box, 2);
  if (box.x < o.panel.x + 8 || box.y < o.panel.y + 8 || box.x + box.w > o.panel.x + o.panel.w - 8 || box.y + box.h > o.panel.y + o.panel.h - 8) why.push('panel-edge');
  if (rectsHit(box, {x: o.panel.x, y: o.panel.y, w: 28, h: 28})) why.push('badge');
  if (o.bubbles.some(b => rectsHit(box, inflate(b, 4)))) why.push('bubble');
  if (o.tails.some(t => rectHitsPolygon(inf, t))) why.push('tail');
  if (o.heads.some(h => rectHitsCircle(box, h[0], h[1], h[2] + 2))) why.push('head');
  if (o.placed.some(p => rectsHit(inf, p))) why.push('symbol');
  return why;
}

export interface Layer {placed: Placed[]; findings: ExtraFinding[]; stats: {candidates: number; firstChoiceHits: number; resolved: number; unresolved: number}}
/** Place props first (scene objects, fewer candidates), then marks (decoration yields). Within a kind, in the order written.
 *  `nudge: false` tries only the first candidate (to count how often the first choice collides). */
export function placeExtras(geo: Geometry, panels: {id: string; lineSpeakers: string[]}[], extras: PanelExtras[], opts: {nudge: boolean} = {nudge: true}): Layer {
  const placed: Placed[] = [], findings: ExtraFinding[] = [], stats = {candidates: 0, firstChoiceHits: 0, resolved: 0, unresolved: 0};
  for (const ex of extras) {
    const panel = geo.panels[ex.panel]!, pk = panels.find(p => p.id === ex.panel)!;
    const keys = Object.keys(ex.side), heads = keys.map(k => geo.points[`${ex.panel}.${k}`]!.head);
    const bubbleKeys = Object.keys(geo.bubbles).filter(k => k.startsWith(`${ex.panel}.`));
    const tails = bubbleKeys.flatMap((k, i) => { const sp = pk.lineSpeakers[i]; return sp ? [tailPolygon(tailOf(geo, k, `${ex.panel}.${sp}`))] : []; });
    const obs: Obstacles = {bubbles: [...bubbleKeys.map(k => geo.bubbles[k]!), ...(ex.caption ? [{x: panel.x + 32, y: panel.y + 16, w: ex.caption.w, h: 28}] : [])], tails, heads, panel, placed: []}; // the caption box (ADR 0076 D3a) is an obstacle like a bubble (4px margin)
    const settle = (id: string, kind: string, layer: 'manpu' | 'prop', size: number, wanted: string, cands: {at: string; c: Pt}[], draw: (x: number, y: number) => string) => {
      let tried = 0, last: string[] = [];
      for (const cand of cands) {
        const box: Rect = {x: q4(cand.c[0] - size / 2), y: q4(cand.c[1] - size / 2), w: size, h: size};
        stats.candidates++; const why = hits(box, obs); last = why;
        if (!why.length) { if (tried > 0) stats.resolved++; obs.placed.push(box); placed.push({id, kind, layer, box, at: cand.at, wanted, triedBefore: tried, svg: draw(cand.c[0], cand.c[1])}); return; }
        if (tried === 0) stats.firstChoiceHits++;
        tried++; if (!opts.nudge) break;
      }
      stats.unresolved++; findings.push({rule: layer === 'manpu' ? 'comic-mark-no-room' : 'comic-prop-no-room', where: id, message: `${kind}: no free position (${last.join('+')}), tried ${tried}`});
    };
    const nth = new Map<string, number>(), next = (kind: string, on: string) => { const k = `${kind}:${on}`, n = (nth.get(k) ?? 0) + 1; nth.set(k, n); return n; }; // ids count per character, so adding a mark to another character renumbers nothing
    (ex.props ?? []).forEach(p => {
      const side = ex.side[p.on]!, head = geo.points[`${ex.panel}.${p.on}`]!.head, inn = -outSign(side), def = PROP[p.kind], id = `${ex.panel}.${p.on}.o${next('o', p.on)}`;
      const y = panel.y + panel.h - 30, all: Record<PropAnchor, Pt> = {hand: [head[0] + inn * 58, y], floor: [head[0] + inn * 108, y], 'wall-out': [head[0] - inn * 76, panel.y + 72], 'wall-in': [head[0] + inn * 76, panel.y + 72]};
      const order = [...new Set<PropAnchor>([p.at ?? 'hand', 'hand', 'floor', 'wall-out', 'wall-in'])];
      settle(id, p.kind, 'prop', 40, p.at ?? 'hand', order.map(a => ({at: a, c: all[a]})), (x, yy) => `<g data-prop="${id}" transform="translate(${x} ${yy})"><title>${def.name}</title>${def.body}</g>`);
    });
    (ex.manpu ?? []).forEach(m => {
      const side = ex.side[m.on]!, head = geo.points[`${ex.panel}.${m.on}`]!.head, sz = m.size ?? 'm', size = sz === 's' ? 20 : 28, def = MANPU[m.kind], id = `${ex.panel}.${m.on}.m${next('m', m.on)}`;
      const order = [...new Set([m.at, ...def.prefer, 'top', 'top-out', 'top-in', 'side-out', 'side-in'].filter(Boolean) as HeadAnchor[])];
      settle(id, m.kind, 'manpu', size, m.at ?? def.prefer[0]!, order.map(a => ({at: a, c: headPoint(head, side, a, sz)})), (x, y) => `<g data-manpu="${id}" transform="translate(${x} ${y}) scale(${Math.round(size / 24 * 100) / 100})" aria-hidden="true">${def.body}</g>`);
    });
  }
  return {placed, findings, stats};
}
export const MARK_PREFER = Object.fromEntries(Object.entries(MANPU).map(([k, v]) => [k, v.prefer])) as Record<ManpuKind, HeadAnchor[]>;
