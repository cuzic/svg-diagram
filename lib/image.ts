// image(): a picture placed as a part, with marks (outlines for spotlight / connect) and label plates over it.
//
// The file is read ONCE, when image() is called, and embedded as a data URI, so the SVG is self-contained (no file next to it, no
// network). Everything after that works on the band: layout needs only the picture's size, and the pixels are never inspected.
//
// Because the pixels are unknown, the contrast of text drawn on them cannot be checked. So the DSL gives text over an image no way to sit
// on the bare picture: every label is drawn on an opaque plate (a tone's fill), and the contrast lint treats a text over an <image> that
// has no opaque shape behind it as a finding (svg-lint.ts).
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {textWidth} from './measure.ts';
import {ROLES, toneStyle} from './tokens.ts';
import type {FontFamily, ImageBand, ImageLabel, ImageMark, LabelRole, LaidOutImage, WidthOf} from './types.ts';

/** Larger than this and rules.ts warns (`image-large`): the whole file travels inside every SVG, and again in every reveal stage. */
export const IMAGE_WARN_BYTES = 300 * 1024;
/** A hard limit: a bigger file is almost certainly a photo that should be resized first. */
export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

const PLATE_PAD_X = 8, PLATE_H_EXTRA = 14, MARK_STROKE = 3;

let sourceDir: string | null = null;
/** Set by the loader around a source's define(): a relative path in image() then means "next to the source", not "from where the CLI runs". */
export function withSourceDir<T>(dir: string, fn: () => T): T {
  const prev = sourceDir;
  sourceDir = dir;
  try { return fn(); } finally { sourceDir = prev; }
}

export interface ImageFile {href: string; w: number; h: number; bytes: number; mime: string}

/** The size of a PNG / JPEG / GIF / WebP from its header, or null when the bytes are none of those. */
export function sniffImage(b: Buffer): {mime: string; w: number; h: number} | null {
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47 && b.readUInt32BE(4) === 0x0d0a1a0a) return {mime: 'image/png', w: b.readUInt32BE(16), h: b.readUInt32BE(20)};
  if (b.length >= 10 && b.toString('latin1', 0, 3) === 'GIF') return {mime: 'image/gif', w: b.readUInt16LE(6), h: b.readUInt16LE(8)};
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) { i++; continue; }
      const m = b[i + 1];
      if (m === 0xff) { i++; continue; }
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return {mime: 'image/jpeg', h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7)};
      if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
      i += 2 + b.readUInt16BE(i + 2);
    }
    return null;
  }
  if (b.length >= 30 && b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP') {
    const kind = b.toString('latin1', 12, 16);
    if (kind === 'VP8X') return {mime: 'image/webp', w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3)};
    if (kind === 'VP8L') { const v = b.readUInt32LE(21); return {mime: 'image/webp', w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff)}; }
    if (kind === 'VP8 ') return {mime: 'image/webp', w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff};
  }
  return null;
}

/** `src`: a file path (relative: next to the diagram source), a file: URL (`new URL('./a.png', import.meta.url)`), or a ready `data:image/…;base64,` URI. */
export function readImage(src: string | URL): ImageFile {
  let buf: Buffer;
  if (typeof src === 'string' && src.startsWith('data:')) {
    const m = /^data:image\/(?:png|jpeg|gif|webp);base64,([A-Za-z0-9+/=]+)$/.exec(src);
    if (!m) throw new Error('image(): a data URI must be data:image/png|jpeg|gif|webp;base64,…');
    buf = Buffer.from(m[1], 'base64');
  } else {
    const file = src instanceof URL ? fileURLToPath(src) : typeof src === 'string' && src.startsWith('file:') ? fileURLToPath(src) : path.resolve(sourceDir ?? process.cwd(), String(src));
    try { buf = fs.readFileSync(file); } catch (e) { throw new Error(`image(): cannot read ${file} (${(e as NodeJS.ErrnoException).code ?? (e as Error).message})`); }
  }
  if (buf.length > IMAGE_MAX_BYTES) throw new Error(`image(): ${Math.round(buf.length / 1024)} KB is over the ${IMAGE_MAX_BYTES / 1024 / 1024} MB limit — resize it first`);
  const info = sniffImage(buf);
  if (!info) throw new Error('image(): only PNG, JPEG, GIF and WebP files are embedded (SVG is not: draw it with the other parts)');
  if (!(info.w > 0 && info.h > 0)) throw new Error('image(): the file reports a size of 0');
  return {href: `data:${info.mime};base64,${buf.toString('base64')}`, w: info.w, h: info.h, bytes: buf.length, mime: info.mime};
}

