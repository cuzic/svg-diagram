/** The most columns / rows a template may have. */
export const AREAS_MAX_TRACKS = 12;
/** A name: what canvas() takes as an id (ASCII, so a full-width space or a typo stands out). */
const NAME = /^[A-Za-z][A-Za-z0-9_-]*$/;
/**
 * Reads a template: a string (rows split by newlines; blank lines at the start and the end and the indentation dropped) or an array of
 * row strings. Throws, naming the row (and column), when a row is blank, the rows have different numbers of cells, a cell is not a
 * name or `.`, a full-width space is used, a row is all `.`, a name is not a rectangle, or there are more than 12 columns / rows.
 */
export function parseAreaTemplate(template) {
    const where = 'areas(template)';
    let lines;
    if (typeof template === 'string') {
        lines = template.split(/\r?\n/).map((text, i) => ({ text, line: i + 1 }));
        while (lines.length && !lines[0]?.text.trim())
            lines.shift();
        while (lines.length && !lines[lines.length - 1]?.text.trim())
            lines.pop();
    }
    else if (Array.isArray(template)) {
        lines = template.map((text, i) => {
            if (typeof text !== 'string')
                throw new Error(`${where}: row ${i + 1} is not a string (got ${JSON.stringify(text)})`);
            return { text, line: i + 1 };
        });
    }
    else
        throw new Error(`${where}: the template is a string (one row per line) or an array of row strings`);
    if (!lines.length)
        throw new Error(`${where}: the template is empty — write one row per line, e.g. "a b" / "c c"`);
    const grid = lines.map(({ text, line }) => {
        const wide = text.indexOf('　');
        if (wide >= 0)
            throw new Error(`${where}: line ${line}, column ${wide + 1} has a full-width space (U+3000) — separate the names with half-width spaces`);
        const cells = text.trim().split(/[ \t]+/).filter(Boolean);
        if (!cells.length)
            throw new Error(`${where}: line ${line} is blank — every row needs its cells (use . for an empty cell)`);
        for (const c of cells) {
            if (/^\.+$/.test(c) && c !== '.')
                throw new Error(`${where}: line ${line} has "${c}" — an empty cell is a single . (write ". ." for two empty cells)`);
            if (c !== '.' && !NAME.test(c))
                throw new Error(`${where}: line ${line} has "${c}" — a name is ASCII letters, digits, _ and - (starting with a letter), or . for an empty cell`);
        }
        if (cells.every(c => c === '.'))
            throw new Error(`${where}: line ${line} is all empty cells (.) — a row is as tall as its content, so an empty row is only two gaps: drop it (use rowGap for room)`);
        return { cells, line };
    });
    const cols = grid[0]?.cells.length ?? 0;
    for (const r of grid)
        if (r.cells.length !== cols)
            throw new Error(`${where}: line ${r.line} has ${r.cells.length} cells but the first row has ${cols} — every row needs the same number of cells`);
    if (cols > AREAS_MAX_TRACKS)
        throw new Error(`${where}: ${cols} columns (at most ${AREAS_MAX_TRACKS})`);
    if (grid.length > AREAS_MAX_TRACKS)
        throw new Error(`${where}: ${grid.length} rows (at most ${AREAS_MAX_TRACKS})`);
    const names = [], place = new Map();
    grid.forEach(({ cells }, row) => cells.forEach((name, col) => {
        if (name === '.')
            return;
        const p = place.get(name);
        if (!p) {
            names.push(name);
            place.set(name, { col, row, cs: 1, rs: 1 });
            return;
        }
        // grow the bounding box; whether it is filled is checked below
        const right = Math.max(p.col + p.cs, col + 1), bottom = Math.max(p.row + p.rs, row + 1), left = Math.min(p.col, col);
        place.set(name, { col: left, row: p.row, cs: right - left, rs: bottom - p.row });
    }));
    for (const name of names) {
        const p = place.get(name);
        for (let r = p.row; r < p.row + p.rs; r++)
            for (let c = p.col; c < p.col + p.cs; c++) {
                const at = grid[r]?.cells[c];
                if (at !== name)
                    throw new Error(`${where}: "${name}" is not a rectangle (line ${grid[r]?.line}, cell ${c + 1} is "${at}") — an area covers whole rows and columns, like CSS grid-template-areas: no L shapes, no two separate places`);
            }
    }
    return { cols, rows: grid.length, names, place };
}
/**
 * The x and width of every column of an areas() `cw` wide whose left edge is `x0` (on the 4px grid): every width is a whole number of
 * 4px steps shared out by the ratios, and columns of the same ratio are exactly as wide (an equal split looks equal, never 184 / 180 /
 * 184px: the layout-sibling-size rule would flag it). The steps the ratios leave over widen the gutters when every gutter can take
 * the same number of them; what is left after that (fewer steps than gutters) stays unused at the right.
 */
export function areasColumns(colW, x0, cw, gap) {
    const n = colW.length, total = colW.reduce((a, b) => a + b, 0);
    const units = Math.max(0, Math.floor((cw - gap * (n - 1)) / 4 + 1e-9));
    const share = colW.map(v => units * v / total), steps = share.map(v => Math.floor(v + 1e-9));
    let left = units - steps.reduce((a, b) => a + b, 0);
    // the columns of one ratio take a step together or not at all; the ratios furthest below their share first
    const ratios = [...new Set(colW)].map(v => ({ cols: colW.flatMap((c, i) => c === v ? [i] : []), short: units * v / total - Math.floor(units * v / total + 1e-9) }));
    for (const r of ratios.sort((a, b) => b.short - a.short || a.cols.length - b.cols.length)) {
        if (r.short > 1e-9 && r.cols.length <= left) {
            for (const i of r.cols)
                steps[i] = (steps[i] ?? 0) + 1;
            left -= r.cols.length;
        }
    }
    // the steps still left widen every gutter alike (uneven gutters would be flagged by layout-gutter-uneven), the rest stays at the right
    const gutter = gap + (n > 1 ? Math.floor(left / (n - 1)) * 4 : 0);
    const x = [], w = steps.map(s => s * 4);
    let at = x0;
    w.forEach(v => { x.push(at); at += v + gutter; });
    return { x, w };
}
