import type {LaidOutOf} from '../band-table.ts';
import type {PptxAdapter} from './adapter.ts';
import {timelineXml} from './timeline.ts';

export const timelinePptx: PptxAdapter<LaidOutOf<'timeline'>> = (band, ctx) => band.dim ? undefined : timelineXml(band, ctx.ld, ctx.fonts, ctx.next);
