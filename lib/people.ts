import {textWidth} from './atoms.ts';
import type {FontFamily, Theme, WidthOf, Roles} from './types/core.ts';
import type {LaidOutPeople, PeopleBand} from './types/people-dots.ts';

/** The person icon is drawn from the 4..20 square of its 24px box; the rest is margin. */
export const PERSON_BOX = {from: 4, size: 16};
/** people()'s own glyph (a head and shoulders, in the 24px box) — part of the primitive, not an installable icon. */
export const PERSON_PATH = 'M12 4a4 4 0 1 1 0 8a4 4 0 0 1 0-8M12 14c4.42 0 8 1.79 8 4v2H4v-2c0-2.21 3.58-4 8-4z';

const SIDE_GAP = 24;
const sideRole = (band: PeopleBand, roles: Roles) => roles[band.side?.size ?? 'stat'];

/** Every string a people() band draws beside its grid, registered before its geometry is calculated. */
export function peopleTexts(band: PeopleBand, roles: Roles): [string, number, number, FontFamily][] {
  if (!band.side) return [];
  return [[band.side.value, sideRole(band, roles), 700, 'sans'], ...(band.side.label ? [[band.side.label, roles.note, 400, 'sans'] as [string, number, number, FontFamily]] : [])];
}

export function layoutPeople(band: PeopleBand, x: number, y: number, cw: number, widthOf: WidthOf, day: Theme, roles: Roles): LaidOutPeople {
  const {cols, size, gap, side} = band, rows = Math.ceil(band.total / cols);
  const gw = cols * size + (cols - 1) * gap, gh = rows * size + (rows - 1) * gap;
  const V = sideRole(band, roles), N = roles.note;
  const vw = side ? textWidth(widthOf, side.value, V, 700) : 0, lw = side?.label ? textWidth(widthOf, side.label, N, 400) : 0;
  const tw = Math.max(vw, lw), w = side ? gw + SIDE_GAP + tw : gw;
  if (w > cw) throw new Error(`people(): ${cols} icons of ${size}px${side ? ' and the number beside them' : ''} are ${Math.ceil(w)}px wide, the column is ${cw}px — use fewer cols, a smaller size or gap`);
  const left = band.align === 'left' ? x : x + (cw - w) / 2;
  const icons = Array.from({length: band.total}, (_, i) => ({x: left + (i % cols) * (size + gap), y: y + Math.floor(i / cols) * (size + gap), on: i < band.count + band.count2, ...(i >= band.count && i < band.count + band.count2 ? {second: true as const} : {})}));
  const texts: LaidOutPeople['texts'] = [];
  let h = gh;
  if (side) {
    const th = V * 1.2 + (side.label ? 6 + N * 1.4 : 0);
    h = Math.max(gh, th);
    const top = y + (h - th) / 2, tx = left + gw + SIDE_GAP;
    texts.push({text: side.value, x: tx, y: top + V, size: V, bold: true, tone: side.tone});
    if (side.label) texts.push({text: side.label, x: tx, y: top + V * 1.2 + 6 + N, size: N, bold: false, tone: 'muted'});
  }
  return {type: 'people', id: band.id, x: left, y, w, h, day, tone: band.tone, tone2: band.tone2, rest: band.rest, alt: band.alt, size, icons, texts};
}
