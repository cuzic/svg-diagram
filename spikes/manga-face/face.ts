// Spike for ADR 0079 (round 3): a parametric manga-style front face that outputs SVG fragments and a CharacterManifest.
// Pure: numbers in, strings out. Parameters have ranges, dependent constraints and invariants (`normalize`, `validate`); presets are deltas on the character's base
// eyes / brows / mouth; features are ink (with a paper keyline where the ink would not show); shades and highlights are opacity overlays on the base colours, so the
// manifest holds only the three base hexes of ADR 0076's `recolor` (skin, hair, top). No Math.cos / sin / pow / hypot: every number that decides the output is
// plain arithmetic or a literal table, so every engine gives the same bytes.
// Coordinates: the head centre is (150, 140); the head circle (the anchor) has r = 100. The stage scales the circle to r = 36 px (0.36).
import type {CharacterManifest, ComicExpression} from '../../lib/types/comic.ts';

export const CX = 150, CY = 140, HEAD_R = 100, SCALE = 0.36;
/** The box is cropped to the artwork's width (shoulders 20..280) and top (hair top ~23). */
export const BOX = [20, 16, 260, 344] as const;
const n = (v: number): number => Math.round(v * 10) / 10;

// ---- colours: the comic's own ink and paper (ADR 0074 D6), the three base slots, and tones that are opacity overlays (no derived hex)
/** The comic's ink and paper (`PALETTE.text`, `PALETTE.bg` of lib/tokens.ts; copied so the package has no run-time import of svg-diagram). */
export const INK = '#22201b', PAPER = '#ffffff', WHITE = '#ffffff';
const MOUTH_IN = '#8a3340', TONGUE = '#ee7f8c', SHADE_ROSE = '#c0707a', BLUSH = '#ee6f7a';
/** ADR 0076 D4's named palettes (skin / hair / top), plus the iris names of this library. A palette slot takes a key or a `#rrggbb`. */
export const SKIN = {fair: '#ffe3c8', light: '#f6d0a8', medium: '#e2ab7c', tan: '#c98c5c', brown: '#9c6341', dark: '#6e4430'} as const;
export const HAIR = {black: '#1f1f24', brown: '#4a3322', chestnut: '#7d4a2b', blond: '#d2a640', gray: '#9097a3', navy: '#2d3f66'} as const;
export const TOP = {navy: '#3b5b92', blue: '#5b8ed6', teal: '#2f8f8a', green: '#5a9a52', yellow: '#e0b43a', orange: '#e0833a', red: '#c8473f', purple: '#7a58b0', gray: '#7b8290'} as const;
export const IRIS = {brown: '#7a4a2e', blue: '#4f86c6', green: '#4f9a6a', gray: '#7a869a'} as const;
export interface Palette {skin: keyof typeof SKIN | string; hair: keyof typeof HAIR | string; top: keyof typeof TOP | string; iris: keyof typeof IRIS | string}
const HEX = /^#[0-9a-fA-F]{6}$/;
const pick = (t: Record<string, string>, k: string): string => (t[k] ?? k).toLowerCase();
/** sRGB -> linear, as a literal table of the 256 byte values (no `**`). */
const LIN: readonly number[] = [
  0, 0.00030353, 0.00060705, 0.00091058, 0.00121411, 0.00151763, 0.00182116, 0.00212469,
  0.00242822, 0.00273174, 0.00303527, 0.00334654, 0.00367651, 0.00402472, 0.00439144, 0.00477695,
  0.00518152, 0.00560539, 0.00604883, 0.00651209, 0.00699541, 0.00749903, 0.00802319, 0.00856813,
  0.00913406, 0.00972122, 0.01032982, 0.01096009, 0.01161225, 0.01228649, 0.01298303, 0.01370208,
  0.01444384, 0.01520851, 0.01599629, 0.01680738, 0.01764195, 0.01850022, 0.01938236, 0.02028856,
  0.02121901, 0.02217388, 0.02315337, 0.02415763, 0.02518686, 0.02624122, 0.02732089, 0.02842604,
  0.02955683, 0.03071344, 0.03189603, 0.03310477, 0.03433981, 0.03560131, 0.03688945, 0.03820437,
  0.03954624, 0.0409152, 0.04231141, 0.04373503, 0.0451862, 0.04666509, 0.04817182, 0.04970657,
  0.05126946, 0.05286065, 0.05448028, 0.05612849, 0.05780543, 0.05951124, 0.06124605, 0.06301002,
  0.06480327, 0.06662594, 0.06847817, 0.0703601, 0.07227185, 0.07421357, 0.07618538, 0.07818742,
  0.08021982, 0.08228271, 0.08437621, 0.08650046, 0.08865559, 0.09084171, 0.09305896, 0.09530747,
  0.09758735, 0.09989873, 0.10224173, 0.10461648, 0.1070231, 0.10946171, 0.11193243, 0.11443537,
  0.11697067, 0.11953843, 0.12213877, 0.12477182, 0.12743768, 0.13013648, 0.13286832, 0.13563333,
  0.13843162, 0.14126329, 0.14412847, 0.14702727, 0.14995979, 0.15292615, 0.15592646, 0.15896084,
  0.16202938, 0.16513219, 0.1682694, 0.1714411, 0.1746474, 0.17788842, 0.18116424, 0.18447499,
  0.18782077, 0.19120168, 0.19461783, 0.19806932, 0.20155625, 0.20507874, 0.20863687, 0.21223076,
  0.2158605, 0.2195262, 0.22322796, 0.22696587, 0.23074005, 0.23455058, 0.23839757, 0.24228112,
  0.24620133, 0.25015828, 0.25415209, 0.25818285, 0.26225066, 0.2663556, 0.27049779, 0.27467731,
  0.27889426, 0.28314874, 0.28744084, 0.29177065, 0.29613827, 0.30054379, 0.30498731, 0.30946892,
  0.31398871, 0.31854678, 0.32314321, 0.3277781, 0.33245154, 0.33716362, 0.34191442, 0.34670406,
  0.3515326, 0.35640014, 0.36130678, 0.3662526, 0.37123768, 0.37626212, 0.38132601, 0.38642943,
  0.39157248, 0.39675523, 0.40197778, 0.40724021, 0.41254261, 0.41788507, 0.42326767, 0.4286905,
  0.43415364, 0.43965717, 0.44520119, 0.45078578, 0.45641102, 0.462077, 0.4677838, 0.4735315,
  0.47932018, 0.48514994, 0.49102085, 0.496933, 0.50288646, 0.50888132, 0.51491767, 0.52099557,
  0.52711513, 0.5332764, 0.53947949, 0.54572446, 0.5520114, 0.55834039, 0.56471151, 0.57112483,
  0.57758044, 0.58407842, 0.59061884, 0.59720179, 0.60382734, 0.61049557, 0.61720656, 0.62396039,
  0.63075714, 0.63759687, 0.64447968, 0.65140564, 0.65837482, 0.6653873, 0.67244316, 0.67954247,
  0.68668531, 0.69387176, 0.70110189, 0.70837578, 0.7156935, 0.72305513, 0.73046074, 0.73791041,
  0.74540421, 0.75294222, 0.7605245, 0.76815115, 0.77582222, 0.78353779, 0.79129794, 0.79910274,
  0.80695226, 0.81484657, 0.82278575, 0.83076988, 0.83879901, 0.84687323, 0.85499261, 0.86315721,
  0.87136712, 0.8796224, 0.88792312, 0.89626935, 0.90466117, 0.91309865, 0.92158186, 0.93011086,
  0.93868573, 0.94730654, 0.95597335, 0.96468625, 0.97344529, 0.98225055, 0.9911021, 1,
];

