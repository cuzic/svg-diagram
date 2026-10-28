import { quadrantBand } from '../quadrant.js';
import { chevronBand, concentricBand, cycleBand, emblemBand, funnelBand, vennBand } from '../flow-shapes.js';
import { wordartBand } from '../wordart.js';
import { LABEL_ROLES } from '../tokens.js';
import { assertNoReveal, assertTextRole, withHandle } from './shared.js';
export function pyramid(layers, opts = {}) {
    assertNoReveal(opts, 'pyramid()');
    if (!Array.isArray(layers) || layers.length < 2)
        throw new Error('pyramid(layers) needs at least 2 layers, bottom to top');
    return {
        type: 'pyramid',
        layers: layers.map(l => typeof l === 'string' ? { text: l } : l),
        width: opts.width,
        layerHeight: opts.layerHeight ?? 76,
        apexRatio: opts.apexRatio ?? 0.3,
    };
}
export function curve(points, opts = {}) {
    assertNoReveal(opts, 'curve()');
    if (!Array.isArray(points) || points.length < 2)
        throw new Error('curve(points) needs at least 2 points');
    for (const p of points) {
        if (typeof p.y !== 'number')
            throw new Error('curve(): every point needs a numeric y (0 = axis bottom, 1 = axis top)');
    }
    return {
        type: 'curve', points,
        height: opts.height ?? 220,
        width: opts.width,
        yTopLabel: opts.yTopLabel, yBottomLabel: opts.yBottomLabel, xLabel: opts.xLabel,
    };
}
export function plane(opts) {
    assertTextRole(opts?.labelRole, LABEL_ROLES, 'plane() labelRole');
    for (const k of ['x', 'y']) {
        const a = opts?.[k];
        if (a && a.step !== undefined && !(a.step > 0 && Number.isFinite(a.step)))
            throw new Error(`plane(): axis ${k} step must be a number > 0 (got ${a.step})`);
        if (!a || typeof a.max !== 'number')
            throw new Error(`plane(): "${k}" needs an axis, e.g. {max: 100}`);
        if (a.max <= (a.min ?? 0))
            throw new Error(`plane(): axis ${k} needs max > min`);
        if (a.categories !== undefined) {
            const c = a.categories;
            if (!Array.isArray(c) || !c.length || c.some(s => typeof s !== 'string' || !s))
                throw new Error(`plane(): axis ${k} categories must be a non-empty list of names, e.g. ['営業', '開発']`);
            if (a.ticks !== undefined || a.step !== undefined)
                throw new Error(`plane(): axis ${k} takes categories or ticks / step, not both (the categories are its ticks)`);
            if ((a.min ?? 0) >= 1 || a.max < c.length)
                throw new Error(`plane(): axis ${k} puts its ${c.length} categories at 1..${c.length}, so it needs min < 1 and max >= ${c.length} (use max: ${c.length + 1})`);
        }
    }
    return withHandle({ type: 'plane', ...opts, height: opts.height ?? 300 }, opts.id);
}
/**
 * A classification matrix (2x2, 3x3 or any N x M) between two axes: cells with a caption, items placed in a cell or at coordinates,
 * optional bubble sizes (area proportional to the value, with a legend), movement arrows. Every item with an id is an anchor for
 * connect() / spotlight; items never overlap each other, a label or a caption (they move within their cell, or the rows grow).
 *   quadrant({preset: 'bcg', sizeTitle: '売上', sizeUnit: '億円', items: [{id: 'a', label: '製品 A', at: [0.8, 0.9], size: 120}, {label: '製品 B', cell: [1, 0]}]})
 *   quadrant({x: {title: '価格', low: '安い', high: '高い'}, y: {title: '品質', low: '低い', high: '高い'}, crosshair: true, items: [...]})
 * Item `at` is in value space ([1, 1] = high on both axes, whichever way the axis is drawn); `cell` is [col, row] from the top-left as drawn.
 */
export const quadrant = Object.assign((opts) => withHandle(quadrantBand(opts), opts?.id), { preset: (name, opts = {}) => withHandle(quadrantBand({ ...opts, preset: name }), opts.id) });
/** A row or column of arrow-shaped process steps. Step ids are anchors for connect() and spotlight. */
export function chevron(steps, opts) { return withHandle(chevronBand(steps, opts), opts?.id); }
/** A narrowing stack of funnel stages. `scale: 'value'` uses each stage value; `showRate` prints conversion from the preceding stage. */
export function funnel(stages, opts) { return withHandle(funnelBand(stages, opts), opts?.id); }
/** Three to eight nodes joined as a closed circular process. Node ids are anchors for connect() and spotlight. */
export function cycle(steps, opts) { return withHandle(cycleBand(steps, opts), opts?.id); }
/** A two- or three-set Venn diagram. Dashed outlines supplement translucent colours, so sets are not distinguished by colour alone. */
export function venn(sets, opts) { return withHandle(vennBand(sets, opts), opts?.id); }
/** Nested rings, ordered from the outside or inside, with labels in the rings or in a side key. */
export function concentric(rings, opts) { return withHandle(concentricBand(rings, opts), opts?.id); }
export function emblem(first, opts = undefined) {
    if (typeof first !== 'string')
        return withHandle(emblemBand(first, opts), opts?.id);
    const { sub, shape, tone, id, ...band } = opts ?? {};
    const built = emblemBand([{ label: first, ...(sub !== undefined ? { sub } : {}), ...(shape ? { shape } : {}), ...(tone ? { tone } : {}), ...(id ? { id } : {}) }], band);
    return withHandle(built, id && built.scope ? `${built.scope}.${id}` : id); // a scoped item is registered as <scope>.<id> (ADR 0012)
}
/**
 * Decorated headline text (ワードアート): bold, outlined (縁取り), shadowed, glowing, bent, turned ..., set horizontally or vertically
 * (縦書き), as one band.
 *   wordart('新製品発表', {style: 'sticker', writing: 'vertical', size: 'display'})
 *   wordart('SALE', {style: 'outline', size: 72})
 * `style` picks a look ('plain' | 'bold' | 'outline' | 'shadow' | 'sticker' | 'glow' | 'emboss' | '3d' | 'gradient' | 'reflect'); `tone`,
 * `gradient`, `outline`, `shadow`, `glow`, `bevel`, `extrude`, `reflection`, `arc`, `rotate`, `flip`, `font`, `plate` adjust it.
 * Colours are tone keys. verifyDiagram() rejects letters that would not read (a white letter with no dark outline on a white page).
 */
export function wordart(text, opts) { return withHandle(wordartBand(text, opts), opts?.id); }
