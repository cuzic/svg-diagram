// ADR 0074 spike: a throw-away prototype of comic() / bubble() / a parametric face / fill-in slots / a geometry map.
// Not part of lib/. It draws a 1x4 comic from meaning-first data (template + slot values, kept apart from the layout) with a given
// text measurer, and answers: does wrapping fit, does filling a slot move anything, how big is the geometry map.
import {splitAtoms} from '../../lib/atoms.ts';
import {wrapStyledAtoms} from '../../lib/wrap.ts';

export type Widths = (text: string, size: number, weight?: number) => number;
export type Face = 'neutral' | 'smile' | 'laugh' | 'surprise' | 'worry' | 'angry' | 'think' | 'sad';
export interface SlotDef {max: number; prompt?: string; fallback?: string}
export interface Line {speaker: string; kind: 'say' | 'think' | 'shout' | 'narration'; tpl: string; slots?: Record<string, SlotDef>}
export interface Char {id: string; side: 'left' | 'center' | 'right'; face: Face; hue: number}
export interface Panel {id: string; chars: Char[]; lines: Line[]}
export interface Worksheet {panels: Panel[]}
export type Values = Record<string, string | null | undefined>; // undefined: empty, null: skipped, string: filled
export interface Rect {x: number; y: number; w: number; h: number}
export interface Geometry {panels: Record<string, Rect>; bubbles: Record<string, Rect>; slots: Record<string, Rect>; heads: Record<string, Rect>; points: Record<string, {mouth: [number, number]; head: [number, number, number]}>}
export interface Finding {rule: string; where: string; message: string; severity: 'problem' | 'warn'}

// ---- constants (the 4px grid is kept: every coordinate below is a multiple of 4 or comes from a measure)
const PW = 420, PH = 300, GUT = 16, MARGIN = 16, BADGE = 24, STAGE_X = 104;
const FONT = 18, LH = 26, PAD_X = 12, PAD_Y = 10, INNER_MAX = 162, HEAD_R = 36, HEAD_CY = PH - 76, SLOT_FONT = 14, SLOT_FLOOR = 14;
const SLOT_MAX_CELLS = 9; // INNER_MAX / FONT: a blank always fits on a line
export const COLOR = {ink: '#222', prompt: '#5a6072', filled: '#bb2233', paper: '#fffdf6'};
const KIND_STYLE = {say: 'oval', think: 'cloud', shout: 'spiky', narration: 'box'} as const;
const ID = /^[A-Za-z][A-Za-z0-9_-]*$/;
const assertId = (id: string, what: string): string => { if (!ID.test(id)) throw new Error(`${what} id ${JSON.stringify(id)}: use letters, digits, _ and - (no . : @ #)`); return id; };

type Seg = {lit: string} | {slot: string};
const segs = (tpl: string): Seg[] => tpl.split(/(\{[A-Za-z][\w-]*\})/).filter(Boolean).map(s => /^\{.+\}$/.test(s) ? {slot: s.slice(1, -1)} : {lit: s});