const lum = (h: string): number => 0.2126 * LIN[Number.parseInt(h.slice(1, 3), 16)]! + 0.7152 * LIN[Number.parseInt(h.slice(3, 5), 16)]! + 0.0722 * LIN[Number.parseInt(h.slice(5, 7), 16)]!;
export const contrast = (a: string, b: string): number => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
/** Feature lines are graphics, so WCAG 1.4.11's 3:1 applies (not the text rule 4.5:1): where the ink is under 3:1 against what it lies on, a paper line goes under it. */
export const KEY_BELOW = 3;
export const needsKeyline = (fillHex: string): boolean => contrast(INK, fillHex) < KEY_BELOW;
/** Moves a base colour by one unit, inside 000000..ffffff, until it is not one of the other colours the fragment uses. */
const nudge = (hex: string, taken: Set<string>): string => {
  let v = Number.parseInt(hex.slice(1), 16); const dir = v >= 0xfffff0 ? -1 : 1;
  while (taken.has(`#${v.toString(16).padStart(6, '0')}`)) v += dir;
  return `#${v.toString(16).padStart(6, '0')}`;
};

// ---- parameters: type, range, step, default (ADR 0079 D2). `normalize` clamps, snaps and applies the dependent constraints; `validate` checks the invariants.
export type EyeKind = 'open' | 'arc' | 'arcDown' | 'cross' | 'dot' | 'half';
export type MouthKind = 'flat' | 'smile' | 'open' | 'o' | 'frown' | 'wave' | 'omega' | 'grit' | 'tri';
export interface Base {
  head: {cheek: number; chin: number; jaw: number; chinW: number};
  eyes: {w: number; h: number; tilt: number; iris: number; y: number; gap: number; lashes: boolean; lidW: number};
  brows: {thick: number; dy: number};
  mouth: {w: number; y: number};
  nose: 'none' | 'dot' | 'line';
  hair: {template: 'short' | 'bob'; strands: number; parting: number; ahoge: 'none' | 'left' | 'right'; highlight: boolean; sideLen: number};
}
export interface Character extends Base {id: string; name: string; palette: Palette; mirror?: boolean}
/** [min, max, step] */
export const RANGES = {
  'head.cheek': [74, 96, 2], 'head.chin': [90, 98, 1], 'head.jaw': [0, 1, 0.05], 'head.chinW': [0, 16, 2],
  'eyes.w': [18, 28, 1], 'eyes.h': [13, 26, 1], 'eyes.tilt': [-8, 10, 1], 'eyes.iris': [0.6, 1.2, 0.05], 'eyes.y': [14, 28, 1], 'eyes.gap': [36, 48, 1], 'eyes.lidW': [4.5, 7.5, 0.5],
  'brows.thick': [4, 9, 0.5], 'brows.dy': [-20, 8, 1], 'mouth.w': [10, 48, 1], 'mouth.y': [58, 70, 1],
  'hair.strands': [1, 9, 1], 'hair.parting': [-1, 1, 0.25], 'hair.sideLen': [16, 40, 2],
} as const satisfies Record<string, readonly [number, number, number]>;
type RangeKey = keyof typeof RANGES;
const get = (o: object, path: string): number => path.split('.').reduce((a: any, k) => a[k], o) as number;
const set = (o: object, path: string, v: number): void => { const ks = path.split('.'); const last = ks.pop()!; (ks.reduce((a: any, k) => a[k], o) as any)[last] = v; };
const clamp = (v: number, [lo, hi, st]: readonly [number, number, number]): number => { const c = Math.min(hi, Math.max(lo, v)); const s = Math.round(c / st) * st; return Math.round(Math.min(hi, s) * 1e6) / 1e6; };
const LASH = 11, EYE_WMUL_MAX = 1.08, MOUTH_WMUL_MAX = 2.6;
/**
 * Clamps every ranged field and snaps it to its step, then applies the dependent constraints (the valid set is not a box):
 *   the face inside the head circle (jaw roundness, then cheek, are lowered); eyes.gap <= half face width at the eyes - 4 - lash - 1 - 1.08 * 18;
 *   mouth.y in [eyes.y + 28, chin - 30]; eyes.w <= (half face width at the eyes - 4 - lash - gap - 1) / 1.08 (the widest preset); mouth.w <= (half face width at the mouth - 6) * 2 / 2.6.
 * Returns a copy. What still breaks an invariant (a range that cannot hold both bounds) is reported by `validate`.
 */
export function normalize<T extends Base>(ch: T): T {
  const c = structuredClone(ch);
  for (const k of Object.keys(RANGES) as RangeKey[]) set(c, k, clamp(get(c, k), RANGES[k]));
  // the face stays inside the head circle: lower the jaw's roundness, then the cheek, until it does
  const inCircle = (): boolean => Math.max(...flatten(faceSegs(c.head)).filter(p => p[1] > CY - 20).map(p => Math.sqrt((p[0] - CX) * (p[0] - CX) + (p[1] - CY) * (p[1] - CY)))) <= HEAD_R + 0.5;
  while (!inCircle() && c.head.jaw >= 0.05) c.head.jaw = Math.round((c.head.jaw - 0.05) * 100) / 100;
  while (!inCircle() && c.head.cheek > RANGES['head.cheek'][0]) c.head.cheek -= 2;
  const poly = flatten(faceSegs(c.head));
  c.mouth.y = Math.max(RANGES['mouth.y'][0], Math.min(c.mouth.y, c.head.chin - 30));
  const hwE = faceHalfWidth(poly, CY + c.eyes.y);
  c.eyes.gap = Math.max(RANGES['eyes.gap'][0], Math.min(c.eyes.gap, Math.floor(hwE - 4 - (c.eyes.lashes ? LASH : 0) - 1 - RANGES['eyes.w'][0] * EYE_WMUL_MAX)));
  c.eyes.w = Math.max(RANGES['eyes.w'][0], Math.min(c.eyes.w, Math.floor((hwE - 4 - (c.eyes.lashes ? LASH : 0) - c.eyes.gap - 1) / EYE_WMUL_MAX)));
  const hwM = faceHalfWidth(poly, CY + c.mouth.y);
  c.mouth.w = Math.max(RANGES['mouth.w'][0], Math.min(c.mouth.w, Math.floor((hwM - 6) * 2 / MOUTH_WMUL_MAX)));
  return c;
}

/** A preset is a delta on the character's own eyes / brows / mouth (ADR 0079 D3): multipliers and offsets, `angle` absolute (whole degrees). */
export interface Preset {
  eye: {kind?: EyeKind; wMul?: number; hMul?: number; hMulL?: number; tilt?: number; irisMul?: number; lid?: number; squint?: number; lookX?: number; lookY?: number; hl?: 1 | 2; lashes?: boolean};
  brow: {angle: number; thickMul?: number; dy?: number; raise?: [number, number]};
  mouth: {kind: MouthKind; wMul?: number; depth?: number; shift?: number};
  blush?: boolean;
}
export const PRESETS: Record<string, Preset> = {
  neutral: {eye: {}, brow: {angle: 0}, mouth: {kind: 'flat'}},
  smile: {eye: {hMul: 0.78, lid: 0.8, squint: 0.6, irisMul: 1.05}, brow: {angle: -7, dy: -4, thickMul: 1.1}, mouth: {kind: 'smile', wMul: 2.1, depth: 2.8}, blush: true},
  laugh: {eye: {kind: 'arc'}, brow: {angle: -6, dy: -8}, mouth: {kind: 'open', wMul: 2.6}, blush: true},
  surprise: {eye: {wMul: 1.08, hMul: 1.25, irisMul: 0.62, hl: 1}, brow: {angle: -4, dy: -16}, mouth: {kind: 'o', wMul: 0.7}},
  worry: {eye: {hMul: 0.9, lid: 0.85, tilt: -6, irisMul: 0.9, lookX: 4}, brow: {angle: -28, thickMul: 1.1, dy: -5}, mouth: {kind: 'wave', wMul: 2}},
  angry: {eye: {hMul: 0.74, tilt: 9, irisMul: 0.82, hl: 1}, brow: {angle: 20, thickMul: 1.3, dy: 1}, mouth: {kind: 'grit', wMul: 2.1}},
  think: {eye: {hMul: 0.95, hMulL: 0.55, lookX: 10, lookY: -9, irisMul: 0.95}, brow: {angle: -3, thickMul: 1.1, raise: [0, 26]}, mouth: {kind: 'flat', wMul: 1.2, shift: 7}},
  sad: {eye: {lid: 0.6, tilt: -7, irisMul: 1.12, lookY: 7}, brow: {angle: -32, dy: 2, thickMul: 1.1}, mouth: {kind: 'frown', wMul: 1.4, depth: 2.2}},
  // extras. Each has a same-meaning ComicExpression to stand in for (EXTRA_OF)
  shy: {eye: {hMul: 0.85, tilt: -3, lookX: 5, lookY: 6}, brow: {angle: -14, dy: -2}, mouth: {kind: 'omega', wMul: 1.4}, blush: true},
  smug: {eye: {kind: 'half'}, brow: {angle: 6, raise: [0, 6]}, mouth: {kind: 'omega', wMul: 1.7}},
  deadpan: {eye: {kind: 'half', hMul: 0.85, irisMul: 0.9, hl: 1}, brow: {angle: 2}, mouth: {kind: 'flat', wMul: 0.9}},
  clench: {eye: {kind: 'cross'}, brow: {angle: 18, thickMul: 1.2}, mouth: {kind: 'tri', wMul: 1.6}},
  cry: {eye: {kind: 'arcDown'}, brow: {angle: -24, dy: -2}, mouth: {kind: 'open', wMul: 2.2}},
  blank: {eye: {kind: 'dot'}, brow: {angle: 0, dy: -4}, mouth: {kind: 'o', wMul: 0.6}},
};
export const ADR0074: readonly ComicExpression[] = ['neutral', 'smile', 'laugh', 'surprise', 'worry', 'angry', 'think', 'sad'];
/** The same-meaning variants `expressionMap` may use (ADR 0079 D3). Anything else is refused. */
export const EXTRA_OF: Record<string, ComicExpression> = {shy: 'smile', smug: 'smile', deadpan: 'think', clench: 'angry', cry: 'sad', blank: 'surprise'};

