// Geometry constants and structural helpers shared by the layout passes (measure, layout handlers, connector resolution, emit):
// box padding, icon / step-badge sizes, the row() / grid() width distribution and the group title caption. No text metrics, no state.
import { textWidth } from './atoms.js';
export const LINE_HEIGHT_EM = 1.4; // vertical spacing between wrapped lines within one text block
export const BOX_PAD_X = 20;
export const BOX_PAD_Y = 16;
export const BOX_INNER_GAP = 8; // vertical gap between title/body/note runs within one box
// box({step}) badge geometry — a solid-fill numbered circle sitting on the
// title's own baseline (cy = titleBaselineY - STEP_BADGE_BASELINE_OFFSET,
// matching the offset every hand-authored "① foo" box in this deck already
// used between its badge circle and its own number glyph's baseline).
export const STEP_BADGE_R = 15;
export const STEP_BADGE_GAP = 10;
export const STEP_BADGE_BASELINE_OFFSET = 6;
export const STEP_INDENT = 2 * STEP_BADGE_R + STEP_BADGE_GAP; // how far the title's first line is pushed right to clear the badge
// box({icon}): an SVG icon drawn ICON_SIZE px square at the box's top-left; every text run is pushed right to clear it.
export const ICON_SIZE = 32;
export const ICON_INDENT = ICON_SIZE + 12;
export const ICON_H = ICON_SIZE; // the icon is at least this tall, so a one-line box still holds it
// box({icon, iconAt: 'top'}): the icon is centred above the text (node()); the text starts below it
export const TOP_ICON_SIZE = 48;
export const TOP_ICON_GAP = 8;
export const topIcon = (band) => band.icon !== undefined && band.iconAt === 'top';
/** What connect() joins to: the box — but for a node (icon above its text) the icon, so an arrow meets the picture, not its label. */
export function anchorRect(c, h = c.h) {
    if (c.type !== 'box' || !topIcon(c))
        return { x: c.x, y: c.y, w: c.w, h };
    const size = c.iconSize ?? TOP_ICON_SIZE;
    return { x: c.x + c.w / 2 - size / 2 - 4, y: c.y + (c.padY ?? BOX_PAD_Y), w: size + 8, h: size };
}
export const TAG_H = 24;
export const TAG_PAD_X = 8;
/** The narrowest a canvas() region may be (px): below it a title breaks a character or two per line. */
export const CANVAS_MIN_REGION_W = 96;
export const STAMP_H = 24, STAMP_GAP = 6;
const STAMP_PAD_X = 6; // the stamp chip and the strip reserved for it under the content
export const stampChipW = (widthOf, text, roles) => textWidth(widthOf, text, roles.note, 400) + 2 * STAMP_PAD_X;
export const LEGEND_SWATCH_W = 36, LEGEND_ITEM_GAP = 28, LEGEND_ROW_H = 24;
// group() title is laid out as a left-aligned bold caption inside the frame.
export function groupTitleBand(band) {
    return { type: 'caption', text: band.title, ...(band.spans?.title ? { spans: { text: band.spans.title } } : {}), align: band.titleAlign ?? 'left', role: 'title', bold: true, tone: band.titleTone ?? (band.tone === 'accent' ? 'accent' : 'text'), mono: false };
}
/** 1-based column and span of each row child on an N-column grid: `col` defaults to the column after the previous child. */
export function colSlots(children) {
    let next = 1;
    return children.map(c => { const span = c.span ?? 1, col = c.col ?? next; next = col + span; return { col, span }; });
}
// Structural width distribution for row()/grid() — pure arithmetic, no text
// metrics needed, so this can run in the same pass that registers measure
// requests (a child's wrap width must be known before we know what to wrap).
/** swimlane({fit: 'shrink'}) leaves the lane label / gap sizes alone while every column is at least this wide. */
export const SWIMLANE_COMFY_COL = 112;
/** The grid the emitter snaps box and group edges to (emit-boxes.ts snap4). */
export const GRID = 4;
const ceilGrid = (n) => Math.ceil(n / GRID - 1e-9) * GRID;
const roundGrid = (n) => Math.round(n / GRID) * GRID;
/** The nearest 4px grid line: where a band / box top is placed (ADR 0014 D1, U1b), so the emitter's snap never moves it. */
export const snapGrid = roundGrid;
/**
 * Column edges for `n` equal columns across `contentWidth`, decided ONCE per (width, n, gap) and shared by every row that uses it (ADR 0014 D1).
 * Every edge is a multiple of 4 from the left edge, so the emitter's snap never moves one. The gap is raised to the next multiple of 4 (a
 * label-driven gap is never lowered; `fixedGap` keeps it as given: a crosshair has none). Left over are `extra` grid steps (< n), that cannot
 * be shared out evenly:
 *  - exactly one step per gutter (and the gap is at least 16, so a step is a quarter at most): the gutters take it and the columns come out equal (900 wide, gap 16, 2 columns: 440 + 20 + 440, not 444 + 16 + 440);
 *  - otherwise the columns differ by at most one step, wider ones spread evenly and mirrored (the odd step goes to the middle column, or, with
 *    `centerGutter` (the 12-column grid only) and an even number of columns, to the middle gutter, so the two halves are equal).
 * `anyGap`: the gap may be widened by a step whatever its size (a figure's own, undeclared gutter, as the quadrant's).
 * `null` when the width is too small to give every column a grid step: the caller keeps the plain split.
 */
