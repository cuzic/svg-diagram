import { textRuns } from './html-text-runs.js';
function caption(b, day, tones, fb) {
    return textRuns(b.wrappedRuns, { originX: b.x, originY: b.y, w: b.w, align: b.align ?? 'center', day, tones, fb, dim: b.dim });
}
export const captionHtml = { type: 'caption', accepts: b => !b.tagBox, render: caption };
