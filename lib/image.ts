// image(): a picture placed as a part, with marks (outlines for spotlight / connect) and label plates over it.
//
// The file is read ONCE, when image() is called (lib/image-file.ts, the only part that touches the disk), and embedded as a data URI,
// so the SVG is self-contained (no file next to it, no network). Everything here works on the band: layout needs only the picture's
// size, and the pixels are never inspected.
//
// Because the pixels are unknown, the contrast of text drawn on them cannot be checked. So the DSL gives text over an image no way to sit
// on the bare picture: every label is drawn on an opaque plate (a tone's fill), and the contrast lint treats a text over an <image> that
// has no opaque shape behind it as a finding (svg-lint.ts).
import {textWidth} from './atoms.ts';
import {toneStyle} from './tokens.ts';
import type {ToneEnv} from './tokens.ts';
import type {FontFamily, LabelRole, Roles, WidthOf} from './types/core.ts';
import type {ImageBand, ImageLabel, ImageMark, LaidOutImage} from './types/image.ts';

/** Larger than this and rules.ts warns (`image-large`): the whole file travels inside every SVG, and again in every reveal stage. */
export const IMAGE_WARN_BYTES = 300 * 1024;

const PLATE_PAD_X = 8, PLATE_H_EXTRA = 14, MARK_STROKE = 3;

/** The font-size of a label plate: its own role, else the picture's, else 'note'. Read at call time (fill mode rewrites ROLES). */
const sizeOf = (band: ImageBand, roles: Roles, role?: LabelRole): number => roles[role ?? band.labelRole ?? 'note'];

/** Space between the picture's edge and the parts laid over it (`pad` overrides). */
export const IMAGE_PAD = 16;
/** The picture's drawn size in a content width `cw`: the one place it is worked out, so the width pass and the layout agree. */
export function imageSize(band: ImageBand, cw: number): {w: number; h: number} {
  if (band.unresolved) throw new Error(`image(${band.src}): the picture was not read — draw or check the diagram through renderDiagram() / checkDiagram() (they read it from the source's folder)`);
  const ar = band.naturalW / band.naturalH;
  let w = Math.min(band.width ?? cw, cw), h = w / ar;
  if (band.height !== undefined) { h = band.height; w = h * ar; if (w > cw) { w = cw; h = w / ar; } }
  return {w: Math.round(w), h: Math.round(h)};
}

/** Every string an image() draws, registered before its geometry is calculated. */
export function imageTexts(band: ImageBand, roles: Roles): [string, number, number, FontFamily][] {
  return [...(band.marks ?? []).flatMap(m => m.label ? [[m.label, sizeOf(band, roles, m.role)] as const] : []), ...(band.labels ?? []).map(l => [l.text, sizeOf(band, roles, l.role)] as const)]
    .map(([t, S]) => [t, S, 700, 'sans']);
}

type Life = {reveal?: number; until?: number};
/** When a mark / label is on screen: never before the picture (the later reveal) and never after it (the earlier until). */
function lifeOf(band: ImageBand, x: Life): Life {
  const reveal = Math.max(band.reveal ?? 0, x.reveal ?? 0), until = band.until === undefined ? x.until : x.until === undefined ? band.until : Math.min(band.until, x.until);
  return {...(reveal ? {reveal} : {}), ...(until === undefined ? {} : {until})};
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(Math.max(n, lo), Math.max(lo, hi));

export function layoutImage(band: ImageBand, x: number, y: number, cw: number, widthOf: WidthOf, roles: Roles): LaidOutImage {
  const {w, h} = imageSize(band, cw);
  const ix = x + Math.round(band.align === 'left' ? 0 : band.align === 'right' ? cw - w : (cw - w) / 2);
  const out: LaidOutImage = {
    type: 'image', id: band.id, x: ix, y, w, h, href: band.href, alt: band.alt, bytes: band.bytes, reveal: band.reveal, ...(band.until === undefined ? {} : {until: band.until}),
    marks: [], plates: [], anchors: [], ...(band.children?.length ? {backdrop: true} : {}),
  };
  const plate = (text: string, px: number, py: number, anchor: 'start' | 'middle' | 'end', tone: ImageMark['tone'], life: Life, role: LabelRole | undefined, mark?: number, atTop = false): void => {
    const S = sizeOf(band, roles, role), plateH = Math.ceil((S + PLATE_H_EXTRA) / 4) * 4; // a multiple of 4: the plate sits on the 4px grid
    if (atTop) py += plateH / 2;
    const tw = textWidth(widthOf, text, S, 700), pw = Math.ceil(tw + 2 * PLATE_PAD_X);
    const left = clamp(anchor === 'start' ? px : anchor === 'middle' ? px - pw / 2 : px - pw, ix, ix + w - pw);
    const top = clamp(py - plateH / 2, y, y + h - plateH);
    out.plates.push({x: Math.round(left), y: Math.round(top), w: pw, h: plateH, text, size: S, tone: tone ?? 'plain', ...life, mark});
  };
  (band.marks ?? []).forEach((m, i) => {
    const [fx, fy, fw, fh] = m.rect;
    const r = {x: Math.round(ix + fx * w), y: Math.round(y + fy * h), w: Math.round(fw * w), h: Math.round(fh * h)};
    const life = lifeOf(band, m), mark = {...r, id: m.id, tone: m.tone ?? 'accent', ...life};
    out.marks.push(mark);
    if (m.id) out.anchors.push({...r, id: m.id});
    // a mark's label is a tab on its top-left corner, inside the picture
    if (m.label) plate(m.label, r.x, r.y, 'start', m.tone ?? 'accent', life, m.role, i, true);
  });
  for (const l of band.labels ?? []) plate(l.text, ix + l.at[0] * w, y + l.at[1] * h, l.anchor ?? 'start', l.tone, lifeOf(band, l), l.role);
  return out;
}

/** What a plate in a tone looks like: fill, outline and text colour keys. */
export const plateStyle = (tones: ToneEnv, tone: ImageLabel['tone'] | undefined) => {
  const t = toneStyle(tones, tone ?? 'plain');
  return {fill: t.fill, stroke: t.stroke ?? t.fill, text: t.text, ink: t.ink};
};
export {MARK_STROKE};