/** The font-size of a label plate: its own role, else the picture's, else 'note'. Read at call time (fill mode rewrites ROLES). */
const sizeOf = (band: ImageBand, role?: LabelRole): number => ROLES[role ?? band.labelRole ?? 'note'];

/** Every string an image() draws, registered before its geometry is calculated. */
export function imageTexts(band: ImageBand): [string, number, number, FontFamily][] {
  return [...(band.marks ?? []).flatMap(m => m.label ? [[m.label, sizeOf(band, m.role)] as const] : []), ...(band.labels ?? []).map(l => [l.text, sizeOf(band, l.role)] as const)]
    .map(([t, S]) => [t, S, 700, 'sans']);
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), Math.max(lo, hi));

export function layoutImage(band: ImageBand, x: number, y: number, cw: number, widthOf: WidthOf): LaidOutImage {
  const ar = band.naturalW / band.naturalH;
  let w = Math.min(band.width ?? cw, cw), h = w / ar;
  if (band.height !== undefined) { h = band.height; w = h * ar; if (w > cw) { w = cw; h = w / ar; } }
  w = Math.round(w); h = Math.round(h);
  const ix = x + Math.round(band.align === 'left' ? 0 : band.align === 'right' ? cw - w : (cw - w) / 2);
  const out: LaidOutImage = {
    type: 'image', id: band.id, x: ix, y, w, h, href: band.href, alt: band.alt, bytes: band.bytes, reveal: band.reveal,
    marks: [], plates: [], anchors: [],
  };
  const plate = (text: string, px: number, py: number, anchor: 'start' | 'middle' | 'end', tone: ImageMark['tone'], reveal: number | undefined, role: LabelRole | undefined, mark?: number, atTop = false): void => {
    const S = sizeOf(band, role), plateH = Math.ceil((S + PLATE_H_EXTRA) / 4) * 4; // a multiple of 4: the plate sits on the 4px grid
    if (atTop) py += plateH / 2;
    const tw = textWidth(widthOf, text, S, 700), pw = Math.ceil(tw + 2 * PLATE_PAD_X);
    const left = clamp(anchor === 'start' ? px : anchor === 'middle' ? px - pw / 2 : px - pw, ix, ix + w - pw);
    const top = clamp(py - plateH / 2, y, y + h - plateH);
    out.plates.push({x: Math.round(left), y: Math.round(top), w: pw, h: plateH, text, size: S, tone: tone ?? 'plain', reveal, mark});
  };
  (band.marks ?? []).forEach((m, i) => {
    const [fx, fy, fw, fh] = m.rect;
    const r = {x: Math.round(ix + fx * w), y: Math.round(y + fy * h), w: Math.round(fw * w), h: Math.round(fh * h)};
    const mark = {...r, id: m.id, tone: m.tone ?? 'accent', reveal: m.reveal ?? band.reveal};
    out.marks.push(mark);
    if (m.id) out.anchors.push({...r, id: m.id});
    // a mark's label is a tab on its top-left corner, inside the picture
    if (m.label) plate(m.label, r.x, r.y, 'start', m.tone ?? 'accent', mark.reveal, m.role, i, true);
  });
  for (const l of band.labels ?? []) plate(l.text, ix + l.at[0] * w, y + l.at[1] * h, l.anchor ?? 'start', l.tone, l.reveal ?? band.reveal, l.role);
  return out;
}

/** What a plate in a tone looks like: fill, outline and text colour keys. */
export const plateStyle = (tone: ImageLabel['tone'] | undefined) => {
  const t = toneStyle(tone ?? 'plain');
  return {fill: t.fill, stroke: t.stroke ?? t.fill, text: t.text, ink: t.ink};
};
export {MARK_STROKE};