interface Eye {kind: EyeKind; w: number; h: number; hL: number; tilt: number; iris: number; lid: number; squint: number; lookX: number; lookY: number; hl: 1 | 2; lashes: boolean; lidW: number}
const resolveEye = (b: Base['eyes'], p: Preset['eye']): Eye => {
  const kind = p.kind ?? 'open', h = b.h * (p.hMul ?? 1);
  return {kind, w: b.w * (p.wMul ?? 1), h, hL: h * (p.hMulL ?? 1), tilt: b.tilt + (p.tilt ?? 0), iris: b.iris * (p.irisMul ?? 1), lid: p.lid ?? (kind === 'half' ? 0.45 : 1), squint: p.squint ?? 0, lookX: p.lookX ?? 0, lookY: p.lookY ?? 0, hl: p.hl ?? 2, lashes: p.lashes ?? b.lashes, lidW: b.lidW};
};

// ---- geometry: segments, flattening, intersection
type Pt = [number, number];
type Seg = ['M', Pt] | ['L', Pt] | ['Q', Pt, Pt] | ['C', Pt, Pt, Pt] | ['Z'];
const dOf = (segs: Seg[]): string => segs.map(s => s[0] + s.slice(1).map(p => `${n((p as Pt)[0])} ${n((p as Pt)[1])}`).join(' ')).join('');
function flatten(segs: Seg[], steps = 10): Pt[] {
  const out: Pt[] = []; let cur: Pt = [0, 0];
  for (const s of segs) {
    if (s[0] === 'M' || s[0] === 'L') { cur = s[1]; out.push(cur); } else if (s[0] === 'Q') {
      const [c, e] = [s[1], s[2]]; for (let i = 1; i <= steps; i++) { const t = i / steps, u = 1 - t; out.push([u * u * cur[0] + 2 * u * t * c[0] + t * t * e[0], u * u * cur[1] + 2 * u * t * c[1] + t * t * e[1]]); } cur = e;
    } else if (s[0] === 'C') {
      const [a, b, e] = [s[1], s[2], s[3]]; for (let i = 1; i <= steps; i++) { const t = i / steps, u = 1 - t; out.push([u * u * u * cur[0] + 3 * u * u * t * a[0] + 3 * u * t * t * b[0] + t * t * t * e[0], u * u * u * cur[1] + 3 * u * u * t * a[1] + 3 * u * t * t * b[1] + t * t * t * e[1]]); } cur = e;
    }
  }
  return out;
}
/** True if the closed polyline crosses itself (non-adjacent segments intersect). */
export function selfIntersects(poly: Pt[]): boolean {
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const hit = (p1: Pt, p2: Pt, p3: Pt, p4: Pt) => cross(p1, p2, p3) * cross(p1, p2, p4) < 0 && cross(p3, p4, p1) * cross(p3, p4, p2) < 0;
  const m = poly.length;
  for (let i = 0; i < m; i++) for (let j = i + 2; j < m; j++) { if (i === 0 && j === m - 1) continue; if (hit(poly[i]!, poly[(i + 1) % m]!, poly[j]!, poly[(j + 1) % m]!)) return true; }
  return false;
}

// ---- the face outline: temple -> cheekbone -> jaw corner -> chin, mirrored (jaw roundness and chin width are independent)
function faceSegs(h: Base['head']): Seg[] {
  const W = h.cheek, H = h.chin, j = h.jaw, cw = h.chinW;
  const jx = cw + (W * 0.8 - cw) * j, jy = H * (0.6 + 0.2 * j);
  const half = (s: -1 | 1) => ({
    a: [CX + s * W, CY - 14] as Pt, b: [CX + s * W * 0.985, CY + 30] as Pt, j: [CX + s * jx, CY + jy] as Pt, e: [CX + s * cw, CY + H] as Pt,
    c1: [CX + s * W, CY - 2] as Pt, c2: [CX + s * W, CY + 16] as Pt, c3: [CX + s * W * 0.96, CY + 30 + (jy - 30) * 0.5] as Pt, c4: [CX + s * (jx + (W - jx) * 0.2), CY + jy + 2] as Pt,
  });
  const L = half(-1), R = half(1);
  return [
    ['M', L.a], ['C', L.c1, L.c2, L.b], ['C', L.c3, L.c4, L.j], ['Q', [CX - (jx + cw) / 2, CY + H - 1], L.e], ['Q', [CX, CY + H + 2], R.e],
    ['Q', [CX + (jx + cw) / 2, CY + H - 1], R.j], ['C', R.c4, R.c3, R.b], ['C', R.c2, R.c1, R.a],
    ['C', [CX + W, CY - 80], [CX + 64, CY - 104], [CX, CY - 104]], ['C', [CX - 64, CY - 104], [CX - W, CY - 80], L.a], ['Z'],
  ];
}
/** Half the face width at height y (from the flattened outline). */
function faceHalfWidth(poly: Pt[], y: number): number {
  let best = 0;
  for (let i = 0; i < poly.length; i++) { const a = poly[i]!, b = poly[(i + 1) % poly.length]!; if ((a[1] - y) * (b[1] - y) <= 0 && a[1] !== b[1]) { const x = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]); best = Math.max(best, Math.abs(x - CX)); } }
  return best;
}

