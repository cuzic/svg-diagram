import { legendNative, legendXml } from './legend.js';
/** A legend as shapes (./legend.ts), unless it has a sample not drawn as shapes yet. */
export const legendPptx = (band, ctx) => legendNative(band) ? legendXml(band, ctx.ld, ctx.tones, ctx.fonts, ctx.next) : undefined;
