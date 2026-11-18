import { resolveLoopBacks } from '../loop-back.js';
import { assertNoReveal, assertOneOf, handleFor, withHandle } from './shared.js';
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
export function row(rawChildren, opts = {}) {
    assertOneOf(opts.arrows, ['between', 'none'], 'row() arrows');
    assertOneOf(opts.justify, ['stretch', 'center', 'start'], 'row() justify');
    assertNoReveal(opts, 'row()'); // a row is shown with its children: give each child its own reveal
    // caption / stat / banner / table ... in a row: each goes into a frameless group (the same as writing group([x], {frame: false}) by hand)
    const wrappable = (c) => c?.type !== undefined && !['box', 'group', 'connect', 'spacer', 'row', 'grouprow', 'grid'].includes(c.type);
    // the row placement (flex / width / span / col) moves to the wrapper, where the row reads it
    const wrap = (c) => {
        const { flex, width, span, col } = c;
        const place = Object.fromEntries(Object.entries({ flex, width, span, col }).filter(([, v]) => v !== undefined));
        return group(c, { frame: false, ...place });
    };
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
