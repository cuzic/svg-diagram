import { sizeOf } from './charts-base.js';
export function placeChart(band, x, y, w, widthOf, roles, wrap, geom, layout) {
    const size = sizeOf(band.labelRole, roles), width = Math.min(w, band.width ?? w), left = x + (w - width) / 2;
    const part = layout({ x: left, y, w: width, height: band.height, size, geom, widthOf, wrap });
    return { type: 'chart', kind: band.kind, id: band.id, alt: band.alt, size, x: left, y, w: width, ...part, ...(band.reveal === undefined ? {} : { reveal: band.reveal }), ...(band.until === undefined ? {} : { until: band.until }) };
}
