// ADR 0076 spike: comic symbols (manpu) and props, anchored to the geometry map of ADR 0074, with a collision check.
// Not part of lib/. It imports the ADR 0074 prototype unchanged and adds a layer on top of its Geometry.
// Placement depends only on the geometry (which never depends on slot values), so it is value-independent by construction.
import type {Geometry, Rect} from '../comic-worksheet/proto.ts';

export type ManpuKind = 'sweat' | 'anger' | 'sparkle' | 'question' | 'exclaim' | 'heart' | 'sigh' | 'idea' | 'gloom' | 'zzz';
export type PropKind = 'pc' | 'coffee' | 'calendar' | 'clock' | 'documents' | 'phone';
export type HeadAnchor = 'top-out' | 'top-in' | 'top' | 'side-out' | 'side-in';
export type PropAnchor = 'hand' | 'floor' | 'wall-out' | 'wall-in';
export interface ManpuSpec {kind: ManpuKind; on: string; at?: HeadAnchor; size?: 's' | 'm'}
export interface PropSpec {kind: PropKind; on: string; at?: PropAnchor}
export interface PanelExtras {panel: string; side: Record<string, 'left' | 'center' | 'right'>; manpu?: ManpuSpec[]; props?: PropSpec[]}
export interface Placed {id: string; kind: string; layer: 'manpu' | 'prop'; box: Rect; at: string; triedBefore: number; svg: string}
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

const GAP = 8; // gap between head and symbol (head radius comes from the geometry map)
const PH = 300, PW = 420;
const f1 = (n: number) => Math.round(n * 10) / 10;
const rad = (deg: number) => deg * Math.PI / 180;

/** Head anchors on the head circle. `out` is the side away from the panel centre, `in` towards it. */
function headPoint(head: [number, number, number], side: 'left' | 'center' | 'right', a: HeadAnchor, half: number): [number, number] {
  const [cx, cy, r] = head, o = side === 'left' ? -1 : 1, d = r + GAP + half;
  const [deg, dir] = ({'top-out': [52, 1], 'top-in': [52, -1], top: [90, 0], 'side-out': [8, 1], 'side-in': [8, -1]} as const)[a];
  return [cx + o * dir * d * Math.cos(rad(deg)), cy - d * Math.sin(rad(deg))];
}
/** The tail triangle of a bubble (same formula as the ADR 0074 prototype; U1 should expose it as geometry.tails). */
export function tailPolygon(geo: Geometry, bubble: string, speakerKey: string): [number, number][] {
  const b = geo.bubbles[bubble]!, p = geo.points[speakerKey]!, m = p.mouth, [hx0, hy0, hr] = p.head;
  const bcx = b.x + b.w / 2, bcy = b.y + b.h / 2, dx = m[0] - bcx, dy = m[1] - bcy, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
  const hx = hx0 - bcx, hy = hy0 - bcy, proj = hx * ux + hy * uy, perp = Math.hypot(hx - proj * ux, hy - proj * uy);
  const tipT = proj - Math.sqrt(Math.max(hr * hr - perp * perp, 0)) - 6, tip: [number, number] = [bcx + ux * tipT, bcy + uy * tipT];
  const edgeT = Math.min(b.w / 2 / Math.abs(ux || 1e-9), b.h / 2 / Math.abs(uy || 1e-9)), nx = -uy, ny = ux, base = [bcx + ux * edgeT * 0.8, bcy + uy * edgeT * 0.8] as const;
  return [[base[0] + nx * 8, base[1] + ny * 8], tip, [base[0] - nx * 8, base[1] - ny * 8]];
}
const inflate = (r: Rect, m: number): Rect => ({x: r.x - m, y: r.y - m, w: r.w + 2 * m, h: r.h + 2 * m});
const rectsHit = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const rectHitsCircle = (r: Rect, cx: number, cy: number, rr: number) => { const dx = Math.max(r.x - cx, 0, cx - (r.x + r.w)), dy = Math.max(r.y - cy, 0, cy - (r.y + r.h)); return dx * dx + dy * dy < rr * rr; };
const inRect = (r: Rect, x: number, y: number) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
function rectHitsPolygon(r: Rect, poly: [number, number][]): boolean {
  for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i]!, [x1, y1] = poly[(i + 1) % poly.length]!; for (let t = 0; t <= 16; t++) if (inRect(r, x0 + (x1 - x0) * t / 16, y0 + (y1 - y0) * t / 16)) return true; }
  const [cx, cy] = [r.x + r.w / 2, r.y + r.h / 2]; // the rect lies wholly inside the triangle
  const [a, b, c] = poly as [[number, number], [number, number], [number, number]]; const s = (p: number[], q: number[], x: number, y: number) => (q[0]! - p[0]!) * (y - p[1]!) - (q[1]! - p[1]!) * (x - p[0]!);
  const d = [s(a, b, cx, cy), s(b, c, cx, cy), s(c, a, cx, cy)]; return d.every(v => v >= 0) || d.every(v => v <= 0);
}

