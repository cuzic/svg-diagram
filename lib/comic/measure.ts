// Pass 1 of the layout (ADR 0074 D5): the atoms the band needs measured. A full-width atom is never measured (it is 1 em), a blank is `max` em, so only
// the Latin runs of the literal text are registered (at the comic's one text size).
import {splitAtoms} from '../atoms.ts';
import {FONT} from './constants.ts';
import {parseTemplate} from './template.ts';
import {isFullWidth} from './width.ts';
import type {ComicBand} from '../types/comic.ts';
import type {FontFamily} from '../types/core.ts';

export function comicMeasure(band: ComicBand): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const p of band.sheet.panels) for (const d of p.dialogue) {
    for (const part of parseTemplate(d.tpl)) if ('lit' in part) for (const a of splitAtoms(part.lit)) if (!isFullWidth(a)) out.push([a, FONT, 400, 'sans']);
  }
  return out;
}
