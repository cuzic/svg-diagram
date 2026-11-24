import type {LaidOutOf} from '../band-table.ts';
import type {PptxAdapter} from './adapter.ts';
import {pyramidXml} from './pyramid.ts';

export const pyramidPptx: PptxAdapter<LaidOutOf<'pyramid'>> = (band, ctx) => pyramidXml(band, ctx.ld, ctx.fonts, ctx.next);
