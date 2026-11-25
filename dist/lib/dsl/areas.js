import { parseAreaTemplate } from '../areas.js';
import { assertNoReveal, cloneBand, withHandle } from './shared.js';
import { wrappable, wrap } from './container-children.js';
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