/** [cos, sin] of the whole degrees -45..45 (index = degrees + 45), as literal constants: never computed at load (ADR 0079 D5). */
const TRIG: readonly (readonly [number, number])[] = [
  [0.7071, -0.7071], [0.7193, -0.6947], [0.7314, -0.682], [0.7431, -0.6691], [0.7547, -0.6561],
  [0.766, -0.6428], [0.7771, -0.6293], [0.788, -0.6157], [0.7986, -0.6018], [0.809, -0.5878],
  [0.8192, -0.5736], [0.829, -0.5592], [0.8387, -0.5446], [0.848, -0.5299], [0.8572, -0.515],
  [0.866, -0.5], [0.8746, -0.4848], [0.8829, -0.4695], [0.891, -0.454], [0.8988, -0.4384],
  [0.9063, -0.4226], [0.9135, -0.4067], [0.9205, -0.3907], [0.9272, -0.3746], [0.9336, -0.3584],
  [0.9397, -0.342], [0.9455, -0.3256], [0.9511, -0.309], [0.9563, -0.2924], [0.9613, -0.2756],
  [0.9659, -0.2588], [0.9703, -0.2419], [0.9744, -0.225], [0.9781, -0.2079], [0.9816, -0.1908],
  [0.9848, -0.1736], [0.9877, -0.1564], [0.9903, -0.1392], [0.9925, -0.1219], [0.9945, -0.1045],
  [0.9962, -0.0872], [0.9976, -0.0698], [0.9986, -0.0523], [0.9994, -0.0349], [0.9998, -0.0175],
  [1.0, 0.0], [0.9998, 0.0175], [0.9994, 0.0349], [0.9986, 0.0523], [0.9976, 0.0698],
  [0.9962, 0.0872], [0.9945, 0.1045], [0.9925, 0.1219], [0.9903, 0.1392], [0.9877, 0.1564],
  [0.9848, 0.1736], [0.9816, 0.1908], [0.9781, 0.2079], [0.9744, 0.225], [0.9703, 0.2419],
  [0.9659, 0.2588], [0.9613, 0.2756], [0.9563, 0.2924], [0.9511, 0.309], [0.9455, 0.3256],
  [0.9397, 0.342], [0.9336, 0.3584], [0.9272, 0.3746], [0.9205, 0.3907], [0.9135, 0.4067],
  [0.9063, 0.4226], [0.8988, 0.4384], [0.891, 0.454], [0.8829, 0.4695], [0.8746, 0.4848],
  [0.866, 0.5], [0.8572, 0.515], [0.848, 0.5299], [0.8387, 0.5446], [0.829, 0.5592],
  [0.8192, 0.5736], [0.809, 0.5878], [0.7986, 0.6018], [0.788, 0.6157], [0.7771, 0.6293],
  [0.766, 0.6428], [0.7547, 0.6561], [0.7431, 0.6691], [0.7314, 0.682], [0.7193, 0.6947],
  [0.7071, 0.7071],
];

// ---- features. `keyed`: a paper line (2 units wider on each side) under each ink line.
const KEY_W = 4;
const inkLine = (d: string, w: number, keyed: boolean): string =>
  (keyed ? `<path d="${d}" fill="none" stroke="${PAPER}" stroke-width="${n(w + KEY_W)}" stroke-linecap="round" stroke-linejoin="round"/>` : '') + `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const over = (shape: string, fill: string, op: number): string => `<${shape} fill="${fill}" fill-opacity="${op}"/>`;

interface Built {svg: string; top: number; bottom: number; left: number; right: number}
function eyeSvg(e: Eye, s: -1 | 1, ex: number, ey: number, iris: string, id: string, keyed: boolean): Built {
  const P = (x: number, y: number): Pt => [ex + s * x, ey + y];
  const q = (p: Pt): string => `${n(p[0])} ${n(p[1])}`;
  const a = e.w, b = s === -1 ? e.hL : e.h, oy = -e.tilt;
  if (e.kind === 'arc' || e.kind === 'arcDown') {
    const d = e.kind === 'arc' ? -1 : 1, y = e.kind === 'arc' ? 3 : -3;
    return {svg: inkLine(`M${q(P(-a, y))}Q${q(P(0, y + d * b * 1.25))} ${q(P(a, y))}`, 6.5, keyed), top: ey + y + Math.min(0, d * b * 0.62) - 3, bottom: ey + y + Math.max(0, d * b * 0.62) + 3, left: ex - a, right: ex + a};
  }
  if (e.kind === 'cross') {
    // `><`: the vertex is on the inner side (the left eye is `>`, the right eye is `<`)
    return {svg: inkLine(`M${q(P(a * 0.7, -b * 0.8))}L${q(P(-a * 0.7, 0))}L${q(P(a * 0.7, b * 0.8))}`, 6, keyed), top: ey - b * 0.8 - 3, bottom: ey + b * 0.8 + 3, left: ex - a, right: ex + a};
  }
  if (e.kind === 'dot') {
    const el = `cx="${n(ex)}" cy="${n(ey + 2)}" rx="${n(a * 0.34)}" ry="${n(b * 0.5)}"`;
    return {svg: (keyed ? `<ellipse ${el} fill="${PAPER}" stroke="${PAPER}" stroke-width="${KEY_W}"/>` : '') + `<ellipse ${el} fill="${INK}"/>`, top: ey + 2 - b * 0.5, bottom: ey + 2 + b * 0.5, left: ex - a * 0.34, right: ex + a * 0.34};
  }
  const lid = e.lid;
  const top = (y: number): number => y * lid;
  const sq = e.squint;
  const upperSegs: Seg[] = [['M', P(-a, 2)], ['C', P(-a * 0.7, top(-b * 1.2)), P(a * 0.35, top(-b * 1.3)), P(a, oy)]];
  const lowerSegs: Seg[] = [['C', P(a * 0.55, b * (0.85 - sq * 0.8) - sq * 5), P(-a * 0.5, b * (0.95 - sq * 0.8) - sq * 5), P(-a, 2)], ['Z']];
  const upper = dOf(upperSegs), shape = upper + dOf(lowerSegs);
  const poly = flatten([...upperSegs, ...lowerSegs]);
  const rx = a * 0.64 * e.iris, ry = Math.min(b * 0.98, b * 0.98 * e.iris), ix = e.lookX * s, iy = 3 + e.lookY;
  const icx = ex + s * ix, icy = (k: number): number => ey + iy + k;
  const hi = `<ellipse cx="${n(ex + s * (ix - rx * 0.3))}" cy="${n(icy(-ry * 0.38))}" rx="${n(rx * 0.3)}" ry="${n(ry * 0.26)}" fill="${WHITE}"/>`
    + (e.hl === 2 ? `<circle cx="${n(ex + s * (ix + rx * 0.38))}" cy="${n(icy(ry * 0.42))}" r="${n(rx * 0.14)}" fill="${WHITE}"/>` : '');
  const lash = e.lashes ? `<path d="M${q(P(a + 1, oy - 1))}L${q(P(a + LASH, oy - 9 - Math.max(0, e.tilt) * 0.2))}L${q(P(a - 5, oy - 4))}Z" fill="${INK}"/>` : '';
  const lidTop = Math.min(...poly.map(p => p[1]));
  const lw = e.lidW;
  const lidPath = lid === 1 ? upper : `M${q(P(-a - 1, 2))}C${q(P(-a * 0.7, top(-b * 1.2)))} ${q(P(a * 0.35, top(-b * 1.3)))} ${q(P(a + 1, oy))}`;
  const svg = `<clipPath id="${id}"><path d="${shape}"/></clipPath><path d="${shape}" fill="${WHITE}"/>`
    // the iris: the base colour, an ink overlay for the dark rim, the base colour again as the lit part, a white overlay for the glow, the pupil and the highlights
    + `<g clip-path="url(#${id})"><ellipse cx="${n(icx)}" cy="${n(icy(0))}" rx="${n(rx)}" ry="${n(ry)}" fill="${iris}"/>`
    + over(`ellipse cx="${n(icx)}" cy="${n(icy(0))}" rx="${n(rx)}" ry="${n(ry)}"`, INK, 0.5)
    + `<ellipse cx="${n(icx)}" cy="${n(icy(ry * 0.3))}" rx="${n(rx * 0.86)}" ry="${n(ry * 0.62)}" fill="${iris}"/>`
    + over(`ellipse cx="${n(icx)}" cy="${n(icy(ry * 0.52))}" rx="${n(rx * 0.55)}" ry="${n(ry * 0.3)}"`, WHITE, 0.5)
    + `<ellipse cx="${n(icx)}" cy="${n(icy(-ry * 0.05))}" rx="${n(rx * 0.42)}" ry="${n(ry * 0.5)}" fill="${INK}"/>${hi}</g>`
    + `<path d="${lidPath}" fill="none" stroke="${INK}" stroke-width="${lw}" stroke-linecap="round" stroke-linejoin="round"/>`
    // the lower lid lies next to the eye white, so it needs no keyline
    + lash + inkLine(`M${q(P(a * 0.9, 1))}C${q(P(a * 0.55, b * (0.8 - sq * 0.8) - sq * 5))} ${q(P(-a * 0.2, b * (0.95 - sq * 0.8) - sq * 5))} ${q(P(-a * 0.6, b * (0.7 - sq * 0.6) - sq * 4))}`, 3, false);
  const xs = poly.map(p => p[0]);
  // the lash is on the outer side: the right of the right eye (s = 1), the left of the left eye (s = -1)
  const lashOut = e.lashes ? LASH : 0;
  return {svg, top: lidTop - lw / 2, bottom: Math.max(...poly.map(p => p[1])), left: Math.min(...xs) - (s === -1 ? lashOut : 0), right: Math.max(...xs) + (s === 1 ? lashOut : 0)};
}

function browSvg(bp: Preset['brow'], thick: number, s: -1 | 1, ex: number, ey: number, eyeH: number, dy0: number, keyed: boolean): Built {
  const len = 36, raise = bp.raise ? (s === 1 ? bp.raise[1] : bp.raise[0]) : 0;
  const y0 = ey - eyeH - 16 + dy0 + (bp.dy ?? 0) - raise;
  const [cs, sn] = TRIG[Math.round(bp.angle) + 45] ?? [1, 0], dx = cs * len / 2, dy = sn * len / 2;
  const ix = ex - s * dx, iy = y0 + dy, ox = ex + s * dx, oy = y0 - dy;
  const t = thick * (bp.thickMul ?? 1) / 2, mx = (ix + ox) / 2, my = (iy + oy) / 2 - 4;
  const d = `M${n(ix)} ${n(iy - t)}Q${n(mx)} ${n(my - t)} ${n(ox)} ${n(oy)}Q${n(mx)} ${n(my + t)} ${n(ix)} ${n(iy + t)}Z`;
  const poly = flatten([['M', [ix, iy - t]], ['Q', [mx, my - t], [ox, oy]], ['Q', [mx, my + t], [ix, iy + t]]]);
  const svg = (keyed ? `<path d="${d}" fill="${PAPER}" stroke="${PAPER}" stroke-width="${KEY_W + 1.5}" stroke-linejoin="round"/>` : '') + `<path d="${d}" fill="${INK}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`;
  return {svg, top: Math.min(...poly.map(p => p[1])), bottom: Math.max(...poly.map(p => p[1])) + 0.75, left: Math.min(...poly.map(p => p[0])), right: Math.max(...poly.map(p => p[0]))};
}

