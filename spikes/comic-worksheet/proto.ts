// ADR 0074 spike: a throw-away prototype of comic() / bubble() / a parametric face / fill-in slots / a geometry map.
// Not part of lib/. It draws a 1x4 comic from meaning-first data (template + slot values) with a given text measurer, and
// answers: does wrapping fit, does filling a slot move anything, how big is the geometry map.
import {splitAtoms} from '../../lib/atoms.ts';
import {wrapStyledAtoms} from '../../lib/wrap.ts';

export type Widths = (text: string, size: number, weight?: number) => number;
export type Face = 'neutral' | 'smile' | 'laugh' | 'surprise' | 'worry' | 'angry' | 'think' | 'sad';
export interface SlotDef {max: number; prompt?: string; fallback?: string}
export interface Line {speaker: string; kind: 'say' | 'think' | 'shout' | 'narration'; tpl: string; slots?: Record<string, SlotDef>}
export interface Char {id: string; side: 'left' | 'right'; face: Face; hue: number}
export interface Panel {id: string; chars: Char[]; lines: Line[]}
export interface Worksheet {panels: Panel[]}
export type Values = Record<string, string | null | undefined>; // undefined: empty, null: skipped, string: filled
export interface Rect {x: number; y: number; w: number; h: number}
export interface Geometry {panels: Record<string, Rect>; bubbles: Record<string, Rect>; slots: Record<string, Rect>; heads: Record<string, Rect & {mouth: [number, number]}>}
export interface Finding {rule: string; where: string; message: string}

// ---- constants (the 4px grid is kept: every coordinate below is a multiple of 4 or comes from a measure)
const PW = 420, PH = 300, GUT = 16, MARGIN = 16, BADGE = 24;
const FONT = 18, LH = 26, PAD_X = 12, PAD_Y = 10, INNER_MAX = 162, HEAD_R = 36, HEAD_CY = PH - 76, SLOT_FONT = 14, SLOT_FLOOR = 14;
const KIND_STYLE = {say: 'oval', think: 'cloud', shout: 'spiky', narration: 'box'} as const;

type Seg = {lit: string} | {slot: string};
const segs = (tpl: string): Seg[] => tpl.split(/(\{[A-Za-z_][\w-]*\})/).filter(Boolean).map(s => /^\{.+\}$/.test(s) ? {slot: s.slice(1, -1)} : {lit: s});

interface Atom {text: string; slot?: string; w: number}
interface LaidLine {atoms: Atom[]; w: number}

/** Wrap the template with every slot reserved at its maximum width (max full-width characters), the slot an unbreakable unit. */
function reserve(line: Line, widths: Widths): LaidLine[] {
  const atoms: Atom[] = [];
  for (const s of segs(line.tpl)) {
    if ('slot' in s) { const d = line.slots?.[s.slot]; atoms.push({text: `{${s.slot}}`, slot: s.slot, w: (d?.max ?? 4) * FONT}); }
    else for (const a of splitAtoms(s.lit)) atoms.push({text: a, w: Math.round(widths(a, FONT))}); // whole px: HarfBuzz says 16, Chromium 16.0156 for the same character, and a ceil to the 4px grid flips on that
  }
  return wrapStyledAtoms(atoms, {maxWidth: INNER_MAX, atomWidth: a => a.w, mode: 'char'}).map(l => ({atoms: l, w: l.reduce((s, a) => s + a.w, 0)}));
}

