// Pass 1 of the layout: the Latin runs of the literal text at the bubble size (and each of their characters: a word wider than the column is broken per
// character), and the speakers' names beside their faces.
import {splitAtoms} from '../atoms.ts';
import {FONT, metricsOf} from '../comic/constants.ts';
import {parseTemplate} from '../comic/template.ts';
import {isFullWidth} from '../comic/width.ts';
import type {ChatBand} from '../types/chat.ts';
import type {FontFamily} from '../types/core.ts';

export function chatMeasure(band: ChatBand): [string, number, number, FontFamily][] {
  const font = band.fontSize ?? FONT;
  const out: [string, number, number, FontFamily][] = [];
  for (const d of band.sheet.dialogue) {
    for (const part of parseTemplate(d.tpl)) if ('lit' in part) for (const a of splitAtoms(part.lit)) if (!isFullWidth(a)) {
      out.push([a, font, 400, 'sans']);
      for (const ch of a) if (ch !== a) out.push([ch, font, 400, 'sans']);
    }
  }
  for (const c of Object.values(band.sheet.cast)) for (const a of splitAtoms(c.name)) if (!isFullWidth(a)) out.push([a, metricsOf(font).slotFont, 400, 'sans']);
  return out;
}
