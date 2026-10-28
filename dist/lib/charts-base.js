// The shared ground of the consulting-style charts (waterfall, radar, heatmap, stacked bars / mekko, treemap, sankey, tornado):
// a small canvas that collects what a chart draws (rects, paths, texts), remembers where every label is, and finds a free spot for
// a label — so that each chart only says WHAT goes WHERE and verify.ts can check the result the same way for all of them.
import { must } from './must.js';
import { segHitsRect } from './bars.js';
import { splitAtoms, textWidth } from './atoms.js';
import { wrapAtoms } from './wrap.js';
import { niceNear } from './qc.js';
export const overlaps = (a, b) => Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 && Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
/** A number as it reads: exact (no float noise), thousands separated. */
export function numText(n) {
    if (!Number.isFinite(n))
        return String(n);
    let s = String(parseFloat(n.toPrecision(12)));
    if (/e/i.test(s))
        s = n.toFixed(6).replace(/\.?0+$/, '');
    const neg = s.startsWith('-'), [int = '', dec] = s.replace('-', '').split('.');
    return `${neg ? '-' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}${dec ? `.${dec}` : ''}`;
}
/** A signed delta: +120 / -45 (0 is +0). */
export const signedText = (n) => `${n < 0 ? '' : '+'}${numText(n)}`;
export const decimalsIn = (n) => { const s = String(parseFloat(n.toPrecision(12))); const i = s.indexOf('.'); return /e/i.test(s) ? 6 : i < 0 ? 0 : s.length - i - 1; };
/** A value axis: the range widened to round ticks. */
export function niceScale(lo, hi, want = 5) {
    if (!(hi > lo)) {
        hi = lo + 1;
    }
    const step = niceNear((hi - lo) / want);
    const min = Math.floor(lo / step + 1e-9) * step, max = Math.max(Math.ceil(hi / step - 1e-9) * step, min + step);
    const ticks = [];
    for (let i = 0; i <= Math.round((max - min) / step) && i < 100; i++)
        ticks.push(parseFloat((min + i * step).toPrecision(12)));
    return { min: parseFloat(min.toPrecision(12)), max: parseFloat(max.toPrecision(12)), step, ticks };
}
/** `domain: [lo, hi]` of a chart (its value axis's end points), checked: two finite numbers, lo < hi. */
export function checkDomain(who, domain) {
    if (domain === undefined)
        return undefined;
    if (!Array.isArray(domain) || domain.length !== 2 || !domain.every(Number.isFinite) || !(domain[0] < domain[1]))
        fail(who, `domain must be [lo, hi] with finite numbers and lo < hi (got ${JSON.stringify(domain)})`);
    return [domain[0], domain[1]];
}
/** `plotInset: [left, right]` of a horizontal chart: how far the plot area starts from the chart's left edge and ends from its right edge (px). */
export function checkInset(who, inset) {
    if (inset === undefined)
        return undefined;
    if (!Array.isArray(inset) || inset.length !== 2 || !inset.every(v => Number.isFinite(v) && v >= 0))
        fail(who, `plotInset must be [left, right], two numbers >= 0 (got ${JSON.stringify(inset)})`);
    return [inset[0], inset[1]];
}
/** The plot's left and right margins: what the labels need, or the written `plotInset` when it leaves room for them (so that charts written with the same inset have the same plot area). */
export function insetOrNeed(who, inset, needLeft, needRight) {
    if (inset === undefined)
        return [needLeft, needRight];
    if (inset[0] < needLeft - 0.5 || inset[1] < needRight - 0.5)
        fail(who, `plotInset [${Math.round(inset[0])}, ${Math.round(inset[1])}] leaves too little room for the labels: this chart needs at least [${Math.ceil(needLeft)}, ${Math.ceil(needRight)}] (write the largest of the charts you want to line up)`);
    return [inset[0], inset[1]];
}
/** The value axis of a chart: from the data, or from its written `domain` (widened to round ticks like any axis). A domain smaller than the data is an error: the bars would leave the plot. */
export function valueScale(who, lo, hi, domain) {
    if (domain === undefined)
        return niceScale(lo, hi);
    if (lo < domain[0] - 1e-9 || hi > domain[1] + 1e-9)
        fail(who, `domain [${numText(domain[0])}, ${numText(domain[1])}] is smaller than the data [${numText(lo)}, ${numText(hi)}] (widen the domain)`);
    return niceScale(domain[0], domain[1]);
}
/** Ticks thin enough for their labels: every k-th tick (counting from the one at zero, or the first) so that neighbours are `gap` apart. */
export function thinTicks(ticks, px, size, gap = 10) {
    if (ticks.length < 2)
        return new Set(ticks);
    const pitch = Math.abs(px(must(ticks[1]).v) - px(must(ticks[0]).v)), need = Math.max(...ticks.map(size)) + gap;
    const k = Math.max(1, Math.ceil(need / Math.max(1, pitch))), zero = Math.max(0, ticks.findIndex(t => t.v === 0));
    return new Set(ticks.filter((_t, i) => ((i - zero) % k + k) % k === 0));
}
export class Canvas {
    items = [];
    boxes = [];
    solids = [];
    segs = [];
    anchors = [];
    omitted = [];
    /** The arrows drawn between two different nodes (semnet-common's arrow()), for LaidOutChartPart.edges. */
    edges = [];
    /** Small marks (a line chart's markers) a label placed by place() keeps off; verify does not check them (two may share a spot). */
    marks = [];
    x;
    y;
    w;
    h;
    size;
    widthOf;
    mode;
    /** `mode`: the diagram's wrap mode, for wrap(). */
    constructor(x, y, w, h, size, widthOf, mode) { this.x = x; this.y = y; this.w = w; this.h = h; this.size = size; this.widthOf = widthOf; this.mode = mode; }
    tw(s, bold = false) { return textWidth(this.widthOf, s, this.size, bold ? 700 : 400); }
    /** The box a label of this text occupies (the same box verify and the lint see). */
    boxOf(s, x, base, anchor, bold = false) {
        const w = this.tw(s, bold);
        return { x: anchor === 'middle' ? x - w / 2 : anchor === 'end' ? x - w : x, y: base - this.size, w, h: this.size + 4 };
    }
    /** The baseline that centres a line of text on `cy`. */
    mid(cy) { return Math.round(cy + this.size * 0.36); }
    rect(x, y, w, h, o) {
        this.items.push({ k: 'rect', x, y, w, h, fill: o.fill, ...(o.op === undefined ? {} : { op: o.op }), ...(o.stroke ? { stroke: o.stroke } : {}), ...(o.sw ? { sw: o.sw } : {}), ...(o.dash ? { dash: o.dash } : {}), ...(o.of ? { of: o.of } : {}) });
        if (o.id)
            this.anchors.push({ id: o.id, x, y, w, h });
        if (o.solid !== undefined) {
            this.solids.push({ x, y, w, h, label: o.solid, ...(o.id ? { id: o.id } : {}) });
            return this.solids.length - 1;
        }
        return -1;
    }
    path(d, o) {
        this.items.push({ k: 'path', d, fill: o.fill, ...(o.op === undefined ? {} : { op: o.op }), ...(o.stroke ? { stroke: o.stroke } : {}), ...(o.sw ? { sw: o.sw } : {}), ...(o.dash ? { dash: o.dash } : {}), ...(o.of ? { of: o.of } : {}), ...(o.soft ? { soft: true } : {}) });
    }
    line(x1, y1, x2, y2, o) {
        const r = (n) => Math.round(n * 10) / 10;
        this.path(`M${r(x1)},${r(y1)} L${r(x2)},${r(y2)}`, { fill: 'none', stroke: o.stroke, sw: o.sw ?? 2, dash: o.dash, of: o.of, soft: o.soft });
        if (o.avoid)
            this.segs.push({ x1, y1, x2, y2 });
    }
    /** An installed icon beside a label (decoration: the label says what it is). */
    icon(glyph, name, x, y, size, fill, of) {
        this.items.push({ k: 'icon', name, glyph, x, y, size, fill, ...(of ? { of } : {}) });
    }
    /** Draws a label and registers its box. Coordinates are whole pixels, so the box is exactly what is drawn. */
    text(s, x, base, anchor, fill, o = {}) {
        x = Math.round(x);
        base = Math.round(base);
        if (o.plate) {
            const p = this.boxOf(s, x, base, anchor, o.bold);
            this.items.push({ k: 'rect', x: p.x - 2, y: p.y, w: p.w + 4, h: p.h, fill: 'bg' });
        }
        this.items.push({ k: 'text', s, x, y: base, anchor, fill, size: this.size, ...(o.bold ? { bold: true } : {}), ...(o.of ? { of: o.of } : {}) });
        const b = { label: s, ...this.boxOf(s, x, base, anchor, o.bold), ...(o.on ? { on: o.on } : {}), ...(o.plate ? { plate: true } : {}), ...(o.host !== undefined && o.host >= 0 ? { host: o.host } : {}), ...(o.of ? { of: o.of } : {}) };
        this.boxes.push(b);
        return b;
    }
    /** Is there room for this box: inside the figure, off every other label, off every solid but its host, clear of the lines to avoid? */
    free(b, host = -1, margin = 0, plated = false) {
        if (b.x < this.x - 0.5 + margin || b.x + b.w > this.x + this.w + 0.5 - margin || b.y < this.y - 0.5 + margin || b.y + b.h > this.y + this.h + 0.5 - margin)
            return false;
        if (this.boxes.some(o => overlaps(b, o)))
            return false;
        if (this.solids.some((s, i) => i !== host && overlaps(b, s)))
            return false;
        if (this.marks.some(m => overlaps(b, m)))
            return false;
        return plated || !this.segs.some(sg => segHitsRect(sg, { x: b.x - 1, y: b.y, w: b.w + 2, h: b.h }));
    }
    /** Draws the label at the first candidate that is free; undefined (nothing drawn) when none is. */
    place(s, cands, fill, o = {}) {
        for (const c of cands)
            if (this.free(this.boxOf(s, Math.round(c.x), Math.round(c.y), c.anchor, o.bold), o.host ?? -1, 0, !!o.plate))
                return this.text(s, c.x, c.y, c.anchor, fill, o);
        return undefined;
    }
    /** Wraps text into lines no wider than `maxW` (an atom wider than that stays on a line of its own). */
    wrap(s, maxW, bold = false) {
        return wrapAtoms(splitAtoms(s), { maxWidth: Math.max(20, maxW), atomWidth: a => textWidth(this.widthOf, a, this.size, bold ? 700 : 400), mode: this.mode });
    }
    /** Several lines of one label, centred on x, the first line's baseline at `base`. */
    lines(ls, x, base, anchor, fill, o = {}) {
        ls.forEach((l, i) => this.text(l, x, base + i * Math.round(this.size * 1.25), anchor, fill, o));
    }
    lineH() { return Math.round(this.size * 1.25); }
    done() {
        return { items: this.items, boxes: this.boxes, solids: this.solids, segs: this.segs, anchors: this.anchors, ...(this.edges.length ? { edges: this.edges } : {}), omitted: this.omitted, h: this.h };
    }
}
/** The label size of a chart: its role's size. */
export const sizeOf = (labelRole, roles) => roles[labelRole ?? 'note'];
/** An error with the chart's name in front. */
export const fail = (who, msg) => { throw new Error(`${who}(): ${msg}`); };
export function finiteNum(who, what, v, o = {}) {
    if (typeof v !== 'number' || !Number.isFinite(v) || Math.abs(v) >= 1e15)
        fail(who, `${what} must be a finite number (got ${String(v)})`);
    if (o.min !== undefined && v < o.min)
        fail(who, `${what} must be >= ${o.min} (got ${v})`);
    return v;
}
export function checkText(who, what, v) {
    if (typeof v !== 'string' || !v.trim())
        fail(who, `${what} must be a non-empty string`);
    return v;
}
export function checkIds(who, ids, bandId) {
    const given = ids.filter((i) => !!i);
    if (new Set(given).size !== given.length)
        fail(who, 'each id must be unique');
    if (bandId !== undefined && given.includes(bandId))
        fail(who, `the band's id "${bandId}" is also an element's id — each id must be unique`);
}
/** Opacity of the accent for the n-th of `count` shades, light to dark (the ladder pyramid() uses, spread over `count` steps). */
export function shadeOps(count) {
    const ladder = { 1: [0.5], 2: [0.25, 0.7], 3: [0.15, 0.5, 0.85], 4: [0.12, 0.35, 0.6, 0.85], 5: [0.1, 0.3, 0.5, 0.7, 0.9], 6: [0.1, 0.25, 0.4, 0.55, 0.7, 0.9] };
    return ladder[count] ?? must(ladder[6]);
}
/** The text colour that reads on the accent at this opacity. */
export const inkOnShade = (op) => op >= 0.6 ? 'bg' : 'text';
