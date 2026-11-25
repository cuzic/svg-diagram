import { shape } from './html-frame.js';
import { textRuns } from './html-text-runs.js';
import { BOX_PAD_X, BOX_PAD_Y } from './layout-util.js';
function box(b, day, tones, fb) {
    const px_ = b.padX ?? BOX_PAD_X, py = b.padY ?? BOX_PAD_Y;
    return shape(b, b, day, tones, 'plain') + textRuns(b.wrappedRuns, { originX: b.x + px_, originY: b.y + py, w: b.w - 2 * px_, align: b.align ?? 'left', day, tones, fb, dim: b.dim, boxTone: b.tone });
}
export const boxHtml = {
    type: 'box',
    accepts: b => b.step == null && !b.icon && !b.tagBox && !b.stamp,
    render: box,
};