function mouthSvg(m: Preset['mouth'], baseW: number, y: number, id: string, keyed: boolean): Built {
  const w = baseW * (m.wMul ?? 1), dp = m.depth ?? 1, h = w / 2, x = CX + (m.shift ?? 0);
  const st = (d: string, sw = 3.6): string => inkLine(d, sw, keyed);
  const box = (): Pick<Built, 'left' | 'right'> => ({left: x - h, right: x + h});
  const KW = KEY_W + 3.6; // a closed shape: its outline's width + the keyline
  const closed = (d: string, fill: string, extra = ''): string => `${keyed ? `<path d="${d}" fill="none" stroke="${PAPER}" stroke-width="${KW}" stroke-linejoin="round"/>` : ''}<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/>${extra}`;
  switch (m.kind) {
    case 'flat': return {svg: st(`M${n(x - h)} ${n(y)}Q${n(x)} ${n(y + 3 * dp)} ${n(x + h)} ${n(y - (m.shift ? 3 : 0))}`), top: y - 3, bottom: y + 4, ...box()};
    case 'smile': return {svg: st(`M${n(x - h)} ${n(y - 3)}Q${n(x)} ${n(y + 8 * dp)} ${n(x + h)} ${n(y - 3)}`), top: y - 5, bottom: y + 5 * dp, ...box()};
    case 'frown': return {svg: st(`M${n(x - h)} ${n(y + 6)}Q${n(x)} ${n(y + 6 - 14 * dp)} ${n(x + h)} ${n(y + 6)}`), top: y - 2 - 4 * dp, bottom: y + 8, ...box()};
    case 'wave': return {svg: st(`M${n(x - h)} ${n(y + 2)}q${n(h / 2)} -11 ${n(h)} 0t${n(h)} 0`), top: y - 8, bottom: y + 6, ...box()};
    case 'omega': return {svg: st(`M${n(x - h)} ${n(y - 2)}q${n(h / 2)} 12 ${n(h)} 0q${n(h / 2)} 12 ${n(h)} 0`, 3.4), top: y - 4, bottom: y + 8, ...box()};
    case 'o': { const d = `M${n(x - h * 0.85)} ${n(y + 4)}a${n(h * 0.85)} ${n(h * 1.15)} 0 1 0 ${n(h * 1.7)} 0a${n(h * 0.85)} ${n(h * 1.15)} 0 1 0 ${n(-h * 1.7)} 0Z`; return {svg: closed(d, MOUTH_IN), top: y + 4 - h * 1.15 - 2, bottom: y + 4 + h * 1.15 + 2, ...box()}; }
    case 'open': {
      const dd = `M${n(x - h)} ${n(y - 6)}Q${n(x)} ${n(y - 2)} ${n(x + h)} ${n(y - 6)}Q${n(x + h * 0.7)} ${n(y + 24)} ${n(x)} ${n(y + 24)}Q${n(x - h * 0.7)} ${n(y + 24)} ${n(x - h)} ${n(y - 6)}Z`;
      return {svg: `${keyed ? `<path d="${dd}" fill="none" stroke="${PAPER}" stroke-width="${KW}" stroke-linejoin="round"/>` : ''}<clipPath id="${id}"><path d="${dd}"/></clipPath><path d="${dd}" fill="${MOUTH_IN}"/><g clip-path="url(#${id})"><ellipse cx="${n(x)}" cy="${n(y + 23)}" rx="${n(h * 0.6)}" ry="9" fill="${TONGUE}"/></g><path d="${dd}" fill="none" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/>`, top: y - 8, bottom: y + 26, ...box()};
    }
    case 'grit': { const d = `M${n(x - h)} ${n(y + 2)}Q${n(x)} ${n(y - 6)} ${n(x + h)} ${n(y + 2)}L${n(x + h * 0.8)} ${n(y + 16)}Q${n(x)} ${n(y + 10)} ${n(x - h * 0.8)} ${n(y + 16)}Z`; return {svg: closed(d, WHITE, `<path d="M${n(x - h * 0.3)} ${n(y - 1)}v10M${n(x + h * 0.3)} ${n(y - 1)}v10" fill="none" stroke="${INK}" stroke-width="2.8" stroke-linecap="round"/>`), top: y - 6, bottom: y + 18, ...box()}; }
    case 'tri': { const d = `M${n(x - h)} ${n(y)}L${n(x + h)} ${n(y)}L${n(x)} ${n(y + 20)}Z`; return {svg: closed(d, MOUTH_IN), top: y - 2, bottom: y + 22, ...box()}; }
  }
}

