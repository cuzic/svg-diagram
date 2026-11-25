import { textWidth } from './atoms.js';
import { layoutBoxContent, lineWidth } from './layout-text.js';
import { BOX_PAD_X, BOX_PAD_Y, ICON_H, STAMP_GAP, STAMP_H, TAG_H, TAG_PAD_X, TOP_ICON_GAP, TOP_ICON_SIZE, snapGrid, stampChipW, topIcon } from './layout-util.js';
import { must } from './must.js';
import { TAG_SIZE } from './tokens.js';
export function layoutBoxLike(band, x, y0, w, isBoxLike, widthOf, roles, wrap) {
    const y = snapGrid(y0); // the top sits on the grid, so its text (y + padY + line offset) is always the same distance below the frame the emitter draws
    const chrome = band; // caption has no padX / padY / tag / id: they read as undefined (its `tone` is a TextTone, unused here)
    const wrapWidth = isBoxLike ? w - 2 * (chrome.padX ?? BOX_PAD_X) : w;
    const content = layoutBoxContent(band, wrapWidth, widthOf, roles, wrap);
    // an icon above the text pushes every line down by its own height; a left icon only sets a minimum height
    const topShift = band.type === 'box' && topIcon(band) ? (band.iconSize ?? TOP_ICON_SIZE) + TOP_ICON_GAP : 0;
    // a left icon is taller than a line or two of text: the text is centred beside it, not hung from the top with the room left below
    const leftIcon = band.type === 'box' && !!band.icon && !topShift;
    const centre = leftIcon && content.textHeight < ICON_H ? Math.round((ICON_H - content.textHeight) / 2) : 0;
    const shift = topShift + centre;
    const wrappedRuns = shift ? content.wrappedRuns.map(r => ({ ...r, lineYs: r.lineYs.map(y => y + shift) })) : content.wrappedRuns;
    const textHeight = leftIcon ? Math.max(content.textHeight, ICON_H) : content.textHeight + topShift;
    const stamp = isBoxLike ? chrome.stamp : undefined;
    const stampW = stamp ? stampChipW(widthOf, stamp, roles) : undefined;
    if (stampW !== undefined && stampW > w - 16)
        throw new Error(`stamp "${stamp}" is wider than its box (${Math.round(w)}px): shorten it or widen the box`);
    const h = (isBoxLike ? textHeight + 2 * (chrome.padY ?? BOX_PAD_Y) : textHeight) + (stamp ? STAMP_H + STAMP_GAP : 0);
    const placed = { ...band, x, y, w, h, wrappedRuns }; // spreading a generic loses the intersection
    if (stampW !== undefined)
        placed.stampW = stampW;
    // a centred / right-aligned title: the step badge sits just before its first line, so emit needs that line's width
    if (band.type === 'box' && band.step != null && band.title && (band.align ?? (topIcon(band) ? 'center' : 'left')) !== 'left')
        placed.titleW = lineWidth(widthOf, must(wrappedRuns[0]), 0);
    if (band.type === 'box') {
        const overflow = [];
        for (const r of wrappedRuns) {
            if (!r.nowrap)
                continue;
            const width = textWidth(widthOf, r.text, r.size, r.weight, r.mono ? 'mono' : 'sans'), avail = wrapWidth - (r.indent ?? 0);
            if (width > avail + 0.5)
                overflow.push({ value: r.text, width, avail, min: r.size }); // r.size: a value that may shrink is drawn at its floor by now
        }
        if (overflow.length)
            placed.nowrapOverflow = overflow;
        const shrunk = wrappedRuns.filter(r => r.shrunkFrom !== undefined).map(r => ({ value: r.text, from: r.shrunkFrom ?? r.size, to: r.size }));
        if (shrunk.length)
            placed.statShrunk = shrunk;
    }
    if (chrome.tag) {
        const tw = textWidth(widthOf, chrome.tag, (roles.tag ?? TAG_SIZE), 700) + 2 * TAG_PAD_X;
        placed.tagBox = { x: chrome.tagAt === undefined ? x + w - tw - 12 : x + w * chrome.tagAt - tw / 2, y: y - TAG_H / 2, w: tw, h: TAG_H };
    }
    return placed;
}
/** caption / box / banner (and, as before, anything a handler does not claim). */
export function layoutBoxLikeBand(band, ctx, padX, cw) {
    const isBoxLike = band.type === 'box' || band.type === 'banner';
    const placed = ctx.placeBoxLike(band, padX, ctx.y, cw, isBoxLike);
    ctx.laidOut.push(placed);
    ctx.y += placed.h + ctx.d.gap;
}
