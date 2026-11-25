import { pyramidXml } from './pyramid.js';
export const pyramidPptx = (band, ctx) => pyramidXml(band, ctx.ld, ctx.fonts, ctx.next);