// ---- hair: a smooth silhouette (volume on the side the hair falls to), fringe locks as tapered fills whose width and length depend on the distance from the parting
interface Hair {lockStroke: string; back: string; mass: string; locks: string; lockShade: string; skinShade: string; polys: Record<string, Pt[]>; top: number; clipDefs: string}
const VAR = [0, -5, 3, -2, 5, -3, 2];
function hairParts(h: Base['hair'], W: number, hairHex: string): Hair {
  const bob = h.template === 'bob', lockLen = bob ? 112 : h.sideLen, foot = bob ? 24 : 14;
  const part = h.parting * W * 0.5, sp = h.parting >= 0 ? 1 : -1, heavy = -sp;
  const Wo = W + (bob ? 13 : 9), woR = Wo + (heavy === 1 ? 5 : -2), woL = Wo + (heavy === -1 ? 5 : -2), inX = W - (bob ? 6 : 10);
  const span = W - 8, N = h.strands;
  const massSegs: Seg[] = [
    ['M', [CX + woR, CY + lockLen]], ['L', [CX + woR - 1, CY + 2]], ['C', [CX + woR + 8, CY - 60], [CX + 66, CY - 114], [CX, CY - 114]], ['C', [CX - 66, CY - 114], [CX - woL - 8, CY - 60], [CX - woL - 1, CY + 2]],
    ['L', [CX - woL, CY + lockLen]], ['Q', [CX - W + 2, CY + lockLen + 6], [CX - inX, CY + lockLen - foot]], ['L', [CX - inX + 1, CY - 2]], ['L', [CX - W + 8, CY - 36]], ['Q', [CX, CY - 84], [CX + W - 8, CY - 36]],
    ['L', [CX + inX - 1, CY - 2]], ['L', [CX + inX, CY + lockLen - foot]], ['Q', [CX + W - 2, CY + lockLen + 6], [CX + woR, CY + lockLen]], ['Z'],
  ];
  // strands: the distance d from the parting (0..1) sets each lock's width (wider away from it), length (longer away from it) and lean
  const dist = (x: number): number => Math.min(1, Math.abs(x - (CX + part)) / (span * 1.2));
  const uni = Array.from({length: N}, (_, i) => CX + span - 2 * span * (N === 1 ? 0.5 : i / (N - 1)));
  const wt = uni.map(x => 0.45 + 1.3 * dist(x)), sum = wt.reduce((p, q) => p + q, 0);
  let acc = 0;
  const locks: {segs: Seg[]; tip: Pt}[] = [];
  for (let i = 0; i < N; i++) {
    const x = CX + span - 2 * span * (acc + wt[i]! / 2) / sum; acc += wt[i]!;
    const d = dist(x), width = Math.min(56, wt[i]! / sum * 2 * span * 1.6);
    const y = CY - 46 + 8 + 28 * d * Math.sqrt(d) + VAR[(i * 3 + N) % 7]!, lean = (x >= CX + part ? 1 : -1) * 6 * d;
    locks.push({tip: [x + lean, y], segs: [['M', [x + width / 2, CY - 64]], ['Q', [x + width * 0.6, (CY - 64 + y) / 2], [x + lean, y]], ['Q', [x - width * 0.5, (CY - 64 + y) / 2 + 2], [x - width / 2, CY - 64]], ['Z']]});
  }
  const order = [...locks].sort((p, q) => Math.abs(q.tip[0] - (CX + part)) - Math.abs(p.tip[0] - (CX + part)));
  const lockD = order.map(l => dOf(l.segs));
  const massD = dOf(massSegs);
  const polys: Record<string, Pt[]> = {mass: flatten(massSegs)};
  order.forEach((l, i) => { polys[`lock${i}`] = flatten(l.segs); });
  const locksSvg = lockD.map(d => `<path d="${d}" fill="${hairHex}" stroke="${INK}" stroke-width="3.4" stroke-linejoin="round"/>`).join('');
  const ring = h.highlight ? `<path d="M${n(CX - 60)} ${n(CY - 82)}Q${n(CX - 46)} ${n(CY - 96)} ${n(CX - 32)} ${n(CY - 90)}Q${n(CX - 18)} ${n(CY - 102)} ${n(CX)} ${n(CY - 97)}Q${n(CX + 18)} ${n(CY - 103)} ${n(CX + 32)} ${n(CY - 92)}Q${n(CX + 46)} ${n(CY - 94)} ${n(CX + 58)} ${n(CY - 80)}" fill="none" stroke="${WHITE}" stroke-opacity="0.45" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` : '';
  const ahoge = h.ahoge === 'none' ? '' : (() => { const s = h.ahoge === 'right' ? 1 : -1; const d = `M${n(CX + s * 40)} ${n(CY - 104)}C${n(CX + s * 44)} ${n(CY - 114)} ${n(CX + s * 66)} ${n(CY - 114)} ${n(CX + s * 62)} ${n(CY - 104)}`; polys['ahoge'] = flatten([['M', [CX + s * 40, CY - 104]], ['C', [CX + s * 44, CY - 114], [CX + s * 66, CY - 114], [CX + s * 62, CY - 104]]]); return `<path d="${d}" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${hairHex}" stroke-width="3.2" stroke-linecap="round"/>`; })();
  const backD = `M${n(CX - W - 10)} ${n(CY - 20)}C${n(CX - W - 26)} ${n(CY + 60)} ${n(CX - W - 20)} ${n(CY + 120)} ${n(CX - W + 2)} ${n(CY + 140)}Q${CX} ${n(CY + 158)} ${n(CX + W - 2)} ${n(CY + 140)}C${n(CX + W + 20)} ${n(CY + 120)} ${n(CX + W + 26)} ${n(CY + 60)} ${n(CX + W + 10)} ${n(CY - 20)}Z`;
  // the back hair is one value lighter than the front (an ink overlay of 0.25 on the base), so the inner and outer masses separate
  const back = bob ? `<path d="${backD}" fill="${hairHex}" stroke="${INK}" stroke-width="4.6" stroke-linejoin="round"/>` + over(`path d="${backD}"`, INK, 0.25) : '';
  const lockUnion = lockD.map(d => `<path d="${d}"/>`).join('');
  const clipDefs = `<clipPath id="lk">${lockUnion}</clipPath>`;
  const lockShade = `<g clip-path="url(#lk)">${over(`rect x="${CX - 100}" y="${CY - 36}" width="200" height="60"`, INK, 0.28)}</g>`;
  const skinShade = `<g fill="${SHADE_ROSE}" fill-opacity="0.28" transform="translate(0 9)"><path d="${massD}"/>${lockUnion}</g>`;
  const topInk = Math.min(Math.min(...polys['mass']!.map(q => q[1])) - 2.3, polys['ahoge'] ? Math.min(...polys['ahoge'].map(q => q[1])) - 3.5 : Infinity);
  return {back, mass: `<path d="${massD}" fill="${hairHex}"/>` + ring + `<path d="${massD}" fill="none" stroke="${INK}" stroke-width="4.6" stroke-linejoin="round"/>` + ahoge, locks: locksSvg, lockStroke: `<path d="${massD}"/>${lockUnion}`, lockShade, skinShade, polys, top: topInk - 0.5, clipDefs};
}

