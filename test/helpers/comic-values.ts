import {comic} from '../../lib/dsl/comic.ts';
import {layoutComic} from '../../lib/comic/layout.ts';
import type {ComicSlotDef, ComicWorksheet} from '../../lib/types/comic.ts';
import type {WidthOf} from '../../lib/types/core.ts';
import {SAMPLE} from './comic-sample.ts';

export const measure = ({text, size}: {text: string; size: number}) => ({w: [...text].length * size, h: size});
export const widthOf: WidthOf = (text, size) => measure({text, size}).w;
export const lay = (sheet = SAMPLE) => layoutComic(comic(sheet), 0, 0, 0, widthOf);

export function withDay(def: Partial<ComicSlotDef>): ComicWorksheet {
  const [p1, ...others] = SAMPLE.panels;
  const [d1] = p1!.dialogue;
  return {...SAMPLE, panels: [{...p1!, dialogue: [{...d1!, slots: {day: {...d1!.slots!['day']!, ...def}}}]}, ...others]};
}

export const slotSvg = (svg: string, id: string) => svg.match(new RegExp(`<g data-slot="${id}"[^>]*>.*?</g>`, 's'))?.[0] ?? '';
export const withoutSlotsAndTitles = (svg: string) => svg.replace(/<g data-slot="[^"]*"[^>]*>.*?<\/g>|<title>.*?<\/title>/gs, '');