const rectHitsCircle = (r: Rect, cx: number, cy: number, rad: number): boolean => { const dx = Math.max(r.x - cx, 0, cx - (r.x + r.w)), dy = Math.max(r.y - cy, 0, cy - (r.y + r.h)); return dx * dx + dy * dy < rad * rad; };
const f1 = (n: number) => Math.round(n * 10) / 10;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** A parametric face: eyes / brows / mouth drawn from numbers; hue is the hair. Deterministic, no asset. */
function face(kind: Face, cx: number, cy: number, r: number, hue: number): string {
  const ex = r * 0.36, ey = cy - r * 0.08, S = r / 36;
  const eye = (sx: number): string => {
    const x = cx + sx * ex;
    switch (kind) {
      case 'laugh': case 'smile': return `<path d="M${f1(x - 5 * S)} ${f1(ey + 2 * S)}q${f1(5 * S)} ${f1(-8 * S)} ${f1(10 * S)} 0" fill="none" stroke="#222" stroke-width="2.5" stroke-linecap="round"/>`;
      case 'surprise': return `<circle cx="${f1(x)}" cy="${f1(ey)}" r="${f1(5.5 * S)}" fill="#fff" stroke="#222" stroke-width="2"/><circle cx="${f1(x)}" cy="${f1(ey)}" r="${f1(2 * S)}" fill="#222"/>`;
      case 'sad': case 'worry': return `<circle cx="${f1(x)}" cy="${f1(ey + 1)}" r="${f1(3.2 * S)}" fill="#222"/>`;
      default: return `<circle cx="${f1(x)}" cy="${f1(ey)}" r="${f1(3.4 * S)}" fill="#222"/>`;
    }
  };
  const brow = (sx: number): string => {
    const x = cx + sx * ex, y = ey - 10 * S;
    const tilt = kind === 'angry' ? sx * 5 : kind === 'worry' || kind === 'sad' ? -sx * 5 : kind === 'surprise' ? -4 : 0;
    const lift = kind === 'surprise' ? -4 : 0;
    return `<path d="M${f1(x - 6 * S)} ${f1(y + lift - tilt * S / 2)}L${f1(x + 6 * S)} ${f1(y + lift + tilt * S / 2)}" stroke="#222" stroke-width="2.4" stroke-linecap="round"/>`;
  };
  const my = cy + r * 0.42;
  const mouth = ({
    neutral: `<path d="M${f1(cx - 6 * S)} ${f1(my)}h${f1(12 * S)}" stroke="#222" stroke-width="2.4" stroke-linecap="round"/>`,
    smile: `<path d="M${f1(cx - 9 * S)} ${f1(my - 2)}q${f1(9 * S)} ${f1(9 * S)} ${f1(18 * S)} 0" fill="none" stroke="#222" stroke-width="2.4" stroke-linecap="round"/>`,
    laugh: `<path d="M${f1(cx - 10 * S)} ${f1(my - 3)}h${f1(20 * S)}a${f1(10 * S)} ${f1(10 * S)} 0 0 1 ${f1(-20 * S)} 0z" fill="#b33" stroke="#222" stroke-width="2"/>`,
    surprise: `<ellipse cx="${f1(cx)}" cy="${f1(my + 1)}" rx="${f1(4.5 * S)}" ry="${f1(6 * S)}" fill="#b33" stroke="#222" stroke-width="2"/>`,
    worry: `<path d="M${f1(cx - 7 * S)} ${f1(my + 3)}q${f1(3.5 * S)} ${f1(-5 * S)} ${f1(7 * S)} 0t${f1(7 * S)} 0" fill="none" stroke="#222" stroke-width="2.2" stroke-linecap="round"/>`,
    angry: `<path d="M${f1(cx - 8 * S)} ${f1(my + 3)}q${f1(8 * S)} ${f1(-7 * S)} ${f1(16 * S)} 0" fill="none" stroke="#222" stroke-width="2.4" stroke-linecap="round"/>`,
    think: `<path d="M${f1(cx - 5 * S)} ${f1(my)}h${f1(10 * S)}" stroke="#222" stroke-width="2.4" stroke-linecap="round"/><circle cx="${f1(cx + 9 * S)}" cy="${f1(my - 1)}" r="1.6" fill="#222"/>`,
    sad: `<path d="M${f1(cx - 7 * S)} ${f1(my + 4)}q${f1(7 * S)} ${f1(-8 * S)} ${f1(14 * S)} 0" fill="none" stroke="#222" stroke-width="2.4" stroke-linecap="round"/>`,
  } satisfies Record<Face, string>)[kind];
  const hair = `hsl(${hue} 35% 28%)`;
  return `<g data-face="${kind}"><circle cx="${cx}" cy="${cy}" r="${r}" fill="#ffe3c8" stroke="#222" stroke-width="2.5"/>`
    + `<path d="M${cx - r} ${f1(cy - r * 0.15)}A${r} ${r} 0 0 1 ${cx + r} ${f1(cy - r * 0.15)}Q${cx} ${f1(cy - r * 0.62)} ${cx - r} ${f1(cy - r * 0.15)}z" fill="${hair}"/>`
    + brow(-1) + brow(1) + eye(-1) + eye(1) + mouth + '</g>';
}

const body = (cx: number, hue: number): string => `<path d="M${cx - 56} ${PH}c0 -34 20 -50 56 -50s56 16 56 50z" fill="hsl(${hue} 45% 62%)" stroke="#222" stroke-width="2.5"/>`;

export interface Laid {
  svg: (values: Values) => string;
  geometry: Geometry;
  width: number; height: number;
  findings: Finding[];
  /** what the fast path re-measures: only the filled values */
  slotIds: string[];
  /** value-dependent findings only (a value wider than its blank at the font floor); the geometry never depends on values */
  valueFindings: (v: Values) => Finding[];
}

