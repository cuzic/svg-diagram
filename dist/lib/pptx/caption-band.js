import { linesText, namedAs } from './prims.js';
import { boxXml } from './shapes.js';
/** Text only: no frame, no padding (the svg writes it at band.x / band.y). Its `tone` colours the text, which the runs already carry, so it is not passed as the box's. */
export const captionPptx = (band, ctx) => {
    const id = ctx.next();
    const text = { ...band, tone: undefined, frame: false, padX: 0, padY: 0, align: band.align ?? 'center' };
    return boxXml(id, namedAs('caption', linesText(text.wrappedRuns.flatMap(run => run.lines))), text, ctx.ld.day, ctx.tones, ctx.fonts);
};