export interface FragmentOpts {
  /** false: leave out the nose, eyes, brows, mouth and blush; 'lines': only the line features (nose, brows, mouth, and the `^^` `><` dot eyes). The pixel tests compare with and without them. */
  features?: boolean | 'lines';
  /** draw the feature lines without their paper keyline (a negative control for the pixel tests) */
  noFeatureKeyline?: boolean;
  /** leave out one boundary keyline (the pixel tests check that each one changes the picture) */
  noKeyline?: 'hairFace' | 'faceNeck';
}
export interface Fragment {fragment: string; top: number; features: {eyes: Built[]; brows: Built[]; mouth: Built}}
/** One expression of one character, as an SVG fragment in the box's coordinates (shapes, groups, clip paths only). */
export function faceFragment(chIn: Character, expression: string, opts: FragmentOpts = {}): Fragment {
  const ch = normalize(chIn);
  const pr = PRESETS[expression];
  if (!pr) throw new Error(`unknown expression ${expression}`);
  const taken = new Set<string>([INK, PAPER, WHITE, MOUTH_IN, TONGUE, SHADE_ROSE, BLUSH]);
  const skin = nudge(pick(SKIN, ch.palette.skin), taken); taken.add(skin);
  const hairHex = nudge(pick(HAIR, ch.palette.hair), taken); taken.add(hairHex);
  const topHex = nudge(pick(TOP, ch.palette.top), taken); taken.add(topHex);
  const iris = nudge(pick(IRIS, ch.palette.iris), taken);
  const keyed = needsKeyline(skin) && !opts.noFeatureKeyline;
  // brows lie on the fringe, so they are keyed when the hair is dark (ink under 3:1 against it) as well as on a dark skin
  const browKeyed = !opts.noFeatureKeyline && (needsKeyline(skin) || needsKeyline(hairHex));
  const W = ch.head.cheek;
  const face = dOf(faceSegs(ch.head));
  const eye = resolveEye(ch.eyes, pr.eye);
  const eyeY = CY + ch.eyes.y, gap = ch.eyes.gap, mouthY = CY + ch.mouth.y;
  const hair = hairParts(ch.hair, W, hairHex);
  const ink46 = `fill="none" stroke="${INK}" stroke-width="4.6" stroke-linejoin="round"`;
  const bodyD = 'M20 360C20 292 64 262 118 252Q150 270 182 252C236 262 280 292 280 360Z';
  const body = `<path d="${bodyD}" fill="${topHex}" stroke="${INK}" stroke-width="4.6" stroke-linejoin="round"/><path d="M118 252Q${CX} 296 182 252" fill="none" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
  const neckD = `M${CX - 24} ${CY + 70}L${CX - 24} ${CY + 118}Q${CX} ${CY + 136} ${CX + 24} ${CY + 118}L${CX + 24} ${CY + 70}Z`;
  // face-neck keyline: the chin line gets a paper stroke, clipped to the neck itself (the face is painted over its inner half)
  const neck = `<clipPath id="nk"><path d="${neckD}"/></clipPath><path d="${neckD}" fill="${skin}"/>${over(`path d="${neckD}"`, SHADE_ROSE, 0.28)}<path d="${neckD}" ${ink46}/>`
    + (opts.noKeyline === 'faceNeck' ? '' : `<g clip-path="url(#nk)"><path d="${face}" fill="none" stroke="${PAPER}" stroke-width="8.6"/></g>`);
  const ears = [-1, 1].map(s => `<ellipse cx="${CX + s * W}" cy="${CY + 14}" rx="9" ry="15" fill="${skin}" stroke="${INK}" stroke-width="4"/>`).join('');
  const faceFill = `<clipPath id="fc"><path d="${face}"/></clipPath><path d="${face}" fill="${skin}"/><g clip-path="url(#fc)">${hair.skinShade}</g><path d="${face}" ${ink46}/>`;
  const F = opts.features !== false, lines = opts.features === 'lines';
  const nose = !F || ch.nose === 'none' ? '' : ch.nose === 'dot' ? inkLine(`M${CX - 3} ${CY + 44}q3 4 6 0`, 3.2, keyed) : inkLine(`M${CX - 2} ${CY + 38}l-3 8l6 0`, 3.2, keyed);
  const blush = F && !lines && pr.blush ? [-1, 1].map(s => [0, 1, 2].map(i => `<path d="M${n(CX + s * (W - 34) + i * 7 - 8)} ${CY + 54}l6 -10" fill="none" stroke="${BLUSH}" stroke-opacity="0.65" stroke-width="3" stroke-linecap="round"/>`).join('')).join('') : '';
  const eL = eyeSvg(eye, -1, CX - gap, eyeY, iris, 'el', keyed), eR = eyeSvg(eye, 1, CX + gap, eyeY, iris, 'er', keyed);
  const bL = browSvg(pr.brow, ch.brows.thick, -1, CX - gap, eyeY, ch.eyes.h, ch.brows.dy, browKeyed), bR = browSvg(pr.brow, ch.brows.thick, 1, CX + gap, eyeY, ch.eyes.h, ch.brows.dy, browKeyed);
  const mo = mouthSvg(pr.mouth, ch.mouth.w, mouthY, 'mo', keyed);
  // hair-face keyline: the edge of the mass and of every lock, on the face's side (paper | ink); the hair's own side is dark and has the ink line alone
  const keyHair = opts.noKeyline === 'hairFace' ? '' : `<clipPath id="kc"><path d="${face}"/></clipPath><g clip-path="url(#kc)" fill="none" stroke="${PAPER}" stroke-width="8.6" stroke-linejoin="round">${hair.lockStroke}</g>`;
  const lineEye = lines && !['arc', 'arcDown', 'cross', 'dot'].includes(eye.kind);
  const feat = nose + (lineEye ? '' : eL.svg + eR.svg) + mo.svg;
  const inner = hair.back + body + neck + ears + faceFill + blush + keyHair + hair.clipDefs + hair.mass + hair.locks + hair.lockShade + (F ? feat : '')
    // brows last: above the fringe (the see-through brow), in ink
    + (F ? bL.svg + bR.svg : '');
  const fragment = ch.mirror ? `<g transform="translate(300 0) scale(-1 1)">${inner}</g>` : inner;
  return {fragment, top: n(hair.top), features: {eyes: [eL, eR], brows: [bL, bR], mouth: mo}};
}

// ---- validation (ADR 0079 D2): the geometry that `loadCharacter` does not check. Returns the violations; empty means valid.
export function validate(chIn: Character, expressions: readonly string[] = ADR0074): string[] {
  const out: string[] = [];
  const ch = normalize(chIn);
  if (!Number.isInteger(chIn.hair.strands) || chIn.hair.strands < 1) out.push('hair.strands must be an integer >= 1');
  for (const k of Object.keys(RANGES) as RangeKey[]) { const v = get(chIn, k), [lo, hi] = RANGES[k]; if (!(v >= lo && v <= hi)) out.push(`${k}=${v} is outside ${lo}..${hi}`); }
  for (const slot of ['skin', 'hair', 'top', 'iris'] as const) {
    const table = {skin: SKIN, hair: HAIR, top: TOP, iris: IRIS}[slot] as Record<string, string>;
    const v = chIn.palette[slot];
    if (!(v in table) && !HEX.test(v)) out.push(`palette.${slot}=${JSON.stringify(v)} is neither a known key nor #rrggbb`);
  }
  if (out.some(x => x.startsWith('palette'))) return out;
  const face = flatten(faceSegs(ch.head));
  if (selfIntersects(face)) out.push('the face outline crosses itself');
  if (Math.max(...face.filter(p => p[1] > CY - 20).map(p => Math.sqrt((p[0] - CX) * (p[0] - CX) + (p[1] - CY) * (p[1] - CY)))) > HEAD_R + 0.5) out.push('the chin or cheek leaves the head circle');
  const hp = hairParts(ch.hair, ch.head.cheek, '#000000').polys;
  for (const [k, poly] of Object.entries(hp)) if (k !== 'ahoge' && selfIntersects(poly)) out.push(`hair ${k} crosses itself`);
  const eyeY = CY + ch.eyes.y;
  for (const e of expressions) {
    const f = faceFragment(chIn, e).features;
    const hw = (y: number) => faceHalfWidth(face, y);
    for (const b of f.eyes) {
      const far = Math.max(Math.abs(b.right - CX), Math.abs(b.left - CX)), near = Math.min(Math.abs(b.right - CX), Math.abs(b.left - CX));
      if (far > hw(eyeY) - 4) out.push(`${e}: an eye leaves the face (${n(far)} > ${n(hw(eyeY) - 4)})`);
      if (near < 4) out.push(`${e}: the eyes touch at the centre`);
    }
    f.brows.forEach((b, i) => { if (b.bottom > f.eyes[i]!.top + 1) out.push(`${e}: a brow reaches into its eye (${n(b.bottom)} > ${n(f.eyes[i]!.top + 1)})`); if (b.top < CY - 100) out.push(`${e}: a brow leaves the head`); });
    if (f.mouth.left < CX - hw(CY + ch.mouth.y) + 6 || f.mouth.right > CX + hw(CY + ch.mouth.y) - 6) out.push(`${e}: the mouth leaves the face`);
    if (f.mouth.bottom > CY + ch.head.chin - 4) out.push(`${e}: the mouth reaches the chin`);
    if (!(f.mouth.left <= CX && CX <= f.mouth.right)) out.push(`${e}: the mouth anchor x is outside the mouth`);
    if (f.mouth.top < eyeY + 20) out.push(`${e}: the mouth is too close to the eyes`);
  }
  return out;
}

