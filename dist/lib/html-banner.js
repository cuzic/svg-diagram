import { shape } from './html-frame.js';
import { textRuns } from './html-text-runs.js';
import { BOX_PAD_X, BOX_PAD_Y } from './layout-util.js';
function banner(b, day, tones, fb) {
    const px_ = b.padX ?? BOX_PAD_X, py = b.padY ?? BOX_PAD_Y;
    return shape(b, b, day, tones, 'accent') + textRuns(b.wrappedRuns, { originX: b.x + px_, originY: b.y + py, w: b.w - 2 * px_, align: b.align ?? 'center', day, tones, fb, dim: b.dim, boxTone: b.tone });
}
export const bannerHtml = { type: 'banner', accepts: b => !b.tagBox && !b.stamp, render: banner };