export interface Obstacles {bubbles: Rect[]; tails: [number, number][][]; heads: [number, number, number][]; panel: Rect; placed: Rect[]}
/** Why a candidate box is rejected (empty: free). Margins: bubble 4, head 2, tail 2, other symbol 2, panel edge 8, number badge 24+4. */
export function hits(box: Rect, o: Obstacles, ignoreHead?: number): string[] {
  const why: string[] = [], inf = inflate(box, 2);
  if (box.x < o.panel.x + 8 || box.y < o.panel.y + 8 || box.x + box.w > o.panel.x + o.panel.w - 8 || box.y + box.h > o.panel.y + o.panel.h - 8) why.push('panel-edge');
  if (rectsHit(box, {x: o.panel.x, y: o.panel.y, w: 28, h: 28})) why.push('badge');
  if (o.bubbles.some(b => rectsHit(box, inflate(b, 4)))) why.push('bubble');
  if (o.tails.some(t => rectHitsPolygon(inf, t))) why.push('tail');
  if (o.heads.some((h, i) => i !== ignoreHead && rectHitsCircle(box, h[0], h[1], h[2] + 2))) why.push('head');
  if (o.placed.some(p => rectsHit(inf, p))) why.push('symbol');
  return why;
}

export interface Layer {placed: Placed[]; findings: ExtraFinding[]; stats: {candidates: number; firstChoiceHits: number; resolved: number; unresolved: number}}
/** Place manpu and props. `nudge: false` tries only the first candidate (to count how often the first choice collides). */
export function placeExtras(geo: Geometry, panels: {id: string; lineSpeakers: string[]}[], extras: PanelExtras[], opts: {nudge: boolean} = {nudge: true}): Layer {
  const placed: Placed[] = [], findings: ExtraFinding[] = [], stats = {candidates: 0, firstChoiceHits: 0, resolved: 0, unresolved: 0};
  for (const ex of extras) {
    const panel = geo.panels[ex.panel]!, pk = panels.find(p => p.id === ex.panel)!;
    const keys = Object.keys(ex.side), heads = keys.map(k => geo.points[`${ex.panel}.${k}`]!.head);
    const bubbles = Object.entries(geo.bubbles).filter(([k]) => k.startsWith(`${ex.panel}.`)).map(([, r]) => r);
    const tails = Object.keys(geo.bubbles).filter(k => k.startsWith(`${ex.panel}.`)).flatMap((k, i) => { const sp = pk.lineSpeakers[i]; return sp ? [tailPolygon(geo, k, `${ex.panel}.${sp}`)] : []; });
    const obs: Obstacles = {bubbles, tails, heads, panel, placed: []};
    const settle = (id: string, kind: string, layer: 'manpu' | 'prop', size: number, cands: {at: string; c: [number, number]}[], draw: (x: number, y: number) => string, ignoreHead?: number) => {
      let tried = 0, last: string[] = [];
      for (const cand of cands) {
        const box: Rect = {x: f1(cand.c[0] - size / 2), y: f1(cand.c[1] - size / 2), w: size, h: size};
        stats.candidates++; const why = hits(box, obs, ignoreHead); last = why;
        if (!why.length) { if (tried > 0) stats.resolved++; obs.placed.push(box); placed.push({id, kind, layer, box, at: cand.at, triedBefore: tried, svg: draw(f1(cand.c[0]), f1(cand.c[1]))}); return; }
        if (tried === 0) stats.firstChoiceHits++;
        tried++; if (!opts.nudge) break;
      }
      stats.unresolved++; findings.push({rule: layer === 'manpu' ? 'comic-manpu-no-room' : 'comic-prop-no-room', where: id, message: `${kind}: no free position (${last.join('+')}), tried ${tried}`});
    };
    (ex.manpu ?? []).forEach((m, i) => {
      const side = ex.side[m.on]!, head = geo.points[`${ex.panel}.${m.on}`]!.head, size = m.size === 's' ? 20 : 28, def = MANPU[m.kind];
      const order = [...new Set([m.at, ...def.prefer, 'top', 'top-out', 'top-in', 'side-out', 'side-in'].filter(Boolean) as HeadAnchor[])];
      settle(`${ex.panel}.${m.on}.m${i}`, m.kind, 'manpu', size, order.map(a => ({at: a, c: headPoint(head, side, a, size / 2)})), (x, y) => `<g data-manpu="${ex.panel}.${m.on}.m${i}" transform="translate(${x} ${y}) scale(${f1(size / 24)})" aria-hidden="true">${def.body}</g>`, keys.indexOf(m.on) );
    });
    (ex.props ?? []).forEach((p, i) => {
      const side = ex.side[p.on]!, head = geo.points[`${ex.panel}.${p.on}`]!.head, out = side === 'right' ? 1 : -1, def = PROP[p.kind];
      const hand: [number, number] = [head[0] - out * 58, panel.y + PH - 30], floor: [number, number] = [head[0] - out * 108, panel.y + PH - 30];
      const wall: [number, number] = [head[0] + out * 76, panel.y + 40], wallIn: [number, number] = [head[0] - out * 76, panel.y + 40];
      const all: Record<PropAnchor, [number, number]> = {hand, floor, 'wall-out': wall, 'wall-in': wallIn};
      const order = [...new Set<PropAnchor>([p.at ?? 'hand', 'hand', 'floor', 'wall-out', 'wall-in'])];
      settle(`${ex.panel}.${p.on}.o${i}`, p.kind, 'prop', 40, order.map(a => ({at: a, c: all[a]})), (x, y) => `<g data-prop="${ex.panel}.${p.on}.o${i}" transform="translate(${x} ${y})"><title>${def.name}</title>${def.body}</g>`);
    });
  }
  return {placed, findings, stats};
}
export const PANEL_W = PW;