const isCjk = (ch: string): boolean => [...ch].length === 1 && /[\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(ch);
const isHira = (ch: string): boolean => [...ch].length === 1 && /[\u3041-\u309f]/.test(ch);
/** Width rule (comic / chat only): a CJK atom is exactly 1 em, never measured; any other atom is quantized to 1/4 px first and then rounded up to a whole px (a quantizer has a cliff wherever it is put; this one sits at k + 0.125). */
export const atomWidth = (a: string, widths: Widths): number => isCjk(a) ? FONT : Math.ceil(Math.round(widths(a, FONT) * 4) / 4);

interface Atom {text: string; slot?: string; w: number; glue?: boolean}
interface LaidLine {atoms: Atom[]; w: number}
interface Reserved {lines: LaidLine[]; inner: number; notes: string[]}

/** Wrap the template with every slot reserved at its maximum width, the slot an unbreakable unit that keeps the hiragana after it (bunsetsu). */
export type GlueMode = 'all' | 'two' | 'particle' | 'fit2' | 'fit2p';
const PARTICLES = new Set([...'はがをにでのともへや']);
/** How much of the hiragana after a slot is bound to it: 'all' (the whole run), 'two' (at most two), 'particle' (only a particle: は が を に で の と も へ や), 'fit2' (at most two, and never past INNER_MAX), 'fit2p' (like fit2, but a particle right after the slot is always bound). */
function glueAllowed(mode: GlueMode, n: number, ch: string, unitW: number): boolean { return mode === 'all' || (mode === 'two' ? n < 2 : mode === 'fit2' ? n < 2 && unitW + FONT <= INNER_MAX : mode === 'fit2p' ? n < 2 && (unitW + FONT <= INNER_MAX || (n === 0 && PARTICLES.has(ch))) : n === 0 && PARTICLES.has(ch)); }
function reserve(line: Line, widths: Widths, mode: GlueMode): Reserved {
  const atoms: Atom[] = [];
  let afterSlot = false, bound = 0, unitW = 0;
  for (const s of segs(line.tpl)) {
    if ('slot' in s) { atoms.push({text: `{${s.slot}}`, slot: s.slot, w: (line.slots?.[s.slot]?.max ?? 4) * FONT}); afterSlot = true; bound = 0; unitW = (line.slots?.[s.slot]?.max ?? 4) * FONT; }
    else for (const a of splitAtoms(s.lit)) { const glue = afterSlot && isHira(a) && glueAllowed(mode, bound, a, unitW); if (glue) { bound++; unitW += FONT; } else afterSlot = false; atoms.push({text: a, w: atomWidth(a, widths), ...(glue ? {glue: true} : {})}); }
  }
  // the widest unbreakable unit: a slot with the hiragana glued to it
  let unit = 0, widest = 0;
  for (const a of atoms) { unit = a.slot ? a.w : a.glue ? unit + a.w : 0; widest = Math.max(widest, unit); }
  const wrap = (W: number): LaidLine[] => wrapStyledAtoms(atoms, {maxWidth: W, atomWidth: a => a.w, mode: 'bunsetsu'}).map(l => ({atoms: l, w: l.reduce((n, a) => n + a.w, 0)}));
  const notes: string[] = [];
  let inner = Math.max(INNER_MAX, widest), lines = wrap(inner);
  // an orphan last line (two cells or fewer: 「…」, 「ね。」): widen by one cell, twice at most, and keep the first width that cures it
  for (const extra of [FONT, 2 * FONT]) {
    const last = lines[lines.length - 1];
    if (lines.length < 2 || !last || last.w > 2 * FONT) break;
    if (Math.max(INNER_MAX, widest) + extra > INNER_MAX + 2 * FONT) break; // never widen past the bubble-wide threshold
    const t = wrap(Math.max(INNER_MAX, widest) + extra), tl = t[t.length - 1];
    if (t.length < lines.length || (tl && tl.w > 2 * FONT)) { lines = t; inner = Math.max(INNER_MAX, widest) + extra; }
  }
  const last = lines[lines.length - 1];
  if (lines.length > 1 && last && last.w <= 2 * FONT) notes.push('orphan-line');
  const widthMax = Math.max(...lines.map(l => l.w));
  if (widthMax > INNER_MAX + 2 * FONT) notes.push('bubble-wide');
  lines.forEach((l, i) => { const first = l.atoms[0]; if (i > 0 && first && !first.slot && isHira(first.text) && lines[i - 1]?.atoms.at(-1)?.slot) notes.push('follower-split'); });
  return {lines, inner: Math.max(inner, widthMax), notes};
}

const rectHitsCircle = (r: Rect, cx: number, cy: number, rad: number): boolean => { const dx = Math.max(r.x - cx, 0, cx - (r.x + r.w)), dy = Math.max(r.y - cy, 0, cy - (r.y + r.h)); return dx * dx + dy * dy < rad * rad; };
const f1 = (n: number) => Math.round(n * 10) / 10;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const snap4 = (n: number) => Math.round(n / 4) * 4;
/** WCAG relative luminance contrast of two #rrggbb colours. */
export const contrast = (a: string, b: string): number => { const L = (h: string) => { const [r, g, bl] = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4) as [number, number, number]; return 0.2126 * r + 0.7152 * g + 0.0722 * bl; }; const [x, y] = [L(a), L(b)]; return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

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
  /** the picture for these values; the layout is fixed, only the slot groups depend on `v` */
  svg: (v: Values) => string;
  geometry: Geometry;
  width: number; height: number;
  /** layout-time findings (they depend on the data, never on values) */
  findings: Finding[];
  /** wrapping notes per bubble: orphan-line / bubble-wide / follower-split */
  wrapped: Record<string, {lines: string[]; inner: number; notes: string[]}>;
  slotIds: string[];
  /** value-dependent findings: a value wider than its blank at the font floor (it is clipped, see `svg`) */
  valueFindings: (v: Values) => Finding[];
  /** how many value strings have been measured so far (a memo: a value is measured once) */
  stats: {valueMeasures: number};
}