// ---- the manifest
/** The manifest: every expression, anchors computed from the parameters. Throws, listing the violations, if the geometry is invalid. */
export function toManifest(chIn: Character, expressions: readonly ComicExpression[] = ADR0074, expressionMap: Partial<Record<ComicExpression, string>> = {}): CharacterManifest {
  for (const [k, v] of Object.entries(expressionMap)) if (EXTRA_OF[v!] !== k && v !== k) throw new Error(`expressionMap: ${v} cannot stand for ${k} (allowed: ${Object.entries(EXTRA_OF).filter(([, m]) => m === k).map(([e]) => e).join(', ') || 'none'})`);
  const names = expressions.map(e => expressionMap[e] ?? e);
  const bad = validate(chIn, names);
  if (bad.length) throw new Error(`manga-face: invalid character ${chIn.id}: ${bad.join('; ')}`);
  const ch = normalize(chIn);
  const built = expressions.map(e => [e, faceFragment(ch, expressionMap[e] ?? e)] as const);
  const top = Math.min(...built.map(([, b]) => b.top));
  const mouthX = ch.mirror ? 300 - CX : CX;
  return {
    id: ch.id, name: ch.name, box: [...BOX],
    anchors: {head: {cx: CX, cy: CY, r: HEAD_R}, mouth: [mouthX, CY + ch.mouth.y + 6], top: n(top)},
    bubbleSides: ['top-left', 'top', 'top-right'],
    expressions: Object.fromEntries(built.map(([k, v]) => [k, v.fragment])) as CharacterManifest['expressions'],
    license: {spdx: 'CC0-1.0', author: 'manga-face contributors', url: 'https://github.com/cuzic/manga-face'},
  };
}

// ---- the two directions of the look (ADR 0079 Q2). `young` is the round-eyed baseline. `mature`: a narrower face with a square chin, small eyes with a small iris, a thin upper lid and no lashes, short sides.
export const DIRECTIONS = {
  young: {head: {cheek: 86, chin: 96, jaw: 0.65, chinW: 4}, eyes: {w: 25, h: 23, tilt: 0, iris: 1, y: 20, gap: 42, lashes: true, lidW: 7}, brows: {thick: 6, dy: 0}, mouth: {w: 16, y: 64}, nose: 'dot'} satisfies Omit<Base, 'hair'>,
  mature: {head: {cheek: 76, chin: 98, jaw: 0.85, chinW: 14}, eyes: {w: 20, h: 15, tilt: 1, iris: 0.8, y: 27, gap: 37, lashes: false, lidW: 5.5}, brows: {thick: 5.5, dy: 2}, mouth: {w: 14, y: 68}, nose: 'line'} satisfies Omit<Base, 'hair'>,
};
const HAIR_YOUNG = {template: 'short', strands: 4, parting: 0.5, ahoge: 'none', highlight: true, sideLen: 36} as const;
const HAIR_MATURE = {template: 'short', strands: 5, parting: 0.5, ahoge: 'none', highlight: true, sideLen: 20} as const;
export const CHARACTERS = {
  a: {id: 'mf-a', name: '私', ...DIRECTIONS.young, hair: {...HAIR_YOUNG}, palette: {skin: 'fair', hair: 'brown', top: 'blue', iris: 'blue'}} satisfies Character,
  b: {id: 'mf-b', name: '同僚', ...DIRECTIONS.young, head: {cheek: 88, chin: 98, jaw: 0.7, chinW: 4}, nose: 'line', hair: {template: 'bob', strands: 6, parting: -0.5, ahoge: 'none', highlight: true, sideLen: 36}, palette: {skin: 'medium', hair: 'black', top: 'red', iris: 'brown'}, mirror: true} satisfies Character,
  m: {id: 'mf-m', name: '同僚(成熟)', ...DIRECTIONS.mature, hair: {...HAIR_MATURE}, palette: {skin: 'light', hair: 'chestnut', top: 'teal', iris: 'brown'}} satisfies Character,
};

// ---- seeded random characters. One sub-stream per field (xmur3(world : seed : field) -> mulberry32), so adding a field or a template keeps the others' values.
// The sampler draws inside the ranges AND the dependent constraints (`normalize` applies them), so most draws are valid at once; what still fails is repaired
// group by group (eyes, brows, mouth, head, hair) from `field#k` sub-streams, then from the young direction's defaults; the other groups keep their values.
const xmur3 = (str: string): number => { let h = 1779033703 ^ str.length; for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } h = Math.imul(h ^ (h >>> 16), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return (h ^= h >>> 16) >>> 0; };
const mulberry32 = (a: number): number => { let t = (a + 0x6d2b79f5) | 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
/** Bumped whenever the ranges, the dependent constraints, the sampler, `validate` or a preset changes. A seed is stable only within one generator version. */
export const GENERATOR = 2;
type Group = 'head' | 'eyes' | 'brows' | 'mouth' | 'hair';
const GROUPS: readonly Group[] = ['head', 'eyes', 'brows', 'mouth', 'hair'];
function drawGroup(seed: string, g: Group, k: number, cur: Character): Partial<Character> {
  const u = (field: string): number => mulberry32(xmur3(`${GENERATOR}:${seed}:${field}${k ? `#${k}` : ''}`));
  const lerp = (key: RangeKey, lo: number, hi: number): number => clamp(lo + (hi - lo) * u(key), RANGES[key]);
  switch (g) {
    case 'head': return {head: {cheek: lerp('head.cheek', 76, 90), chin: lerp('head.chin', 92, 98), jaw: clamp(0.6 + 0.25 * u('jaw'), RANGES['head.jaw']), chinW: lerp('head.chinW', 0, 12)}};
    case 'eyes': return {eyes: {w: lerp('eyes.w', 18, 26), h: lerp('eyes.h', 14, 24), tilt: lerp('eyes.tilt', -3, 4), iris: lerp('eyes.iris', 0.8, 1.1), y: 20, gap: clamp(38 + (cur.head.cheek - 74) / 8, RANGES['eyes.gap']), lashes: u('lashes') < 0.7, lidW: lerp('eyes.lidW', 5, 7)}};
    case 'brows': return {brows: {thick: lerp('brows.thick', 4, 7), dy: lerp('brows.dy', -4, 3)}};
    case 'mouth': return {mouth: {w: lerp('mouth.w', 14, 24), y: 64}};
    case 'hair': return {hair: {template: u('template') < 0.5 ? 'short' : 'bob', strands: clamp(3 + Math.floor(u('strands') * 5), RANGES['hair.strands']), parting: clamp(Math.round((u('parting') * 2 - 1) * 4) / 4, RANGES['hair.parting']), ahoge: u('ahoge') < 0.15 ? (u('ahogeSide') < 0.5 ? 'left' : 'right') : 'none', highlight: u('hl') < 0.8, sideLen: lerp('hair.sideLen', 20, 36)}};
  }
}
const groupOf = (violation: string): Group => /brow/.test(violation) ? 'brows' : /mouth/.test(violation) ? 'mouth' : /eye/.test(violation) ? 'eyes' : /hair/.test(violation) ? 'hair' : 'head';
export interface Drawn {character: Character; firstDrawValid: boolean; repaired: Group[]}
export function randomCharacterDetailed(seed: string | number, id = `mf-${seed}`): Drawn {
  const s = String(seed);
  const u = (f: string): number => mulberry32(xmur3(`${GENERATOR}:${s}:${f}`));
  const choose = <T extends object>(f: string, o: T): keyof T & string => (Object.keys(o) as (keyof T & string)[])[Math.floor(u(f) * Object.keys(o).length)]!;
  let ch = {id, name: s, nose: (['none', 'dot', 'line'] as const)[Math.floor(u('nose') * 3)]!, palette: {skin: choose('skin', SKIN), hair: choose('hairc', HAIR), top: choose('top', TOP), iris: choose('iris', IRIS)}} as Character;
  for (const g of GROUPS) ch = {...ch, ...drawGroup(s, g, 0, ch)} as Character;
  ch = normalize(ch);
  const first = validate(ch).length === 0;
  const repaired: Group[] = [];
  for (let k = 1; k <= 4 && validate(ch).length > 0; k++) {
    for (const g of new Set(validate(ch).map(groupOf))) { ch = normalize({...ch, ...drawGroup(s, g, k, ch)} as Character); repaired.push(g); }
  }
  for (const g of new Set(validate(ch).map(groupOf))) { ch = normalize({...ch, ...(g === 'hair' ? {hair: {...HAIR_YOUNG}} : {[g]: DIRECTIONS.young[g as 'head' | 'eyes' | 'brows' | 'mouth']})} as Character); repaired.push(g); }
  return {character: ch, firstDrawValid: first, repaired};
}
export const randomCharacter = (seed: string | number, id?: string): Character => randomCharacterDetailed(seed, id).character;
