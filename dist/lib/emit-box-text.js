import { renderTextRuns } from './emit-common.js';
import { BOX_PAD_X, BOX_PAD_Y } from './layout-util.js';
export function boxTextPlacement(band) {
    const align = band.align ?? (band.type === 'banner' || band.iconAt === 'top' ? 'center' : 'left');
    const px = band.padX ?? BOX_PAD_X, py = band.padY ?? BOX_PAD_Y;
    return { originX: band.x + px, originY: band.y + py, w: band.w - 2 * px, align };
}
export function renderBoxText(band, day, tones) {
    return renderTextRuns(band.wrappedRuns, { ...boxTextPlacement(band), day, tones, dim: band.dim, boxTone: band.tone });
}
