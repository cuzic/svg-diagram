import type {LaidOutOf} from '../band-table.ts';
import type {PptxAdapter} from './adapter.ts';
import {legendNative, legendXml} from './legend.ts';

/** A legend as shapes (./legend.ts), unless it has a sample not drawn as shapes yet. */
export const legendPptx: PptxAdapter<LaidOutOf<'legend'>> = (band, ctx) => legendNative(band) ? legendXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next) : undefined;
