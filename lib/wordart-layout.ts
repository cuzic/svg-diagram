// wordart(): what to measure, and where everything goes (docs/adr/0009). Pure; widths come from the measured atoms.
import {textWidth} from './atoms.ts';
import {wrapText} from './wrap.ts';
import type {Rect, Roles, WidthOf} from './types.ts';
import {inkReach, REFLECTION_SHARE, resolveLook, sizeOf} from './wordart-look.ts';
import {BASELINE, COLUMN_PITCH, graphemes, tcySize, tokenizeColumn, verticalColumns} from './wordart-vertical.ts';
import {translateItem} from './wordart-types.ts';
import type {ArtItem, LaidOutWordArt, WordArtBand, WordArtLook} from './wordart-types.ts';

// ---------------------------------------------------------------------------------------------------------------------------
// what to measure
// ---------------------------------------------------------------------------------------------------------------------------

/** [text, size, weight, font] of everything layoutWordArt() measures. */
export function wordArtTexts(b: WordArtBand, roles: Roles): [string, number, number, 'sans' | 'mono'][] {
  const size = sizeOf(b.opts.size, roles), {weight, font} = resolveLook(b.opts, size), out: [string, number, number, 'sans' | 'mono'][] = [];
  if (b.opts.arc) for (const ch of graphemes(b.text)) out.push([ch, size, weight, font]);
  else if (b.opts.writing === 'vertical') {
    for (const para of b.text.split('\n')) for (const t of tokenizeColumn(para)) {
      if (t.kind === 'side') out.push([t.text, size, weight, font]);
      if (t.kind === 'tcy') out.push([t.text, tcySize(size), weight, font], [t.text, size, weight, font]);
    }
  } else for (const para of b.text.split('\n')) out.push([para, size, weight, font]);
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------------
// layout
// ---------------------------------------------------------------------------------------------------------------------------

const LINE_H = 1.25; // horizontal line height, in sizes
const PLATE_PAD = 0.3; // the plate's padding, in sizes
const ARC_MIN_KEEP = 0.7;
const ASCENT = 0.88, DESCENT = 0.2; // a glyph box, in sizes above / below the baseline

/** Glyphs set along an arc: positions relative to the apex of the baseline, and the box they fill. */
function arcGlyphs(text: string, size: number, arc: number, spacing: number, advance: (ch: string) => number): {glyphs: Extract<ArtItem, {k: 'arc'}>['glyphs']; w: number; h: number} {
  const chars = graphemes(text), widths = chars.map(advance), total = widths.reduce((s, x) => s + x, 0) + spacing * (chars.length - 1);
  const theta = Math.abs(arc) * Math.PI / 180, R = total / theta, sign = arc > 0 ? 1 : -1;
  // on the inside of the bend the letters crowd each other: by the share of the radius their inner edge keeps
  const keep = (R - (sign > 0 ? DESCENT : ASCENT) * size) / R;
  if (keep < ARC_MIN_KEEP) throw new Error(`wordart(): "${text.slice(0, 20)}" bent ${Math.abs(arc)}° is too tight (the letters would overlap on the inside): use a smaller arc, a longer text or a smaller size`);
  const raw: {ch: string; x: number; y: number; rot: number}[] = [];
  const corners: [number, number][] = [];
  let at = -total / 2;
  chars.forEach((ch, i) => {
    const mid = at + widths[i] / 2, phi = mid / R;
    const px = R * Math.sin(phi), py = sign * R * (1 - Math.cos(phi)), rot = sign * phi, c = Math.cos(rot), s = Math.sin(rot);
    raw.push({ch, x: px - widths[i] / 2 * c, y: py - widths[i] / 2 * s, rot: rot * 180 / Math.PI});
    for (const [u, v] of [[-widths[i] / 2, -ASCENT * size], [widths[i] / 2, -ASCENT * size], [widths[i] / 2, DESCENT * size], [-widths[i] / 2, DESCENT * size]]) corners.push([px + u * c - v * s, py + u * s + v * c]);
    at += widths[i] + spacing;
  });
  const minX = Math.min(...corners.map(p => p[0])), minY = Math.min(...corners.map(p => p[1]));
  return {glyphs: raw.map(g => ({...g, x: g.x - minX, y: g.y - minY})), w: Math.max(...corners.map(p => p[0])) - minX, h: Math.max(...corners.map(p => p[1])) - minY};
}

/** A set figure before it is placed: its items and label boxes relative to its own top-left corner (0, 0), and its size. */
interface Figure {items: ArtItem[]; boxes: Rect[]; w: number; h: number; /** Where the mirror image stands: the last baseline, else the bottom. */ base: number}

/** What every setter knows: the band's text, the size and the look, the width of a text, and the room the figure may take. */
interface Setting {text: string; size: number; look: WordArtLook; opts: WordArtBand['opts']; wOf: (text: string) => number; widthOf: WidthOf; room: number}

function setArc(s: Setting): Figure {
  const a = arcGlyphs(s.text, s.size, s.opts.arc!, s.look.spacing, s.wOf);
  return {items: [{k: 'arc', size: s.size, glyphs: a.glyphs}], boxes: [{x: 0, y: 0, w: a.w, h: a.h}], w: a.w, h: a.h, base: a.h};
}

function setVertical(s: Setting): Figure {
  const {size, look} = s, items: ArtItem[] = [], boxes: Rect[] = [];
  const cols = verticalColumns(s.text, size, look.weight, s.widthOf, {limit: s.opts.limit, spacing: look.spacing, font: look.font});
  const pitch = size * COLUMN_PITCH, w = (cols.length - 1) * pitch + size, h = Math.max(...cols.map(c => c.len));
  cols.forEach((col, i) => {
    const cx = w - size / 2 - i * pitch;
    // consecutive upright glyphs share one <text>; a turned run is a <text> of its own, in reading order (so no text box spans another)
    let glyphs: Extract<ArtItem, {k: 'col'}>['glyphs'] = [];
    const closeRun = (): void => { if (glyphs.length) items.push({k: 'col', size, glyphs}); glyphs = []; };
    for (const cell of col.cells) {
      const t = cell.token, mid = cell.top + cell.len / 2, baseline = cell.top + size / 2 + BASELINE * size;
      if (t.kind === 'glyph' && !t.turn) glyphs.push({ch: t.ch, x: cx + t.dx * size, y: baseline + t.dy * size, size});
      else if (t.kind === 'tcy') glyphs.push({ch: t.text, x: cx, y: cell.top + size / 2 + BASELINE * tcySize(size), size: tcySize(size)});
      else if (t.kind !== 'blank') { closeRun(); items.push({k: 'rot', text: t.kind === 'glyph' ? t.ch : t.text, x: cx, y: mid + BASELINE * size, cx, cy: mid, size}); }
    }
    closeRun();
    boxes.push({x: cx - size / 2, y: 0, w: size, h: col.len});
  });
  return {items, boxes, w, h, base: h};
}

function setHorizontal(s: Setting): Figure {
  const {size, look} = s, spacing = look.spacing, items: ArtItem[] = [], boxes: Rect[] = [];
  const lines = s.text.split('\n').flatMap(p => p.trim() === '' ? [''] : wrapText(p, {maxWidth: s.room, atomWidth: a => s.wOf(a) + spacing * Array.from(a).length}));
  const widths = lines.map(l => s.wOf(l) + spacing * Math.max(0, Array.from(l).length - 1));
  const w = Math.max(...widths), h = lines.length * size * LINE_H, align = s.opts.align ?? 'center';
  const anchor = align === 'start' ? 'start' : align === 'end' ? 'end' : 'middle', ax = align === 'start' ? 0 : align === 'end' ? w : w / 2;
  let base = h;
  lines.forEach((line, i) => {
    if (!line) return;
    base = i * size * LINE_H + size * ((LINE_H - 1.2) / 2 + 1);
    items.push({k: 'line', text: line, x: ax, y: base, anchor, size});
    boxes.push({x: ax - (anchor === 'start' ? 0 : anchor === 'end' ? widths[i] : widths[i] / 2), y: i * size * LINE_H + (size * LINE_H - size * 1.2) / 2, w: widths[i], h: size * 1.2});
  });
  return {items, boxes, w, h, base};
}

/**
 * The id of a wordart's gradient / clip: a hash of what it is and where it is. A position alone is not enough: two SVGs embedded in one page
 * would each have a def of that name, and the second figure would paint with the first one's.
 */
function uidOf(text: string, look: WordArtLook, at: Rect): string {
  let h = 5381;
  for (const ch of JSON.stringify([text, look, Math.round(at.x), Math.round(at.y), Math.round(at.w), Math.round(at.h)])) h = (Math.imul(h, 33) ^ ch.codePointAt(0)!) >>> 0;
  return `wa${h.toString(36)}`;
}

/** The box of a w x h figure turned by `deg` degrees. */
function turnedBox(w: number, h: number, deg: number): {w: number; h: number} {
  if (deg % 180 === 0) return {w, h};
  const r = deg * Math.PI / 180, c = Math.abs(Math.cos(r)), n = Math.abs(Math.sin(r));
  return {w: w * c + h * n, h: w * n + h * c};
}



export function layoutWordArt(b: WordArtBand, x: number, y: number, cw: number, widthOf: WidthOf, roles: Roles): LaidOutWordArt {
  const size = sizeOf(b.opts.size, roles), look = resolveLook(b.opts, size), vertical = b.opts.writing === 'vertical', label = b.text.replace(/\s+/g, ' ').trim();
  const reach = inkReach(look), platePad = look.plate ? size * PLATE_PAD : 0;
  const padL = reach.left + platePad, padR = reach.right + platePad, padT = reach.top + platePad, padB = reach.bottom + platePad;
  const setting: Setting = {text: b.text, size, look, opts: b.opts, widthOf, wOf: t => textWidth(widthOf, t, size, look.weight, look.font), room: Math.max(size, (b.opts.limit ?? cw) - padL - padR)};
  const fig = b.opts.arc ? setArc(setting) : vertical ? setVertical(setting) : setHorizontal(setting);
  // the mirror image goes under the letters: a gap, then the top part of the reflection
  const refH = look.reflection ? Math.min(fig.h, size) * REFLECTION_SHARE : 0, below = look.reflection ? Math.max(0, fig.base + look.reflection.gap + refH - fig.h) : 0;
  const w = fig.w + padL + padR, h = fig.h + padT + padB + below, turned = turnedBox(w, h, look.rotate), W = turned.w, H = turned.h;
  if (W > cw + 0.5) throw new Error(`wordart(): "${label.slice(0, 20)}" needs ${Math.round(W)}px but the figure is ${Math.round(cw)}px: ${vertical ? 'lower the size or the spacing, raise limit (taller, fewer columns), or widen the figure' : 'lower the size, shorten it, or widen the figure'}`);
  const align = b.opts.align ?? 'center', ox = x + (align === 'start' ? 0 : align === 'end' ? cw - W : (cw - W) / 2);
  const lx = ox + (W - w) / 2, ly = y + (H - h) / 2, offX = lx + padL, offY = ly + padT;
  const rect: Rect = {x: ox, y, w: W, h: H}, local: Rect = {x: lx, y: ly, w, h}, axis = offY + fig.base;
  // a turned or mirrored figure's boxes are the figure's own box (the unturned boxes would no longer be where they were)
  const unmoved = look.rotate % 180 === 0 && !look.flipH && !look.flipV;
  return {
    type: 'wordart', id: b.id, reveal: b.reveal, until: b.until, uid: uidOf(label, look, rect), text: label, size, writing: vertical ? 'vertical' : 'horizontal', look,
    items: fig.items.map(it => translateItem(it, offX, offY)), ...rect, local,
    ...(look.plate ? {plate: local} : {}),
    ...(look.reflection ? {reflection: {axis, clip: {x: lx, y: axis - refH, w, h: refH}}} : {}),
    anchors: b.id ? [{id: b.id, ...rect}] : [],
    labelBoxes: unmoved ? fig.boxes.map(r => ({label, x: offX + r.x, y: offY + r.y, w: r.w, h: r.h})) : [{label, ...rect}],
  };
}