export function layoutComic(ws: Worksheet, widths: Widths, opts: {glue?: GlueMode} = {}): Laid {
  const glueMode = opts.glue ?? 'fit2p';
  const W = PW + 2 * MARGIN, H = MARGIN + ws.panels.length * (PH + GUT) - GUT + MARGIN;
  const geo: Geometry = {panels: {}, bubbles: {}, slots: {}, heads: {}, points: {}};
  const findings: Finding[] = [];
  const bad = (rule: string, where: string, message: string, severity: Finding['severity'] = 'problem') => findings.push({rule, where, message, severity});
  const parts: ((v: Values) => string)[] = [];
  const slotIds: string[] = [];
  const blanks: {id: string; w: number}[] = [];
  const wrapped: Laid['wrapped'] = {};
  const stats = {valueMeasures: 0};
  const memo = new Map<string, number>();
  const vw = (text: string, size: number, weight: number): number => { const k = `${text}|${size}|${weight}`; let n = memo.get(k); if (n === undefined) { stats.valueMeasures++; memo.set(k, n = widths(text, size, weight)); } return n; };
  ws.panels.forEach((p, pi) => {
    assertId(p.id, 'panel');
    const px = MARGIN, py = MARGIN + pi * (PH + GUT);
    geo.panels[p.id] = {x: px, y: py, w: PW, h: PH};
    const heads = new Map<string, {x: number; y: number; hue: number; face: Face}>();
    const taken = new Set<string>();
    let panelSlots = 0;
    for (const c of p.chars) {
      assertId(c.id, 'character');
      if (taken.has(c.side)) bad('comic-at-collision', p.id, `two characters stand at ${c.side}`);
      taken.add(c.side);
      const cx = px + (c.side === 'left' ? STAGE_X : c.side === 'right' ? PW - STAGE_X : snap4(PW / 2)), cy = py + HEAD_CY;
      heads.set(c.id, {x: cx, y: cy, hue: c.hue, face: c.face});
      geo.heads[`${p.id}.${c.id}`] = {x: cx - HEAD_R, y: cy - HEAD_R, w: 2 * HEAD_R, h: 2 * HEAD_R};
      geo.points[`${p.id}.${c.id}`] = {mouth: [cx, f1(cy + HEAD_R * 0.42)], head: [cx, cy, HEAD_R]};
    }
    parts.push(() => `<g data-panel="${p.id}"><rect x="${px}" y="${py}" width="${PW}" height="${PH}" fill="${COLOR.paper}" stroke="${COLOR.ink}" stroke-width="3"/>`
      + `<rect x="${px}" y="${py}" width="${BADGE}" height="${BADGE}" fill="${COLOR.ink}"/><text x="${px + BADGE / 2}" y="${py + 17}" text-anchor="middle" font-size="14" font-weight="700" fill="#fff">${pi + 1}</text>`
      + [...heads.values()].map(h => body(h.x, h.hue)).join('') + [...heads.values()].map(h => face(h.face, h.x, h.y, HEAD_R, h.hue)).join('') + '</g>');
    // bubbles in dialogue order. Same-row rule: a bubble shares the top row only with earlier bubbles that lie wholly to its LEFT
    // (left-to-right = reading order); otherwise it stacks under every earlier bubble it overlaps in x or that lies to its right.
    const placed: Rect[] = [];
    p.lines.forEach((ln, li) => {
      const bid = `${p.id}.b${li}`;
      const R = reserve(ln, widths, glueMode);
      const laid = R.lines, iw = R.inner, ih = laid.length * LH;
      wrapped[bid] = {lines: laid.map(l => l.atoms.map(a => a.text).join('')), inner: iw, notes: R.notes};
      for (const n of R.notes) bad(`comic-${n}`, bid, n, 'warn');
      const bw = Math.ceil((iw + 2 * PAD_X) / 4) * 4, bh = Math.ceil((ih + 2 * PAD_Y) / 4) * 4; // a rounded rectangle (rx <= 24): no sqrt(2) margin
      const sp = heads.get(ln.speaker);
      if (!sp && ln.kind !== 'narration') bad('comic-speaker-unknown', bid, `${ln.speaker} is not on the stage of ${p.id}`);
      const cxWant = sp ? sp.x : px + PW / 2;
      const bx = snap4(Math.min(Math.max(cxWant - bw / 2, px + 8), px + PW - 8 - bw));
      const by = Math.max(py + 16, ...placed.filter(q => (q.x < bx + bw + 6 && bx < q.x + q.w + 6) || bx < q.x).map(q => q.y + q.h + 6));
      placed.push({x: bx, y: by, w: bw, h: bh});
      geo.bubbles[bid] = {x: bx, y: by, w: bw, h: bh};
      for (const [hid, h] of heads) if (rectHitsCircle({x: bx, y: by, w: bw, h: bh}, h.x, h.y, HEAD_R + 4)) bad('comic-bubble-covers-face', bid, `bubble covers the head of ${hid}`);
      const inTpl = new Set(segs(ln.tpl).flatMap(s => 'slot' in s ? [s.slot] : []));
      panelSlots += inTpl.size;
      for (const id of inTpl) {
        assertId(id, 'slot');
        const d = ln.slots?.[id];
        if (!d) { bad('comic-slot-undefined', bid, `{${id}} has no definition`); continue; }
        if (geo.slots[id]) bad('comic-slot-duplicate', bid, `slot id ${id} is used twice`);
        if (!Number.isInteger(d.max) || d.max < 1 || d.max > SLOT_MAX_CELLS) bad('comic-slot-max', bid, `max ${d.max} of ${id} is outside 1..${SLOT_MAX_CELLS}`);
        const pl = [...(d.prompt ?? '')].length; if (pl < 2 || pl > 4) bad('comic-slot-prompt', bid, `prompt of ${id} has ${pl} characters (2..4)`);
      }
      // the text block: lines centred in the inner rectangle; a line is one <text> per run of literal atoms, a slot is its own group
      const tx0 = bx + (bw - iw) / 2, ty0 = by + (bh - ih) / 2;
      const slotRects: {id: string; r: Rect; def: SlotDef}[] = [];
      const pieces: {x: number; y: number; text: string}[] = [];
      laid.forEach((l, i) => { let x = tx0 + (iw - l.w) / 2, open = false; for (const a of l.atoms) {
        if (a.slot) { open = false; const r = {x: f1(x), y: f1(ty0 + i * LH + 2), w: a.w, h: LH - 4}; geo.slots[a.slot] = r; slotIds.push(a.slot); blanks.push({id: a.slot, w: a.w}); slotRects.push({id: a.slot, r, def: ln.slots?.[a.slot] ?? {max: 4}}); }
        else if (open) pieces[pieces.length - 1]!.text += a.text;
        else { open = true; pieces.push({x: f1(x), y: f1(ty0 + i * LH + 19), text: a.text}); }
        x += a.w; } });
      // the tail aims at the speaker's mouth: the ray from the bubble centre to the mouth anchor, the tip stopping 6px outside the head circle
      let tail = '';
      if (sp && ln.kind !== 'narration') {
        const m = geo.points[`${p.id}.${ln.speaker}`]!.mouth, bcx = bx + bw / 2, bcy = by + bh / 2;
        const dx = m[0] - bcx, dy = m[1] - bcy, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len;
        const hx = sp.x - bcx, hy = sp.y - bcy; const proj = hx * ux + hy * uy, perp = Math.hypot(hx - proj * ux, hy - proj * uy);
        const tipT = proj - Math.sqrt(Math.max(HEAD_R * HEAD_R - perp * perp, 0)) - 6;
        const tip: [number, number] = [f1(bcx + ux * tipT), f1(bcy + uy * tipT)];
        const edgeT = Math.min(bw / 2 / Math.abs(ux || 1e-9), bh / 2 / Math.abs(uy || 1e-9));
        const nx = -uy, ny = ux, base: [number, number] = [bcx + ux * edgeT * 0.8, bcy + uy * edgeT * 0.8];
        tail = `<path d="M${f1(base[0] + nx * 8)} ${f1(base[1] + ny * 8)}L${tip[0]} ${tip[1]}L${f1(base[0] - nx * 8)} ${f1(base[1] - ny * 8)}z" fill="#fff" stroke="${COLOR.ink}" stroke-width="2"${ln.kind === 'think' ? ' stroke-dasharray="3 3"' : ''}/>`;
        const ang = Math.acos((((tip[0] - base[0]) * dx + (tip[1] - base[1]) * dy) / (Math.hypot(tip[0] - base[0], tip[1] - base[1]) * len)));
        if (ang > 0.17) bad('comic-tail-off-speaker', bid, `tail is ${f1(ang * 57.3)} deg off the mouth anchor`);
      }
      const shape = ({oval: `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${Math.min(bh / 2, 24)}"`, cloud: `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="${Math.min(bh / 2, 28)}" stroke-dasharray="6 3"`, spiky: `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}" rx="6" stroke-width="3.5"`, box: `<rect x="${bx}" y="${by}" width="${bw}" height="${bh}"`} as const)[KIND_STYLE[ln.kind]];
      parts.push(v => {
        const slotSvg = slotRects.map(({id, r, def}) => {
          const val = v[id];
          const base = `<g data-slot="${id}">`;
          if (val === undefined) return `${base}<line x1="${r.x}" y1="${r.y + r.h}" x2="${r.x + r.w}" y2="${r.y + r.h}" stroke="${COLOR.prompt}" stroke-width="2" stroke-dasharray="2 3"/><text x="${f1(r.x + r.w / 2)}" y="${f1(r.y + r.h - 5)}" text-anchor="middle" font-size="${SLOT_FONT}" fill="${COLOR.prompt}">${esc(def.prompt ?? '')}</text></g>`;
          const text = val === null ? (def.fallback ?? '…') : val;
          const w = vw(text, FONT, 700), s = w > r.w ? Math.max(FONT * r.w / w, SLOT_FLOOR) : FONT;
          // a value that still does not fit at the floor is clipped to its blank, never drawn over its neighbours
          return `${base}<clipPath id="clip-${id}"><rect x="${r.x}" y="${r.y - 4}" width="${r.w}" height="${r.h + 8}"/></clipPath><text clip-path="url(#clip-${id})" x="${f1(r.x + r.w / 2)}" y="${f1(r.y + r.h - 5)}" text-anchor="middle" font-size="${f1(s)}" font-weight="${val === null ? 400 : 700}" fill="${val === null ? COLOR.prompt : COLOR.filled}">${esc(text)}</text></g>`;
        }).join('');
        const label = ln.tpl.replace(/\{([\w-]+)\}/g, (_, id: string) => v[id] ?? '＿＿');
        return `<g data-bubble="${bid}"><title>${esc(label)}</title>${tail}${shape} fill="#fff" stroke="${COLOR.ink}" stroke-width="2.5"/>${pieces.map(t => `<text x="${t.x}" y="${t.y}" font-size="${FONT}">${esc(t.text)}</text>`).join('')}${slotSvg}</g>`;
      });
    });
    if (panelSlots > 2) bad('comic-slots-per-panel', p.id, `${panelSlots} slots in one panel (at most 2)`);
  });
  return {svg: v => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="'Noto Sans JP',sans-serif">${parts.map(f => f(v)).join('')}</svg>`, geometry: geo, width: W, height: H, findings, wrapped, slotIds, stats,
    valueFindings: v => blanks.flatMap(b => { const t = v[b.id]; return typeof t === 'string' && vw(t, SLOT_FLOOR, 700) > b.w ? [{rule: 'slot-overflow', where: b.id, message: `"${t}" is wider than the blank even at ${SLOT_FLOOR}px: it is clipped`, severity: 'problem' as const}] : []; })};
}
