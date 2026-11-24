import type {LaidOutOf} from '../band-table.ts';
import type {BandXml} from './adapter.ts';
import {linesText, namedAs} from './prims.ts';
import {boxXml} from './shapes.ts';
import type {TextBox} from './shapes.ts';

/** Text only: no frame, no padding (the svg writes it at band.x / band.y). Its `tone` colours the text, which the runs already carry, so it is not passed as the box's. */
export const captionPptx: BandXml<LaidOutOf<'caption'>> = (band, ctx) => {
  const id = ctx.next();
  const text: TextBox = {...band, tone: undefined, frame: false, padX: 0, padY: 0, align: band.align ?? 'center'};
  return boxXml(id, namedAs('caption', linesText(text.wrappedRuns.flatMap(run => run.lines))), text, ctx.ld.day, ctx.tones, ctx.fonts);
};
