// The contact sheet as one SVG: a frame per figure with its file name above it, laid out in `cols` columns of one common width.
import path from 'node:path';
import { embedSvg, svgSize } from './raster.js';
const PAD = 16, GAP = 20, FRAME = 8, CAPTION = 22;
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
/** `figures`: [file name (for the caption), SVG text]. Throws, naming the file, for one without a width/height or viewBox. */
export function buildSheet(figures, { cols = 2, width = 1400 } = {}) {
    cols = Math.max(1, Math.floor(cols));
    const cellW = Math.floor((width - 2 * PAD - GAP * (cols - 1)) / cols);
    if (cellW <= 2 * FRAME)
        throw new Error(`--width ${width} is too narrow for ${cols} column(s)`);
    const cells = figures.map(([name, svg]) => {
        const size = svgSize(svg);
        if (!size)
            throw new Error(`${name}: no width/height (or viewBox) on the root element`);
        const imgW = cellW - 2 * FRAME, imgH = Math.round(imgW * size.h / size.w);
        return { name, svg, imgW, imgH, h: CAPTION + imgH + 2 * FRAME };
    });
    let y = PAD, n = 0;
    const body = [];
    for (let r = 0; r * cols < cells.length; r++) {
        const row = cells.slice(r * cols, (r + 1) * cols);
        const rowH = Math.max(...row.map(c => c.h));
        row.forEach((c, i) => {
            const x = PAD + i * (cellW + GAP);
            body.push(`<rect x="${x}" y="${y}" width="${cellW}" height="${c.h}" fill="#ffffff" stroke="#e0d6c5"/>`, `<text x="${x + FRAME}" y="${y + FRAME + 14}" font-size="14" fill="#6f6659">${esc(path.basename(c.name))}</text>`, embedSvg(c.svg, { x: x + FRAME, y: y + FRAME + CAPTION, w: c.imgW, h: c.imgH }, `f${n++}-`));
        });
        y += rowH + GAP;
    }
    const height = (cells.length ? y - GAP : y) + PAD;
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ffffff"/>${body.join('')}</svg>`, width, height };
}
/** Splits `items` into pages of `perPage` (the last may be short), or into exactly `pages` pages (at most one per item)
 *  whose sizes differ by at most one, the larger first; neither given: one page. */
export function paginate(items, { perPage, pages } = {}) {
    const out = [];
    if (perPage && Math.floor(perPage) >= 1) {
        const size = Math.floor(perPage);
        for (let i = 0; i < items.length; i += size)
            out.push(items.slice(i, i + size));
    }
    else if (pages && Math.floor(pages) >= 1 && items.length) {
        const n = Math.min(Math.floor(pages), items.length), base = Math.floor(items.length / n), extra = items.length % n;
        for (let p = 0, i = 0; p < n; p++) {
            const k = base + (p < extra ? 1 : 0);
            out.push(items.slice(i, i + k));
            i += k;
        }
    }
    return out.length ? out : [items];
}
/** `sheet.png` -> `sheet-1.png`, `sheet-2.png`, ... (1-based); a single page keeps the name as given. */
export function pageName(out, index, total) {
    if (total <= 1)
        return out;
    const ext = path.extname(out);
    return `${out.slice(0, out.length - ext.length)}-${index + 1}${ext}`;
}
