import { renderTextRuns } from './emit-common.js';
export function captionTextPlacement(band) {
    return { originX: band.x, originY: band.y, w: band.w, align: band.align ?? 'center' };
}
export function renderCaption(band, day, tones) {
    return renderTextRuns(band.wrappedRuns, { ...captionTextPlacement(band), day, tones, dim: band.dim });
}
export const captionSpotlight = {
    dim(laid, focus) {
        // The title and pinned source line are furniture.
        if (!laid.sourceLine && !laid.titleLine)
            laid.dim = !focus.contains(laid);
    },
};
