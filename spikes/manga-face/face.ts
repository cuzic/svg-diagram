// Spike for ADR 0079: a parametric manga-style front face that outputs SVG fragments and a CharacterManifest. Pure: numbers in, strings out.
// Coordinates: the box is [0, -40, 300, 400]; the head centre is (150, 140); the face is 100 units from its centre to its top and about 98 to the chin.
import type {CharacterManifest, ComicExpression} from '../../lib/types/comic.ts';

export const CX = 150, CY = 140, HEAD_R = 100;
export const BOX = [0, -40, 300, 400] as const;
const r1 = (n: number): number => Math.round(n * 10) / 10;
const n = r1;

// ---- palette slots (compatible with ADR 0076 `recolor`: skin / hair / top) and the tones derived from them
const hex = (c: string): [number, number, number] => [1, 3, 5].map(i => Number.parseInt(c.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (v: number[]): string => `#${v.map(x => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join('')}`;
export const mix = (a: string, b: string, t: number): string => { const [p, q] = [hex(a), hex(b)]; return toHex(p.map((x, i) => x + (q[i]! - x) * t)); };
export interface Palette {skin: string; hair: string; top: string; iris: string}
export const INK = '#2b2530', PAPER = '#ffffff';
const tones = (p: Palette) => ({
  skin: p.skin, skinShade: mix(p.skin, '#c0707a', 0.28), blush: mix(p.skin, '#ee6f7a', 0.55),
  hair: p.hair, hairShade: mix(p.hair, INK, 0.45), hairLight: mix(p.hair, '#ffffff', 0.42),
  iris: p.iris, irisDark: mix(p.iris, INK, 0.55), irisGlow: mix(p.iris, '#ffffff', 0.5),
  top: p.top, topShade: mix(p.top, INK, 0.3),
});

// ---- parameters
export type EyeKind = 'open' | 'arc' | 'arcDown' | 'cross' | 'dot' | 'half';
export type MouthKind = 'flat' | 'smile' | 'open' | 'o' | 'frown' | 'wave' | 'omega' | 'grit' | 'tri';
export interface FaceShape {cheek: number; chin: number; jaw: number}
export interface EyeParams {kind: EyeKind; w: number; h: number; tilt: number; iris: number; lookX: number; lookY: number; highlights: 1 | 2; lashes: boolean}
export interface BrowParams {angle: number; thick: number; dy: number; raise: [number, number]}
export interface Preset {eye: EyeParams; brow: BrowParams; mouth: MouthKind; mouthW: number; blush: boolean}
export interface HairParams {template: 'short' | 'bob'; strands: number; parting: number; ahoge: boolean; highlight: boolean}
export interface Character {id: string; name: string; shape: FaceShape; hair: HairParams; palette: Palette; nose: 'none' | 'dot' | 'line'; mirror?: boolean}

const eye = (kind: EyeKind, o: Partial<EyeParams> = {}): EyeParams => ({kind, w: 25, h: 23, tilt: 0, iris: 1, lookX: 0, lookY: 0, highlights: 2, lashes: true, ...o});
const brow = (angle: number, o: Partial<BrowParams> = {}): BrowParams => ({angle, thick: 6, dy: 0, raise: [0, 0], ...o});
/** The 8 ADR 0074 expressions, then the extras (ADR 0079 D3). Each preset is eye + brow + mouth + (blush). */
export const PRESETS: Record<string, Preset> = {
  neutral: {eye: eye('open'), brow: brow(0), mouth: 'flat', mouthW: 16, blush: false},
  smile: {eye: eye('open', {h: 21, iris: 1.05}), brow: brow(-4, {dy: -2}), mouth: 'smile', mouthW: 26, blush: false},
  laugh: {eye: eye('arc', {w: 25}), brow: brow(-6, {dy: -8}), mouth: 'open', mouthW: 44, blush: true},
  surprise: {eye: eye('open', {w: 27, h: 28, iris: 0.62, highlights: 1}), brow: brow(-6, {dy: -14}), mouth: 'o', mouthW: 12, blush: false},
  worry: {eye: eye('open', {h: 21, tilt: -5, iris: 1.08}), brow: brow(-22, {thick: 5, dy: -2}), mouth: 'wave', mouthW: 24, blush: false},
  angry: {eye: eye('open', {h: 17, tilt: 9, iris: 0.82, highlights: 1}), brow: brow(24, {thick: 8, dy: 4}), mouth: 'grit', mouthW: 34, blush: false},
  think: {eye: eye('open', {h: 21, iris: 0.95, lookX: 7, lookY: -6}), brow: brow(-3, {raise: [0, 8]}), mouth: 'flat', mouthW: 12, blush: false},
  sad: {eye: eye('open', {h: 22, tilt: -7, iris: 1.12, highlights: 2}), brow: brow(-26, {thick: 5, dy: -1}), mouth: 'frown', mouthW: 22, blush: false},
  // extras (not in ADR 0074's list)
  shy: {eye: eye('open', {h: 19, tilt: -3, iris: 1.05, lookX: 5, lookY: 5}), brow: brow(-14, {dy: -2}), mouth: 'omega', mouthW: 22, blush: true},
  smug: {eye: eye('half', {h: 19, iris: 0.95}), brow: brow(6, {raise: [0, 5]}), mouth: 'omega', mouthW: 28, blush: false},
  deadpan: {eye: eye('half', {h: 17, iris: 0.9, highlights: 1}), brow: brow(2), mouth: 'flat', mouthW: 14, blush: false},
  clench: {eye: eye('cross', {w: 22}), brow: brow(18, {thick: 7}), mouth: 'tri', mouthW: 26, blush: false},
};
export const ADR0074: readonly ComicExpression[] = ['neutral', 'smile', 'laugh', 'surprise', 'worry', 'angry', 'think', 'sad'];

// ---- tiny path builder: points are given in a local frame, `s` mirrors x (-1: left of the face) around the origin (ox, oy)
type Pt = [number, number];
const P = (s: number, ox: number, oy: number) => (x: number, y: number): string => `${n(ox + s * x)} ${n(oy + y)}`;
const strokeAttr = (w: number, c = INK): string => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

function eyeSvg(e: EyeParams, s: -1 | 1, ex: number, ey: number, c: ReturnType<typeof tones>, id: string): string {
  const p = P(s, ex, ey);
  const {w: a, h: b} = e, oy = -e.tilt;
  if (e.kind === 'arc' || e.kind === 'arcDown') {
    const d = e.kind === 'arc' ? -1 : 1;
    return `<path d="M${p(-a, 3)}Q${p(0, 3 + d * b * 1.25)} ${p(a, 3)}" ${strokeAttr(6.5)}/>`;
  }
  if (e.kind === 'cross') {
    // >< : the two strokes meet at the inner side
    return `<path d="M${p(-a * 0.7, -b * 0.8)}L${p(a * 0.7, 0)}L${p(-a * 0.7, b * 0.8)}" ${strokeAttr(6)}/>`;
  }
  if (e.kind === 'dot') return `<ellipse cx="${n(ex)}" cy="${n(ey + 2)}" rx="${n(a * 0.34)}" ry="${n(b * 0.5)}" fill="${INK}"/>`;
  // open / half: the eye's outline (upper edge arches, lower edge is flatter), then the iris clipped to it
  const lid = e.kind === 'half' ? 0.45 : 1; // half-lidded: the upper lid comes down over the top of the iris
  const top = (y: number) => y * lid;
  const upper = `M${p(-a, 2)}C${p(-a * 0.7, top(-b * 1.2))} ${p(a * 0.35, top(-b * 1.3))} ${p(a, oy)}`;
  const lower = `C${p(a * 0.55, b * 0.85)} ${p(-a * 0.5, b * 0.95)} ${p(-a, 2)}Z`;
  const shape = upper + lower;
  const rx = a * 0.64 * e.iris, ry = Math.min(b * 0.98, b * 0.98 * e.iris), ix = e.lookX * s, iy = 3 + e.lookY;
  const iyc = (n0: number) => n(ey + iy + n0);
  const hi = `<ellipse cx="${n(ex + s * (ix - rx * 0.3))}" cy="${iyc(-ry * 0.38)}" rx="${n(rx * 0.3)}" ry="${n(ry * 0.26)}" fill="${PAPER}"/>`
    + (e.highlights === 2 ? `<circle cx="${n(ex + s * (ix + rx * 0.38))}" cy="${iyc(ry * 0.42)}" r="${n(rx * 0.13)}" fill="${PAPER}"/>` : '');
  const lashLine = e.lashes ? `<path d="M${p(a + 1, oy - 1)}L${p(a + 11, oy - 9 - Math.max(0, e.tilt) * 0.2)}L${p(a - 5, oy - 4)}Z" fill="${INK}"/>` : '';
  const lidY = e.kind === 'half' ? `<path d="M${p(-a - 1, 2)}C${p(-a * 0.7, -b * 0.55)} ${p(a * 0.35, -b * 0.58)} ${p(a + 1, oy)}" ${strokeAttr(7)}/>` : `<path d="${upper}" ${strokeAttr(7)}/>`;
  return `<clipPath id="${id}"><path d="${shape}"/></clipPath>`
    + `<path d="${shape}" fill="${PAPER}"/>`
    + `<g clip-path="url(#${id})"><ellipse cx="${n(ex + s * ix)}" cy="${iyc(0)}" rx="${n(rx)}" ry="${n(ry)}" fill="${c.irisDark}"/>`
    + `<ellipse cx="${n(ex + s * ix)}" cy="${iyc(ry * 0.3)}" rx="${n(rx * 0.86)}" ry="${n(ry * 0.62)}" fill="${c.iris}"/>`
    + `<ellipse cx="${n(ex + s * ix)}" cy="${iyc(ry * 0.52)}" rx="${n(rx * 0.55)}" ry="${n(ry * 0.3)}" fill="${c.irisGlow}"/>`
    + `<ellipse cx="${n(ex + s * ix)}" cy="${iyc(-ry * 0.05)}" rx="${n(rx * 0.42)}" ry="${n(ry * 0.5)}" fill="${INK}"/>${hi}`
    + `<path d="${upper}" fill="none" stroke="${c.irisDark}" stroke-width="0"/></g>`
    + lidY + lashLine
    + `<path d="M${p(a * 0.9, 1)}C${p(a * 0.55, b * 0.8)} ${p(-a * 0.2, b * 0.95)} ${p(-a * 0.6, b * 0.7)}" ${strokeAttr(2.4)}/>`;
}

function browSvg(bp: BrowParams, s: -1 | 1, ex: number, ey: number, c: ReturnType<typeof tones>, b: number): string {
  const len = 36, y0 = ey - b - 16 + bp.dy - (s === 1 ? bp.raise[1] : bp.raise[0]);
  // inner end is nearer the face centre; positive angle = inner end lower (angry), negative = inner end higher (worried)
  const rad = bp.angle * Math.PI / 180, dx = Math.cos(rad) * len / 2, dy = Math.sin(rad) * len / 2;
  const ix = ex - s * dx, iy = y0 + dy, ox = ex + s * dx, oy = y0 - dy;
  const t = bp.thick / 2, mx = (ix + ox) / 2, my = (iy + oy) / 2 - 4;
  return `<path d="M${n(ix)} ${n(iy - t)}Q${n(mx)} ${n(my - t)} ${n(ox)} ${n(oy)}Q${n(mx)} ${n(my + t)} ${n(ix)} ${n(iy + t)}Z" fill="${c.hairShade}" stroke="${c.hairShade}" stroke-width="1.5" stroke-linejoin="round"/>`;
}

function mouthSvg(kind: MouthKind, w: number, y: number, c: ReturnType<typeof tones>, id: string): string {
  const h = w / 2, x = CX;
  const st = (d: string, sw = 3.6) => `<path d="${d}" ${strokeAttr(sw)}/>`;
  const MOUTH = '#8a3340', TONGUE = '#ee7f8c';
  switch (kind) {
    case 'flat': return st(`M${n(x - h)} ${n(y)}Q${x} ${n(y + 3)} ${n(x + h)} ${n(y)}`);
    case 'smile': return st(`M${n(x - h)} ${n(y - 3)}Q${x} ${n(y + 12)} ${n(x + h)} ${n(y - 3)}`) ;
    case 'frown': return st(`M${n(x - h)} ${n(y + 6)}Q${x} ${n(y - 8)} ${n(x + h)} ${n(y + 6)}`);
    case 'wave': return st(`M${n(x - h)} ${n(y + 2)}q${n(h / 2)} -8 ${n(h)} 0t${n(h)} 0`);
    case 'omega': return st(`M${n(x - h)} ${n(y - 2)}q${n(h / 2)} 12 ${n(h)} 0q${n(h / 2)} 12 ${n(h)} 0`, 3.4);
    case 'o': return `<ellipse cx="${x}" cy="${n(y + 4)}" rx="${n(h * 0.85)}" ry="${n(h * 1.15)}" fill="${MOUTH}" stroke="${INK}" stroke-width="3.6"/>`;
    case 'open': {
      const d = `M${n(x - h)} ${n(y - 6)}Q${x} ${n(y - 2)} ${n(x + h)} ${n(y - 6)}Q${n(x + h * 0.7)} ${n(y + 30)} ${x} ${n(y + 30)}Q${n(x - h * 0.7)} ${n(y + 30)} ${n(x - h)} ${n(y - 6)}Z`;
      return `<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${MOUTH}"/><g clip-path="url(#${id})"><ellipse cx="${x}" cy="${n(y + 28)}" rx="${n(h * 0.6)}" ry="11" fill="${TONGUE}"/></g>`
        + `<path d="${d}" ${strokeAttr(3.6)}/>`;
    }
    case 'grit': return `<path d="M${n(x - h)} ${n(y + 2)}Q${x} ${n(y - 6)} ${n(x + h)} ${n(y + 2)}L${n(x + h * 0.8)} ${n(y + 16)}Q${x} ${n(y + 10)} ${n(x - h * 0.8)} ${n(y + 16)}Z" fill="${PAPER}" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/>`
      + st(`M${n(x - h * 0.3)} ${n(y - 1)}v${n(10)}M${n(x + h * 0.3)} ${n(y - 1)}v${n(10)}`, 2.2);
    case 'tri': return `<path d="M${n(x - h)} ${n(y)}L${n(x + h)} ${n(y)}L${x} ${n(y + 20)}Z" fill="${MOUTH}" stroke="${INK}" stroke-width="3.6" stroke-linejoin="round"/>`;
  }
  return c.skin;
}

function facePath(sh: FaceShape): {d: string; chinY: number} {
  const W = sh.cheek, H = sh.chin, j = sh.jaw;
  const ty = CY - 14, chinY = CY + H;
  const right = (s: number): string => {
    const c1 = `${n(CX + s * W)} ${n(ty + (H + 14) * (0.38 + 0.3 * j))}`;
    const c2 = `${n(CX + s * W * (0.62 * j + 0.12))} ${n(chinY - 4 - 2 * j)}`;
    return `${c1} ${c2}`;
  };
  // from the left temple down to the chin, up the right side, and over the skull
  const d = `M${n(CX - W)} ${n(ty)}C${right(-1)} ${CX} ${n(chinY)}C${right(1).split(' ').slice(2).join(' ')} ${right(1).split(' ').slice(0, 2).join(' ')} ${n(CX + W)} ${n(ty)}`;
  return {d: `${d}C${n(CX + W)} ${n(CY - 80)} ${n(CX + 64)} ${n(CY - 104)} ${CX} ${n(CY - 104)}C${n(CX - 64)} ${n(CY - 104)} ${n(CX - W)} ${n(CY - 80)} ${n(CX - W)} ${n(ty)}Z`, chinY};
}

/** The hair, in two layers: `back` (behind the body) and `front` (over the face). Strand tips are computed from the strand count and the parting. */
function hairSvg(h: HairParams, W: number, c: ReturnType<typeof tones>, id: string): {back: string; front: string; top: number} {
  const Wh = W + 6, n0 = h.strands;
  const part = h.parting * W * 0.5; // x of the parting
  const tips: Pt[] = [];
  const span = W - 8; // the bangs run from +span to -span
  for (let i = 0; i < n0; i++) {
    const t = n0 === 1 ? 0.5 : i / (n0 - 1), x0 = CX + span - 2 * span * t;
    // strands lean away from the parting; the hairline is high near the parting and low away from it
    const away = Math.min(1, Math.abs(x0 - (CX + part)) / (span * 1.2));
    const x = x0 + Math.sign(x0 - (CX + part)) * 4 * away;
    tips.push([x, CY - 52 + 34 * (0.2 + 0.8 * away) + (i % 2 === 0 ? 0 : -5)]);
  }
  const lockLen = h.template === 'bob' ? 112 : 36;
  const outerSide = (s: -1 | 1) => n(CX + s * (Wh + (h.template === 'bob' ? 8 : 3)));
  const innerSide = (s: -1 | 1) => n(CX + s * (W - (h.template === 'bob' ? 6 : 12)));
  const d = `M${outerSide(1)} ${n(CY + lockLen)}L${n(CX + Wh + 4)} ${n(CY + 4)}C${n(CX + Wh + 12)} ${n(CY - 64)} ${n(CX + 70)} ${n(CY - 114)} ${CX} ${n(CY - 114)}`
    + `C${n(CX - 70)} ${n(CY - 114)} ${n(CX - Wh - 12)} ${n(CY - 70)} ${n(CX - Wh - 4)} ${n(CY + 4)}L${outerSide(-1)} ${n(CY + lockLen)}`
    + `Q${n(CX - W - 2)} ${n(CY + lockLen + 6)} ${innerSide(-1)} ${n(CY + lockLen - 24)}L${n(CX - W + 6)} ${n(CY - 2)}`
    + bangsLtoRPath(tips) + `L${innerSide(1)} ${n(CY + lockLen - 24)}Q${n(CX + W + 2)} ${n(CY + lockLen + 6)} ${outerSide(1)} ${n(CY + lockLen)}Z`;
  // strands: short ink lines from each valley upward, and a highlight band
  const strands = tips.slice(0, -1).map((t, i) => { const u = tips[i + 1]!; const vx = (t[0] + u[0]) / 2; return `M${n(vx)} ${n(Math.min(t[1], u[1]) - 6)}q${n((t[0] - u[0]) * 0.1)} -14 ${n((t[0] - u[0]) * 0.2)} -24`; }).join('');
  const band = h.highlight ? `<path d="M${n(CX - 62)} ${n(CY - 86)}Q${n(CX - 14)} ${n(CY - 112)} ${n(CX + 38)} ${n(CY - 100)}" ${strokeAttr(9, c.hairLight)}/>` : '';
  const shadeEdge = `<path d="M${n(CX - span)} ${n(CY - 8)}${bangsLtoRPath(tips)}" ${strokeAttr(16, c.hairShade)}/>`;
  const ahoge = h.ahoge ? `<path d="M${n(CX + 6)} ${n(CY - 110)}C${n(CX - 22)} ${n(CY - 132)} ${n(CX + 18)} ${n(CY - 144)} ${n(CX + 2)} ${n(CY - 160)}" ${strokeAttr(7, INK)}/><path d="M${n(CX + 6)} ${n(CY - 110)}C${n(CX - 22)} ${n(CY - 132)} ${n(CX + 18)} ${n(CY - 144)} ${n(CX + 2)} ${n(CY - 160)}" ${strokeAttr(3.4, c.hair)}/>` : '';
  const frontSvg = `${ahoge}<clipPath id="${id}"><path d="${d}"/></clipPath><path d="${d}" fill="${c.hair}"/><g clip-path="url(#${id})">${shadeEdge}${band}<path d="${strands}" ${strokeAttr(2.4, c.hairShade)}/></g><path d="${d}" ${strokeAttr(4.6)}/>`;
  const back = h.template === 'bob'
    ? `<path d="M${n(CX - W - 10)} ${n(CY - 20)}C${n(CX - W - 26)} ${n(CY + 60)} ${n(CX - W - 20)} ${n(CY + 120)} ${n(CX - W + 2)} ${n(CY + 140)}Q${CX} ${n(CY + 158)} ${n(CX + W - 2)} ${n(CY + 140)}C${n(CX + W + 20)} ${n(CY + 120)} ${n(CX + W + 26)} ${n(CY + 60)} ${n(CX + W + 10)} ${n(CY - 20)}Z" fill="${c.hairShade}" stroke="${INK}" stroke-width="4.6" stroke-linejoin="round"/>`
    : '';
  return {back, front: frontSvg, top: h.ahoge ? CY - 160 - 4 : CY - 114 - 3};
}
function bangsLtoRPath(tips: Pt[]): string {
  const pts = [...tips].reverse();
  let d = `L${n(pts[0]![0])} ${n(pts[0]![1])}`;
  for (let i = 1; i < pts.length; i++) { const a = pts[i - 1]!, b = pts[i]!; d += `Q${n((a[0] + b[0]) / 2)} ${n(Math.min(a[1], b[1]) - 16)} ${n(b[0])} ${n(b[1])}`; }
  return d;
}

export interface Built {fragment: string; top: number}
/** One expression of one character, as an SVG fragment in the box's coordinates (shapes, groups, clip paths only). */
export function faceFragment(ch: Character, expression: string): Built {
  const pr = PRESETS[expression];
  if (!pr) throw new Error(`unknown expression ${expression}`);
  const c = tones(ch.palette);
  const {d: face} = facePath(ch.shape);
  const W = ch.shape.cheek;
  const eyeY = CY + 20, gap = 42 + (W - 84) * 0.2, b = pr.eye.h;
  const mouthY = CY + 64;
  const hair = hairSvg(ch.hair, W, c, 'hc');
  const body = `<path d="M20 360C20 292 64 262 118 252Q${CX} 270 182 252C236 262 280 292 280 360Z" fill="${c.top}" stroke="${INK}" stroke-width="4.6" stroke-linejoin="round"/>`
    + `<path d="M118 252Q${CX} 296 182 252" ${strokeAttr(3.4)}/>`;
  const neck = `<path d="M${CX - 24} ${CY + 70}L${CX - 24} ${CY + 118}Q${CX} ${CY + 136} ${CX + 24} ${CY + 118}L${CX + 24} ${CY + 70}Z" fill="${c.skin}" stroke="${INK}" stroke-width="4.6" stroke-linejoin="round"/>`
    + `<path d="M${CX - 22} ${CY + 76}L${CX - 22} ${CY + 112}Q${CX} ${CY + 120} ${CX + 22} ${CY + 112}L${CX + 22} ${CY + 76}Z" fill="${c.skinShade}"/>`
    + `<path d="M${CX - 24} ${CY + 118}Q${CX} ${CY + 136} ${CX + 24} ${CY + 118}" ${strokeAttr(4.6)}/>`;
  const ears = [-1, 1].map(s => `<ellipse cx="${CX + s * W}" cy="${CY + 14}" rx="9" ry="15" fill="${c.skin}" stroke="${INK}" stroke-width="4"/>`).join('');
  const faceFill = `<clipPath id="fc"><path d="${face}"/></clipPath><path d="${face}" fill="${c.skin}"/>`
    // cel shade: a soft shadow band under the bangs, and the jaw side
    + `<g clip-path="url(#fc)"><path d="${hair.front.match(/d="([^"]+)"/)?.[1] ?? ''}" fill="${c.skinShade}" transform="translate(0 9)"/></g>`
    + `<path d="${face}" ${strokeAttr(4.6)}/>`;
  const nose = ch.nose === 'none' ? '' : ch.nose === 'dot'
    ? `<path d="M${CX - 3} ${CY + 44}q3 4 6 0" ${strokeAttr(3, c.hairShade)}/>`
    : `<path d="M${CX - 2} ${CY + 38}l-3 8l6 0" ${strokeAttr(2.8, c.hairShade)}/>`;
  const blush = pr.blush ? [-1, 1].map(s => [0, 1, 2].map(i => `<path d="M${n(CX + s * (W - 34) + i * 7 - 8)} ${CY + 54}l6 -10" ${strokeAttr(3, c.blush)}/>`).join('')).join('') : '';
  const eyes = eyeSvg(pr.eye, -1, CX - gap, eyeY, c, 'el') + eyeSvg(pr.eye, 1, CX + gap, eyeY, c, 'er');
  const brows = browSvg(pr.brow, -1, CX - gap, eyeY, c, b) + browSvg(pr.brow, 1, CX + gap, eyeY, c, b);
  const inner = hair.back + body + neck + ears + faceFill + blush + nose + eyes + brows + mouthSvg(pr.mouth, pr.mouthW, mouthY, c, 'mo') + hair.front;
  const fragment = ch.mirror ? `<g transform="translate(300 0) scale(-1 1)">${inner}</g>` : inner;
  return {fragment, top: hair.top};
}

/** The manifest: every expression of the character, the anchors computed from its parameters (the head circle is fixed; `top` comes from the hair). */
export function toManifest(ch: Character, expressions: readonly string[] = ADR0074): CharacterManifest {
  const built = Object.fromEntries(expressions.map(e => [e, faceFragment(ch, e)]));
  const top = Math.min(...Object.values(built).map(b => b.top));
  const mouthX = ch.mirror ? 300 - CX : CX;
  return {
    id: ch.id, name: ch.name, box: [...BOX],
    anchors: {head: {cx: CX, cy: CY, r: HEAD_R}, mouth: [mouthX, CY + 70], top: r1(top)},
    bubbleSides: ['top-left', 'top', 'top-right'],
    expressions: Object.fromEntries(Object.entries(built).map(([k, v]) => [k, v.fragment])) as CharacterManifest['expressions'],
    license: {spdx: 'CC0-1.0', author: 'svg-diagram contributors (spike, original artwork)', url: 'https://github.com/cuzic/svg-diagram'},
  };
}

export const CHARACTERS = {
  a: {id: 'mf-a', name: '私', shape: {cheek: 86, chin: 96, jaw: 0.45}, hair: {template: 'short', strands: 5, parting: 0.5, ahoge: true, highlight: true}, palette: {skin: '#fde0cc', hair: '#5a4034', top: '#5b7fb8', iris: '#5e8fc4'}, nose: 'dot'} satisfies Character,
  b: {id: 'mf-b', name: '同僚', shape: {cheek: 88, chin: 98, jaw: 0.55}, hair: {template: 'bob', strands: 6, parting: -0.4, ahoge: false, highlight: true}, palette: {skin: '#e9b98f', hair: '#2d2a3c', top: '#c9657a', iris: '#8a5a3a'}, nose: 'line', mirror: true} satisfies Character,
};