// add `by` to a[i]; NaN where the index is outside the array, as `a[i] += by` on a number array was
const bump = (a, i, by = 1) => { a[i] = (a[i] ?? NaN) + by; };
export function gridColumns(contentWidth, n, gap, opts = {}) {
    const g0 = n > 1 ? (opts.fixedGap ? gap : ceilGrid(Math.max(gap, 0))) : 0;
    const units = Math.floor((contentWidth - (n - 1) * g0) / GRID + 1e-9);
    if (units < n)
        return null;
    const base = Math.floor(units / n);
    let extra = units - base * n; // columns that get one more grid step
    const gutter = new Array(Math.max(n - 1, 0)).fill(g0);
    const add = new Array(n).fill(0);
    if (n > 1 && extra === n - 1 && !opts.fixedGap && (opts.anyGap || GRID <= 0.25 * g0)) {
        for (let k = 0; k < n - 1; k++)
            bump(gutter, k, GRID);
        extra = 0;
    }
    const odd = extra % 2 === 1;
    extra -= odd ? 1 : 0;
    // the rest in mirrored pairs, spread evenly over the left half
    const pairs = extra / 2, half = Math.floor(n / 2);
    for (let j = 0; j < pairs; j++) {
        const i = Math.min(half - 1, Math.floor((j + 0.5) * half / pairs));
        bump(add, i);
        bump(add, n - 1 - i);
    }
    if (odd) { // the odd step: the middle column, else (with centerGutter) the middle gutter, else the first column that has no step yet
        const mid = (n - 1) / 2;
        if (n % 2 === 1 && add[mid] === 0)
            bump(add, mid);
        else if (n % 2 === 0 && opts.centerGutter && !opts.fixedGap && (opts.anyGap || GRID <= 0.25 * g0))
            bump(gutter, n / 2 - 1, GRID);
        else
            bump(add, add.findIndex(v => v === 0));
    }
    const w = add.map(v => (base + v) * GRID);
    const x = [];
    let at = 0;
    w.forEach((v, k) => { x.push(at); at += v + (k < n - 1 ? gutter[k] ?? NaN : 0); });
    // (a width that is not a multiple of 4 leaves under one step unused at the right: the columns stay equal and symmetric)
    return { x, w };
}
export function rowChildGeometry(band, contentWidth) {
    const n = band.children.length;
    const gap = band.gap;
    if (band.cols) {
        // Shared column grid: every row declaring the same `cols` + `gap` gets
        // identical column edges, so a box spanning columns 1-2 sits exactly
        // above two boxes in columns 1 and 2 of the next row.
        const grid = gridColumns(contentWidth, band.cols, gap, { centerGutter: band.cols === 12 });
        const cw = (contentWidth - (band.cols - 1) * gap) / band.cols;
        const colX = (c) => grid ? grid.x[c] ?? NaN : c * (cw + gap);
        const colW = (c) => grid ? grid.w[c] ?? NaN : cw;
        let next = 1;
        const widths = [], xOffsets = [];
        for (const c of band.children) {
            const span = c.span ?? 1;
            const col = c.col ?? next;
            if (col < 1 || col + span - 1 > band.cols)
                throw new Error(`row({cols: ${band.cols}}): child "${c.title ?? c.id ?? '(box)'}" at col ${col} span ${span} falls outside the ${band.cols} columns`);
            const first = col - 1, last = col + span - 2;
            widths.push(colX(last) + colW(last) - colX(first));
            xOffsets.push(colX(first));
            next = col + span;
        }
        return { widths, xOffsets };
    }
    if (band.justify === 'stretch') {
        const flex0 = band.children[0]?.flex ?? 1;
        const equal = band.children.every(c => (c.flex ?? 1) === flex0);
        if (equal && n > 0) {
            const grid = gridColumns(contentWidth, n, gap);
            if (grid)
                return { widths: grid.w, xOffsets: grid.x };
        }
        else if (n > 0) {
            // unequal flex: split by the ratio, then round every boundary to the grid from the left (the gutter is a multiple of 4)
            const g = n > 1 ? ceilGrid(Math.max(gap, 0)) : 0;
            const avail = contentWidth - (n - 1) * g;
            const flexSum = band.children.reduce((s, c) => s + (c.flex ?? 1), 0);
            const widths = [], xOffsets = [];
            let x = 0, ok = avail > 0, cum = 0;
            band.children.forEach((c, i) => {
                cum += c.flex ?? 1;
                // every boundary is rounded from its own cumulative position, so the rounding never builds up on the last child
                const right = i === n - 1 ? Math.floor(contentWidth / GRID + 1e-9) * GRID : roundGrid(avail * cum / flexSum + i * g);
                if (right - x < GRID)
                    ok = false;
                xOffsets.push(x);
                widths.push(right - x);
                x = right + g;
            });
            if (ok)
                return { widths, xOffsets };
        }
        const avail = contentWidth - (n - 1) * gap;
        const flexSum = band.children.reduce((s, c) => s + (c.flex ?? 1), 0);
        const widths = band.children.map(c => avail * (c.flex ?? 1) / flexSum);
        const xOffsets = [];
        let x = 0;
        for (const w of widths) {
            xOffsets.push(x);
            x += w + gap;
        }
        return { widths, xOffsets };
    }
    // fixed-width children, block start- or center-aligned
    const widths = band.children.map(c => c.width ?? band.itemWidth ?? 160);
    const blockWidth = widths.reduce((s, w) => s + w, 0) + (n - 1) * gap;
    const start = band.justify === 'center' ? (contentWidth - blockWidth) / 2 : 0;
    const xOffsets = [];
    let x = start;
    for (const w of widths) {
        xOffsets.push(x);
        x += w + gap;
    }
    return { widths, xOffsets };
}
export function gridChildGeometry(band, contentWidth) {
    const cols = band.cols;
    const gap = band.gap;
    const grid = gridColumns(contentWidth, cols, gap);
    const cellWidth = (contentWidth - (cols - 1) * gap) / cols; // (the plain split, when the width cannot give every column a grid step)
    return { xs: grid ? grid.x : Array.from({ length: cols }, (_, j) => j * (cellWidth + gap)), ws: grid ? grid.w : new Array(cols).fill(cellWidth) };
}
/**
 * diagram({sourceLine}) is always the last band: left-aligned, muted, note size, whatever was add()ed and in whatever order.
 * Returns a copy (the input is not changed); without a sourceLine, the input itself.
 */
/** diagram({showTitle}) puts the title first, drawn like a group's title (bold, left, title size). A copy; without showTitle, the input itself. */
export function withTitleLine(d) {
    return !d.showTitle || !d.title ? d : { ...d, bands: [{ type: 'caption', text: d.title, align: 'left', role: 'title', tone: 'text', bold: true, mono: false, titleLine: true }, ...d.bands] };
}
export function withSourceLine(d) {
    return d.sourceLine === undefined ? d : { ...d, bands: [...d.bands, { type: 'caption', text: d.sourceLine, align: 'left', role: 'note', tone: 'muted', bold: false, mono: false, sourceLine: true }] };
}