export function layoutComic(ws: Worksheet, widths: Widths): Laid {
  const W = PW + 2 * MARGIN, H = MARGIN + ws.panels.length * (PH + GUT) - GUT + MARGIN;
  const geo: Geometry = {panels: {}, bubbles: {}, slots: {}, heads: {}};
  const findings: Finding[] = [];
  const parts: ((v: Values) => string)[] = [];
  const slotIds: string[] = [];
  const blanks: {id: string; w: number}[] = [];
  ws.panels.forEach((p, pi) => {
    const px = MARGIN, py = MARGIN + pi * (PH + GUT);
    geo.panels[p.id] = {x: px, y: py, w: PW, h: PH};
    const heads = new Map<string, {x: number; y: number; hue: number; face: Face}>();
    for (const c of p.chars) {
      const cx = px + (c.side === 'left' ? 104 : PW - 104), cy = py + HEAD_CY;
      heads.set(c.id, {x: cx, y: cy, hue: c.hue, face: c.face});
      geo.heads[`${p.id}.${c.id}`] = {x: cx - HEAD_R, y: cy - HEAD_R, w: 2 * HEAD_R, h: 2 * HEAD_R, mouth: [cx, f1(cy + HEAD_R * 0.42)]};
    }
    parts.push(() => `<g data-panel="${p.id}"><rect x="${px}" y="${py}" width="${PW}" height="${PH}" fill="#fffdf6" stroke="#222" stroke-width="3"/>`
      + `<rect x="${px}" y="${py}" width="${BADGE}" height="${BADGE}" fill="#222"/><text x="${px + BADGE / 2}" y="${py + 17}" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">${pi + 1}</text>`
      + [...heads.values()].map(h => body(h.x, h.hue)).join('') + [...heads.values()].map(h => face(h.face, h.x, h.y, HEAD_R, h.hue)).join('') + '</g>');
    // bubbles: row r (0,1) from the top of the panel, centred over the speaker, clamped inside the panel
    const placed: Rect[] = [];
    p.lines.forEach((ln, li) => {
      const bid = `${p.id}.b${li}`;
      const laid = reserve(ln, widths);
      const iw = Math.max(...laid.map(l => l.w)), ih = laid.length * LH;
      const oval = KIND_STYLE[ln.kind] !== 'box';
      const bw = Math.ceil((iw + 2 * PAD_X) / 4) * 4, bh = Math.ceil((ih + 2 * PAD_Y) / 4) * 4; // a rounded rectangle (rx <= 24), so the text rectangle needs no sqrt(2) margin
      const sp = heads.get(ln.speaker);
      const cxWant = sp ? sp.x : px + PW / 2;
      const bx = Math.round(Math.min(Math.max(cxWant - bw / 2, px + 8), px + PW - 8 - bw) / 4) * 4;
      // reading order = line order; a bubble goes to the top of the panel, or under the earlier bubbles it shares columns with
      const by = Math.max(py + 16, ...placed.filter(q => q.x < bx + bw + 6 && bx < q.x + q.w + 6).map(q => q.y + q.h + 6));
      placed.push({x: bx, y: by, w: bw, h: bh});
      geo.bubbles[bid] = {x: bx, y: by, w: bw, h: bh};
      for (const [hid, h] of heads) if (rectHitsCircle({x: bx, y: by, w: bw, h: bh}, h.x, h.y, HEAD_R + 4)) findings.push({rule: 'bubble-overlaps-face', where: bid, message: `bubble covers the head of ${hid}`});
      const nSlots = new Set(laid.flatMap(l => l.atoms.filter(a => a.slot).map(a => a.slot))).size;
      if (nSlots > 2) findings.push({rule: 'slots-per-panel', where: bid, message: `${nSlots} slots in one bubble`});
      // text block, left-aligned inside the inner rect, centred as a block
      const tx0 = bx + (bw - iw) / 2, ty0 = by + (bh - ih) / 2;
      const slotRects: {id: string; r: Rect; def: SlotDef}[] = [];
      const pieces: {x: number; y: number; text: string}[] = [];
      laid.forEach((l, i) => { let x = tx0 + (iw - l.w) / 2; for (const a of l.atoms) {
        if (a.slot) { const r = {x: f1(x), y: f1(ty0 + i * LH + 2), w: a.w, h: LH - 4}; geo.slots[a.slot] = r; slotIds.push(a.slot); blanks.push({id: a.slot, w: a.w}); slotRects.push({id: a.slot, r, def: ln.slots?.[a.slot] ?? {max: 4}}); }
        else pieces.push({x: f1(x), y: f1(ty0 + i * LH + 19), text: a.text});
        x += a.w; } });
      // tail aims at the speaker's mouth: the ray from the bubble centre to the mouth anchor, the tip stopping 6px outside the head circle
      let tail = '';
      if (sp && ln.kind !== 'narration') {
        const m = geo.heads[`${p.id}.${ln.speaker}`]!.mouth, bcx = bx + bw / 2, bcy = by + bh / 2;
        const dx = m[0] - bcx, dy = m[1] - bcy, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
        // distance from the head centre along the ray back toward the bubble where it leaves the head circle + 6
        const hx = sp.x - bcx, hy = sp.y - bcy; const proj = hx * ux + hy * uy, perp = Math.hypot(hx - proj * ux, hy - proj * uy);
        const tipT = proj - Math.sqrt(Math.max(HEAD_R * HEAD_R - perp * perp, 0)) - 6;
        const tip: [number, number] = [f1(bcx + ux * tipT), f1(bcy + uy * tipT)];
        const edgeT = Math.min(bw / 2 / Math.abs(ux || 1e-9), bh / 2 / Math.abs(uy || 1e-9));
        const nx = -uy, ny = ux, base: [number, number] = [bcx + ux * edgeT * 0.8, bcy + uy * edgeT * 0.8];
        tail = `<path d="M${f1(base[0] + nx * 8)} ${f1(base[1] + ny * 8)}L${tip[0]} ${tip[1]}L${f1(base[0] - nx * 8)} ${f1(base[1] - ny * 8)}z" fill="#fff" stroke="#222" stroke-width="2"${ln.kind === 'think' ? ' stroke-dasharray="3 3"' : ''}/>`;
        const ang = Math.acos((((tip[0] - base[0]) * dx + (tip[1] - base[1]) * dy) / (Math.hypot(tip[0] - base[0], tip[1] - base[1]) * len)));
        if (ang > 0.17) findings.push({rule: 'tail-misses-speaker', where: bid, message: `tail is ${f1(ang * 57.3)} deg off the mouth anchor`});
      }
      const shape = ({oval: `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${Math.min(bh / 2, 24)}"`, cloud: `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${Math.min(bh / 2, 28)}" stroke-dasharray="6 3"`, spiky: `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" stroke-width="3.5"`, box: `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}"`} as const)[KIND_STYLE[ln.kind]];
      parts.push(v => {
        const slotSvg = slotRects.map(({id, r, def}) => {
          const val = v[id];
          const base = `<g data-slot="${id}">`;
          if (val === undefined) return `${base}<line x1="${r.x}" y1="${r.y + r.h}" x2="${r.x + r.w}" y2="${r.y + r.h}" stroke="#667" stroke-width="2" stroke-dasharray="2 3"/><text x="${f1(r.x + r.w / 2)}" y="${f1(r.y + r.h - 5)}" text-anchor="middle" font-size="${SLOT_FONT}" fill="#889">${esc(def.prompt ?? '')}</text></g>`;
          const text = val === null ? (def.fallback ?? '…') : val;
          const w = widths(text, FONT, 700), s = w > r.w ? Math.max(FONT * r.w / w, SLOT_FLOOR) : FONT;
          return `${base}<text x="${f1(r.x + r.w / 2)}" y="${f1(r.y + r.h - 5)}" text-anchor="middle" font-size="${f1(s)}" font-weight="${val === null ? 400 : 700}" fill="${val === null ? '#889' : '#b23'}">${esc(text)}</text></g>`;
        }).join('');
        return `<g data-bubble="${bid}">${tail}${shape} fill="#fff" stroke="#222" stroke-width="2.5"/>${pieces.map(t => `<text x="${t.x}" y="${t.y}" font-size="${FONT}">${esc(t.text)}</text>`).join('')}${slotSvg}</g>`;
      });
    });
  });
  return {svg: v => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="'Noto Sans JP',sans-serif">${parts.map(f => f(v)).join('')}</svg>`, geometry: geo, width: W, height: H, findings, slotIds,
    valueFindings: v => blanks.flatMap(b => { const t = v[b.id]; return typeof t === 'string' && widths(t, SLOT_FLOOR, 700) > b.w ? [{rule: 'slot-overflow', where: b.id, message: `"${t}" is wider than the blank even at ${SLOT_FLOOR}px`}] : []; })};
}
