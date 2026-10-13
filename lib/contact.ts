// The contact sheet as one SVG: a frame per figure with its file name above it, laid out in `cols` columns of one common width.
import path from 'node:path';
import {embedSvg, svgSize} from './raster.ts';

const PAD = 16, GAP = 20, FRAME = 8, CAPTION = 22;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

export interface Sheet {svg: string; width: number; height: number}

/** `figures`: [file name (for the caption), SVG text]. Throws, naming the file, for one without a width/height or viewBox. */
export function buildSheet(figures: [string, string][], {cols = 2, width = 1400}: {cols?: number; width?: number} = {}): Sheet {
  cols = Math.max(1, Math.floor(cols));
  const cellW = Math.floor((width - 2 * PAD - GAP * (cols - 1)) / cols);
  if (cellW <= 2 * FRAME) throw new Error(`--width ${width} is too narrow for ${cols} column(s)`);
  const cells = figures.map(([name, svg]) => {
    const size = svgSize(svg);
    if (!size) throw new Error(`${name}: no width/height (or viewBox) on the root element`);
    const imgW = cellW - 2 * FRAME, imgH = Math.round(imgW * size.h / size.w);
    return {name, svg, imgW, imgH, h: CAPTION + imgH + 2 * FRAME};
  });
  let y = PAD, n = 0;
  const body: string[] = [];
  for (let r = 0; r * cols < cells.length; r++) {
    const row = cells.slice(r * cols, (r + 1) * cols);
    const rowH = Math.max(...row.map(c => c.h));
    row.forEach((c, i) => {
      const x = PAD + i * (cellW + GAP);
      body.push(
        `<rect x="${x}" y="${y}" width="${cellW}" height="${c.h}" fill="#ffffff" stroke="#e0d6c5"/>`,
        `<text x="${x + FRAME}" y="${y + FRAME + 14}" font-size="14" fill="#6f6659">${esc(path.basename(c.name))}</text>`,
        embedSvg(c.svg, {x: x + FRAME, y: y + FRAME + CAPTION, w: c.imgW, h: c.imgH}, `f${n++}-`),
      );
    });
    y += rowH + GAP;
  }
  const height = (cells.length ? y - GAP : y) + PAD;
  return {svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="#ffffff"/>${body.join('')}</svg>`, width, height};
}

/** Splits `items` into pages of `perPage`, or into `pages` pages of near-equal size; neither given: one page. */
export function paginate<T>(items: T[], {perPage, pages}: {perPage?: number; pages?: number} = {}): T[][] {
  const size = perPage ? Math.floor(perPage) : pages ? Math.ceil(items.length / Math.floor(pages)) : items.length;
  if (!(size >= 1)) return [items];
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** `sheet.png` -> `sheet-1.png`, `sheet-2.png`, ... (1-based); a single page keeps the name as given. */
export function pageName(out: string, index: number, total: number): string {
  if (total <= 1) return out;
  const ext = path.extname(out);
  return `${out.slice(0, out.length - ext.length)}-${index + 1}${ext}`;
}
