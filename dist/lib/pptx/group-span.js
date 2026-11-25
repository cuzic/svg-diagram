import { partStep } from '../parts.js';
import { partName } from './parts-group.js';
import { groupXml } from './shapes.js';
/** Keep a group frame, title and its contained bands together (ADR 0054 D5). */
export const groupSpan = (band, { ctx, index, following, drawBand, drawChildren }) => {
    const count = Math.min(band.span ?? 0, following.length);
    // Grid snapping can move a title or a child a few pixels past the frame.
    if (count <= 0 || following.slice(0, count).some(child => 'y' in child && 'h' in child && (child.y < band.y - 8 || child.y + child.h > band.y + band.h + 8)))
        return undefined;
    const inner = drawBand() + drawChildren(count, true);
    const name = partName(partStep('group', band.id ?? index, band.title ?? ''));
    return { xml: groupXml(ctx.next(), name, band, inner), count };
};
export { groupPptx } from './group-band.js';
