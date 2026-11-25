import { textWidth } from './atoms.js';
const DOT_GAP = 3, LABEL_GAP = 6, BAR_H = 8, AXIS_GAP = 4;
// every shape coordinate sits on the 4px grid (the lint's coordinate-grid advisory fails a build), so the piles are packed on it
const snap4 = (v) => Math.round(v / 4) * 4, ceil4 = (v) => Math.ceil(v / 4) * 4;
/** Every string a dots() band draws, registered before its geometry is calculated. */
export function dotsTexts(band, roles) {
    const S = roles.note;
    return [band.lowLabel, band.highLabel, ...band.zones.map(z => z.label)].flatMap(t => t ? [[t, S, 400, 'sans']] : []);
}
export function layoutDots(band, x, y, cw, widthOf, day, roles) {
    const S = roles.note, r = band.r, w = Math.min(band.width ?? cw, cw), left = x + (cw - w) / 2;
    const plotL = left + r + 2, plotR = left + w - r - 2;
    if (plotR - plotL < 80)
        throw new Error('dots(): the lane is too narrow — raise width');
    const px = (v) => plotL + (v - band.min) / (band.max - band.min) * (plotR - plotL);
    // piles: left to right, each dot takes the lowest row whose last dot is far enough away (rows never touch each other:
    // their pitch is a whole dot plus the gap)
    const pitch = ceil4(2 * r + DOT_GAP), lastX = [];
    const sorted = band.dots.map((d, i) => ({ ...d, i })).sort((a, b) => a.at - b.at || a.i - b.i);
    const placed = sorted.map(d => {
        const cx = snap4(px(d.at));
        let row = lastX.findIndex(lx => cx - lx >= pitch);
        if (row < 0)
            row = lastX.length;
        lastX[row] = cx;
        const zone = band.zones.find(z => d.at >= z.from && d.at <= z.to);
        return { x: cx, row, tone: d.tone ?? zone?.tone ?? 'accent' };
    });
    const rows = Math.max(1, lastX.length), base = ceil4(BAR_H / 2 + AXIS_GAP + r), pileH = base - r + (rows - 1) * pitch + 2 * r;
    const labelled = !!(band.lowLabel || band.highLabel || band.zones.length);
    const labelH = labelled ? LABEL_GAP + S + 4 : 0;
    const need = pileH + BAR_H / 2 + labelH + 4;
    if (band.height !== undefined && band.height < need)
        throw new Error(`dots(): height ${band.height} is too small for its tallest pile (need at least ${Math.ceil(need)})`);
    const h = band.height ?? need;
    const axisY = ceil4(y + h - BAR_H / 2 - labelH);
    const out = {
        type: 'dots', id: band.id, x: left, y, w, h, day, alt: band.alt, r,
        axis: { x1: snap4(plotL), x2: snap4(plotR), y: axisY },
        dots: placed.map(p => ({ x: p.x, y: axisY - base - p.row * pitch, tone: p.tone })),
        zones: band.zones.map(z => ({ x: snap4(px(z.from)), w: snap4(px(z.to)) - snap4(px(z.from)), y: axisY, tone: z.tone, top: axisY - ceil4(base + (rows - 1) * pitch + r) })), texts: [],
    };
    const boxes = [];
    const text = (t, tx, anchor, clamp = false) => {
        if (!t)
            return;
        const tw = textWidth(widthOf, t, S, 400);
        let x1 = anchor === 'start' ? tx : anchor === 'end' ? tx - tw : tx - tw / 2;
        if (clamp)
            x1 = Math.max(left, Math.min(left + w - tw, x1));
        if (x1 < left - 0.5 || x1 + tw > left + w + 0.5)
            throw new Error(`dots(): the label "${t}" leaves the figure — shorten it or raise width`);
        for (const b of boxes)
            if (x1 < b.x2 + 8 && x1 + tw > b.x1 - 8)
                throw new Error(`dots(): the labels "${b.what}" and "${t}" overlap — shorten them or raise width`);
        boxes.push({ x1, x2: x1 + tw, what: t });
        out.texts.push({ text: t, x: x1 + tw / 2, y: y + h - 4, anchor: 'middle', size: S });
    };
    text(band.lowLabel, left, 'start');
    text(band.highLabel, left + w, 'end');
    for (const z of band.zones)
        text(z.label, (px(z.from) + px(z.to)) / 2, 'middle', true);
    return out;
}
