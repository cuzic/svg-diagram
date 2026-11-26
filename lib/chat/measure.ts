// Pass 1 of the layout: the Latin runs of the literal text at the bubble size, and the placeholder of the message box.
import {splitAtoms} from '../atoms.ts';
import {FONT} from '../comic/constants.ts';
import {parseTemplate} from '../comic/template.ts';
import {isFullWidth} from '../comic/width.ts';
import type {ChatBand} from '../types/chat.ts';
import type {FontFamily} from '../types/core.ts';
import {INPUT_FONT} from './constants.ts';

export function chatMeasure(band: ChatBand): [string, number, number, FontFamily][] {
  const out: [string, number, number, FontFamily][] = [];
  for (const d of band.sheet.dialogue) {
    for (const part of parseTemplate(d.tpl)) if ('lit' in part) for (const a of splitAtoms(part.lit)) if (!isFullWidth(a)) out.push([a, FONT, 400, 'sans']);
  }
  if (band.input !== undefined) for (const a of splitAtoms(band.input)) if (!isFullWidth(a)) out.push([a, INPUT_FONT, 400, 'sans']);
  return out;
}
