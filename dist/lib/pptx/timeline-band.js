import { timelineXml } from './timeline.js';
export const timelinePptx = (band, ctx) => band.dim ? undefined : timelineXml(band, ctx.ld, ctx.fonts, ctx.next);
