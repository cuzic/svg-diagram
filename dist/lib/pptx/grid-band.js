import { visibleAt } from '../reveal-visibility.js';
import { boxPptx } from './box-band.js';
import { groupXml } from './shapes.js';
const verticalExtent = (children) => {
    const y = Math.min(...children.map(c => c.y));
    return { y, h: Math.max(...children.map(c => c.y + c.h)) - y };
};
export const gridPptx = (band, ctx) => {
    const gid = ctx.next();
    const inner = band.children.filter(c => visibleAt(c, ctx.stage)).map(c => boxPptx(c, ctx)).join('');
    return groupXml(gid, 'grid', { ...verticalExtent(band.children), x: band.x, w: band.w }, inner);
};
