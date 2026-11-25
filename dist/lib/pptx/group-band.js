import { register } from './adapter.js';
import { namedAs } from './prims.js';
import { groupFrameXml } from './shapes.js';
export const groupPptx = (band, ctx) => {
    const id = ctx.next();
    register(ctx, band.id, id, band);
    return groupFrameXml(id, namedAs('frame', '', band.id), band, band.tone, band.dashed, ctx.ld.day, ctx.tones);
};
