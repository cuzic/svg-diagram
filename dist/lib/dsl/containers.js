import { resolveLoopBacks } from '../loop-back.js';
import { parseAreaTemplate } from '../areas.js';
import { assertNoReveal, assertOneOf, cloneBand, handleFor, withHandle } from './shared.js';
import { box, group } from './text-bands.js';
export function spacer(h, opts) {
    assertNoReveal(opts, 'spacer()');
    return { type: 'spacer', h };
}
// 'row#5' (the 5th column / child of the row with this id) and 'row#5-6' (columns 5..6): the ids layout.ts registers for a row({id}).
function columnId(id, n, to) {
    if (!Number.isInteger(n) || n < 1 || (to !== undefined && (!Number.isInteger(to) || to < n)))
        throw new Error(`row "${id}": col(${n}${to === undefined ? '' : `, ${to}`}) needs whole numbers, 1-based and in order`);
    return to === undefined || to === n ? `${id}#${n}` : `${id}#${n}-${to}`;
}
function assertRowChildren(children) {
    children.forEach((c, i) => {
        if (c?.type !== 'box' && c?.type !== 'group')
            throw new Error(`row(): child ${i} is ${c?.type === undefined ? 'not a band' : `a ${c.type}()`}, but row() takes box() and group() children only`);
    });
}
// row()/grid() lay out boxes only. A group (or anything else) would silently render as an empty
// little box in plain JS (.mjs), where the types do not stop it, so fail loudly instead.
function assertBoxChildren(what, children) {
    children.forEach((c, i) => {
        if (c?.type !== 'box')
            throw new Error(`${what}(): child ${i} is ${c?.type === undefined ? 'not a band' : `a ${c.type}()`}, but ${what}() takes box() children only. Stack groups vertically with d.add(group(...), group(...)) instead of placing them in a ${what}`);
    });
}
// caption / banner / table ... (a stat() is a box) in a row() or an areas() cell: each goes into a frameless group (the same as writing
// group([x], {frame: false}) by hand). Boxes and groups are placed as they are; the bands that place others (row, grid, areas) and
// the ones that are not content (connect, spacer) are not wrapped (row() and areas() refuse them).
const UNWRAPPED = ['box', 'group', 'connect', 'spacer', 'row', 'grouprow', 'grid', 'areas'];
function wrappable(c) { return c?.type !== undefined && !UNWRAPPED.includes(c.type); }
// the row placement (flex / width / span / col) moves to the wrapper, where the row reads it
function wrap(c) {
    const { flex, width, span, col } = c;
    const place = Object.fromEntries(Object.entries({ flex, width, span, col }).filter(([, v]) => v !== undefined));
    return group(c, { frame: false, ...place });
}
export function row(rawChildren, opts = {}) {
    assertOneOf(opts.arrows, ['between', 'none'], 'row() arrows');
    assertOneOf(opts.justify, ['stretch', 'center', 'start'], 'row() justify');
    assertNoReveal(opts, 'row()'); // a row is shown with its children: give each child its own reveal
    const nested = rawChildren.findIndex(c => c?.type === 'areas');
    if (nested >= 0)
        throw new Error(`row(): child ${nested} is an areas() — a row's child takes one width in one row; put the areas() in a group: row([group([areas(...)]), ...])`);
    const children = rawChildren.map(c => wrappable(c) ? wrap(c) : c);
    const hasGroup = children.some(c => c?.type === 'group');
    if (hasGroup) {
        if (opts.arrows === 'between')
            throw new Error("row(): arrows: 'between' cannot be used when a child is a group()");
        assertRowChildren(children);
    }
    else
        assertBoxChildren('row', children);
    const { cols, kids } = spanRow(children, opts.cols);
    if (opts.loopBack !== undefined && hasGroup)
        throw new Error('row(): loopBack needs a row of boxes (a group in the row has no step anchor to loop to)');
    const loopBack = opts.loopBack === undefined ? undefined : resolveLoopBacks('row()', opts.loopBack, kids.length);
    const band = hasGroup
        ? { type: 'grouprow', id: opts.id, cols, children: kids, gap: opts.gap ?? 16, justify: opts.justify ?? 'stretch', itemWidth: opts.width }
        : { type: 'row', id: opts.id, cols, children: kids, gap: opts.gap ?? 16, arrows: opts.arrows ?? 'none', justify: opts.justify ?? 'stretch', itemWidth: opts.width, ...(loopBack ? { loopBack } : {}) };
    if (!opts.id)
        return band;
    const id = opts.id;
    return Object.defineProperty(withHandle(band, id), 'col', { value: (n, to) => {
            const slot = columnId(id, n, to);
            return Object.defineProperties({ id: slot }, handleFor(slot));
        } });
}
// row({cols: [6, 6]}): one span per child, so the column count is their sum and no child carries `span` / `col`.
// The children are copied with their span filled in (a child that also sets `span` / `col` is a contradiction, so it throws).
function spanRow(children, cols) {
    if (cols === undefined) {
        // span / col only mean something on a grid: without cols the row shares its width by flex, and they would be dropped silently
        const i = children.findIndex(c => c.span !== undefined || c.col !== undefined);
        if (i >= 0) {
            const c = children[i];
            const what = [c.span !== undefined ? `span: ${c.span}` : '', c.col !== undefined ? `col: ${c.col}` : ''].filter(Boolean).join(', ');
            throw new Error(`row(): child ${i} has ${what}, but the row has no cols — give the row a grid (row([...], {cols: 12})) or size the child with flex / width`);
        }
    }
    if (!Array.isArray(cols)) {
        // row(children, {cols: 12}) with no child placed (no `span` / `col`): the children share the grid equally (12 / n columns each,
        // the remainder going to the first ones) instead of each being one column wide. A child with an explicit `span` / `col` opts out.
        const n = children.length;
        if (cols === undefined || n < 1 || n >= cols || children.some(c => c.span !== undefined || c.col !== undefined))
            return { cols, kids: children };
        const base = Math.floor(cols / n), extra = cols % n;
        return { cols, kids: children.map((c, i) => Object.assign(Object.create(Object.getPrototypeOf(c), Object.getOwnPropertyDescriptors(c)), { span: base + (i < extra ? 1 : 0) })) };
    }
    if (cols.length !== children.length)
        throw new Error(`row({cols: [${cols.join(', ')}]}) declares ${cols.length} spans for ${children.length} children`);
    if (cols.some(n => !Number.isInteger(n) || n < 1))
        throw new Error(`row({cols: [${cols.join(', ')}]}): every span must be a whole number >= 1`);
    const kids = children.map((c, i) => {
        if (c.span !== undefined || c.col !== undefined)
            throw new Error(`row({cols: [...]}): child ${i} has its own span / col, but the row already gives it span ${cols[i]}`);
        return Object.assign(Object.create(Object.getPrototypeOf(c), Object.getOwnPropertyDescriptors(c)), { span: cols[i] });
    });
    return { cols: cols.reduce((a, b) => a + b, 0), kids };
}
export function node(opts) {
    const { label, sub, size, frame, ...rest } = opts;
    if (size !== undefined && !(size >= 16 && size <= 96))
        throw new Error(`node(): size must be between 16 and 96 px (got ${size})`);
    return box({ ...rest, title: label, ...(sub !== undefined ? { body: sub } : {}), iconAt: 'top', ...(size !== undefined ? { iconSize: size } : {}), ...(frame ? {} : { frame: false }), align: 'center' });
}
/** A row of icon + label boxes (each a plain box({icon, title})). The label is required: an icon alone does not say what it means. */
export function iconRow(items, opts = {}) {
    if (items.length === 0)
        throw new Error('iconRow(): needs at least one item');
    return row(items.map(it => box({ icon: it.icon, title: it.label, body: it.body, tone: it.tone, iconTone: it.iconTone })), opts);
}
export function grid(children, opts) {
    if (!opts?.cols)
        throw new Error('grid(children, {cols}) needs cols');
    assertNoReveal(opts, 'grid()');
    assertBoxChildren('grid', children);
    return { type: 'grid', children, cols: opts.cols, gap: opts.gap ?? 16 };
}
const AREAS_OPTS = ['cols', 'gap', 'rowGap', 'id', 'reveal', 'until'];
const NOT_IN_AREA = {
    row: 'put the row in a group', grouprow: 'put the row in a group', grid: 'put the grid in a group', areas: 'put the inner areas() in a group',
    connect: 'write connect() after the areas(), not in a cell', spacer: 'leave the cell empty with . instead',
};
const ceil4 = (v) => Math.ceil(v / 4 - 1e-9) * 4;
const gapOpt = (v, what) => {
    if (v === undefined)
        return undefined;
    if (typeof v !== 'number' || !Number.isFinite(v) || v < 0)
        throw new Error(`areas({${what}}) must be a number >= 0 (got ${JSON.stringify(v)})`);
    return ceil4(v);
};
export function areas(template, cells, opts = {}) {
    if (!opts || typeof opts !== 'object' || Array.isArray(opts))
        throw new Error('areas(template, cells, opts): opts is an object');
    for (const k of Object.keys(opts))
        if (!AREAS_OPTS.includes(k))
            throw new Error(`areas(): unknown option "${k}" (options: cols, gap, rowGap, id)`);
    assertNoReveal(opts, 'areas()'); // shown with its cells: give each cell's content its own reveal
    const t = parseAreaTemplate(template);
    if (!cells || typeof cells !== 'object' || Array.isArray(cells))
        throw new Error('areas(template, cells): cells is an object of area name -> box / group / band');
    const keys = Object.keys(cells).filter(k => cells[k] !== undefined);
    const missing = t.names.filter(n => !keys.includes(n)), extra = keys.filter(k => !t.names.includes(k));
    if (missing.length || extra.length)
        throw new Error(`areas(): the template and the cells do not name the same areas${missing.length ? ` — no cell for ${missing.map(n => `"${n}"`).join(', ')}` : ''}${extra.length ? ` — ${extra.map(n => `"${n}"`).join(', ')} not in the template` : ''} (template: ${t.names.join(', ')})`);
    if (opts.cols !== undefined) {
        if (!Array.isArray(opts.cols) || opts.cols.length !== t.cols)
            throw new Error(`areas({cols}): one width ratio per column — the template has ${t.cols} columns (got ${JSON.stringify(opts.cols)})`);
        if (opts.cols.some(v => typeof v !== 'number' || !Number.isFinite(v) || v <= 0))
            throw new Error(`areas({cols}): every ratio is a number > 0 (got ${JSON.stringify(opts.cols)})`);
    }
    if (opts.id !== undefined && (typeof opts.id !== 'string' || !opts.id))
        throw new Error(`areas({id}) is a non-empty string (got ${JSON.stringify(opts.id)})`);
    const gap = gapOpt(opts.gap, 'gap') ?? 16, rowGap = gapOpt(opts.rowGap, 'rowGap') ?? gap;
    const children = t.names.map((name) => {
        const c = cells[name];
        if (!c || typeof c !== 'object' || typeof c.type !== 'string')
            throw new Error(`areas(): area "${name}" is not a band (got ${JSON.stringify(c)})`);
        const why = NOT_IN_AREA[c.type];
        if (why)
            throw new Error(`areas(): area "${name}" is a ${c.type}() — an area holds a box, a group or one band such as a caption or a table: ${why}`);
        for (const k of ['span', 'col', 'flex', 'width'])
            if (c[k] !== undefined)
                throw new Error(`areas(): area "${name}" has ${k}: ${c[k]} — the template places and sizes an area (its columns and the cols ratios): drop ${k}`);
        if (c.id !== undefined && c.id !== name)
            throw new Error(`areas(): area "${name}" holds a ${c.type}() with id "${c.id}" — the area's name is its id: drop the id (or name the area "${c.id}")`);
        if (wrappable(c)) {
            // a band with the name as its own id keeps it (it is the anchor); otherwise the frameless wrapper takes the name
            const g = wrap(c);
            return c.id === name ? g : withHandle(Object.assign(g, { id: name }), name);
        }
        const copy = Object.assign(cloneBand(c), { id: name }); // a copy, so the handles of box({id}) (.right ...) are kept
        return Object.getOwnPropertyDescriptor(copy, 'right') ? copy : withHandle(copy, name);
    });
    const band = {
        type: 'areas', ...(opts.id ? { id: opts.id } : {}), children, names: [...t.names], place: t.names.map(n => t.place.get(n)),
        colW: opts.cols ? [...opts.cols] : new Array(t.cols).fill(1), rowW: new Array(t.rows).fill(1), gap, rowGap,
    };
    return withHandle(band, opts.id);
}
