// wireframe() / screens() — low-fidelity UI wireframes for screen specs.
//
// A screen is a tree of nodes built with the `wf` constructors below. Layout is a small flex
// engine (col / row / card + leaf widgets); the result is a flat list of drawing primitives
// (rect / text / path / circle) in absolute coordinates, with colours as TOKEN KEYS
// ('bg' | 'text' | 'muted' | 'border' | 'code' | 'danger' | 'accent' | 'soft'), resolved against
// the diagram theme by emit.ts. Like every other part, nothing here accepts a raw colour or
// a font size below the 14px floor.
//
//   wireframe(root, {id, title, tag, h, notes, noteW, skeleton})   one screen + numbered notes
//   screens(items, {cols, gap, rowGap, h, skeleton})               several thumbnails in a grid; item.at = [row, col]
//                                                                  (col may be fractional) places a tree explicitly.
//                                                                  Item ids become connect() anchors.
//
// Any node accepts: n (callout number), mark ('new' | 'changed'), flex, w (row child px), h (px).
// Nodes in a col are full width; widgets in a row take their natural width (btn, chip) or share
// the rest by flex. map / video / heat / pointcloud / chart / image grow to fill leftover height.
import { splitAtoms } from './measure.js';
import { wrapAtoms } from './wrap.js';
import { installParts } from './wireframe-parts.js';
const S = 14, T = 15, LHF = 1.4, GAP = 12;
const lh = (s) => s * LHF;
const VISUAL = new Set(['map', 'video', 'heat', 'pointcloud', 'chart', 'image', 'compare', 'fusion', 'region']);
const CONTAINER = new Set(['col', 'row', 'card']);
// ---- constructors -------------------------------------------------------------------------
const mk = (t, o = {}) => ({ t, ...o });
const kids = (c) => [c].flat(Infinity).filter(Boolean); // nested arrays / falsy dropped
// The parts below `toast` (fusion, compare, region, robot ...) are added by installParts() at the bottom of this file.
export const wf = {
    col: (c, o) => mk('col', { ...o, children: kids(c) }),
    row: (c, o) => mk('row', { ...o, children: kids(c) }),
    card: (c, o) => mk('card', { ...o, children: kids(c) }),
    spacer: (h = 8, o) => mk('spacer', { h, ...o }),
    text: (text, o) => mk('text', { ...o, text }),
    btn: (label, o) => mk('btn', { ...o, label }),
    input: (label, o) => mk('input', { ...o, label }),
    select: (label, o) => mk('select', { ...o, label }),
    chip: (label, o) => mk('chip', { ...o, label }),
    tabs: (labels, o) => mk('tabs', { ...o, labels }),
    appbar: (title, o) => mk('appbar', { ...o, title }),
    seek: (o) => mk('seek', o),
    kv: (pairs, o) => mk('kv', { ...o, pairs }),
    stat: (value, label, o) => mk('stat', { ...o, value: String(value), label }),
    list: (items, o) => mk('list', { ...o, items }),
    table: (columns, rows, o) => mk('table', { ...o, columns, rows }),
    alert: (text, o) => mk('alert', { ...o, text }),
    map: (o) => mk('map', o),
    video: (o) => mk('video', o),
    heat: (o) => mk('heat', o),
    pointcloud: (o) => mk('pointcloud', o),
    chart: (o) => mk('chart', o),
    image: (label, o) => mk('image', { ...o, label }),
    // Overlays — pass them to wireframe(root, {overlays: [...]}) / a screens() item's `overlays`.
    dialog: (title, o) => mk('dialog', { ...o, title }), // {body, buttons: [wf.btn...], w, n}: modal over a dimmed screen
    toast: (text, o) => mk('toast', { ...o, text }), // {tone: 'danger'}: a notice at the bottom right
}; // loosely typed constructors; the public shape is the Wf interface
// ---- text requests (everything the layout may measure) ---------------------------------------
const DEFAULT_STRINGS = ['LIVE', '!', '新規', '改修', '対象外', '未設計'];
export function collectTextRequests(band) {
    const strings = new Set(DEFAULT_STRINGS);
    const walk = (v) => {
        if (typeof v === 'string')
            strings.add(v);
        else if (typeof v === 'number')
            strings.add(String(v));
        else if (Array.isArray(v))
            v.forEach(walk);
        else if (v && typeof v === 'object') {
            if (v.t)
                PARTS.strings(v).forEach(x => strings.add(x));
            Object.values(v).forEach(walk);
        }
    };
    PARTS.always.forEach(x => strings.add(x));
    walk(band.type === 'screens' ? [band.items, band.matrix] : [band.root, band.overlays, band.title, band.tag, band.notes, band.marks]);
    if (band.marks)
        walk(band.marks);
    const out = [];
    for (const s of strings)
        out.push([s, S, 400, 'sans'], [s, S, 700, 'sans'], [s, T, 700, 'sans']);
    return out;
}
// ---- drawing context ---------------------------------------------------------------------
function mkCtx(widthOf, skeleton) {
    return { widthOf, skeleton: !!skeleton, prims: [], callouts: [], all: [], used: new Set() };
}
const tw = (ctx, s, size, weight) => [...splitAtoms(String(s))].reduce((a, atom) => a + ctx.widthOf(atom, size, weight, 'sans'), 0);
// Katakana runs stay in one piece (ドラッグ must not break as ドラッ/グ); widths are summed per character.
const naOf = (c) => c && typeof c === 'object' && 'na' in c ? c.na : undefined;
const KATA = /^[\u30A0-\u30FF]+$/;
function atomsOf(s) {
    const out = [];
    for (const a of splitAtoms(String(s))) {
        if (out.length && KATA.test(a) && KATA.test(out[out.length - 1]))
            out[out.length - 1] += a;
        else
            out.push(a);
    }
    return out;
}
const wrapT = (ctx, s, size, weight, maxW) => wrapAtoms(atomsOf(s), { maxWidth: Math.max(24, maxW), atomWidth: (a) => [...splitAtoms(a)].reduce((t, c) => t + ctx.widthOf(c, size, weight, 'sans'), 0) });
const rect = (ctx, x, y, w, h, o = {}) => { ctx.prims.push({ k: 'rect', x, y, w, h, r: o.r ?? 0, fill: o.fill ?? null, stroke: o.stroke ?? null, sw: o.sw ?? 2, dash: o.dash, op: o.op }); };
const circle = (ctx, cx, cy, r, o = {}) => { ctx.prims.push({ k: 'circle', cx, cy, r, fill: o.fill ?? null, stroke: o.stroke ?? null, sw: o.sw ?? 2, op: o.op }); };
const text = (ctx, s, x, base, o = {}) => { ctx.prims.push({ k: 'text', s: String(s), x, y: base, size: o.size ?? S, weight: o.weight ?? 400, fill: o.fill ?? 'text', anchor: o.anchor }); };
const pts = (ps) => ps.map(([x, y], i) => `${i ? 'L' : 'M'}${Math.round(x)},${Math.round(y)}`).join(' ');
const path = (ctx, d, o = {}) => { ctx.prims.push({ k: 'path', d, fill: o.fill ?? null, stroke: o.stroke ?? null, sw: o.sw ?? 2, dash: o.dash, op: o.op, cap: o.cap }); };
const line = (ctx, x1, y1, x2, y2, o = {}) => path(ctx, pts([[x1, y1], [x2, y2]]), { stroke: o.stroke ?? 'border', ...o });
const mid = (cy, size = S) => cy + size * 0.36; // baseline that centres text on cy
const TONE_ALIAS = { ok: 'accent', warn: 'danger', off: 'muted' };
const toneOf = (t) => (t != null ? TONE_ALIAS[t] : undefined) ?? t ?? 'plain';
const CHIP = {
    plain: { fill: 'bg', stroke: 'muted', text: 'text' },
    accent: { fill: 'soft', stroke: 'accent', text: 'accent' },
    danger: { fill: 'bg', stroke: 'danger', text: 'danger' },
    muted: { fill: 'code', stroke: 'border', text: 'muted' },
    solid: { fill: 'accent', stroke: null, text: 'bg' },
    'solid-danger': { fill: 'danger', stroke: null, text: 'bg' },
};
const TEXT_TONE = { accent: 'accent', danger: 'danger', muted: 'muted' };
const toneFill = (t) => (t != null ? TEXT_TONE[t] : undefined) ?? 'text';
const chipW = (ctx, label) => tw(ctx, label, S, 700) + 20;
function drawChip(ctx, label, x, y, tone) {
    const st = CHIP[toneOf(tone)] ?? CHIP.plain;
    const w = chipW(ctx, label);
    rect(ctx, x, y, w, 24, { r: 12, fill: st.fill, stroke: st.stroke });
    text(ctx, label, x + w / 2, mid(y + 12), { weight: 700, fill: st.text, anchor: 'middle' });
    return w;
}
const chipSpec = (c) => typeof c === 'string' ? { text: c } : c;
function bars(ctx, widths, x, y, size = S) {
    widths.forEach((bw, k) => rect(ctx, x, y + k * lh(size) + 6, Math.max(12, bw), 8, { r: 4, fill: 'border' }));
}
// ---- layout helpers ------------------------------------------------------------------------
const autoW = (n, ctx) => n.t === 'btn' ? tw(ctx, n.label, S, 700) + 28 : n.t === 'chip' ? chipW(ctx, n.label) : AUTO_W[n.t]?.(n, ctx); // per-t table: the call spot cannot correlate n with its t
const flexOf = (n) => n.flex ?? (VISUAL.has(n.t) && n.h == null ? 1 : 0);
const label = (n) => {
    const o = n; // whichever naming field this node has
    return o.title ?? o.label ?? o.text ?? (o.children ? `${n.t} of ${o.children.map(c => c.t).join(' / ')}` : n.t);
};
function rowWidths(n, w, ctx) {
    const gap = n.gap ?? GAP;
    const kidsN = n.children;
    const avail = w - gap * Math.max(0, kidsN.length - 1);
    const fixed = kidsN.map(c => c.w ?? (c.flex == null ? autoW(c, ctx) : undefined));
    const used = fixed.reduce((s, v) => s + (v ?? 0), 0);
    const flexSum = kidsN.reduce((s, c, i) => s + (fixed[i] == null ? (c.flex ?? 1) : 0), 0);
    return kidsN.map((c, i) => fixed[i] ?? (flexSum ? Math.max(40, (avail - used) * (c.flex ?? 1) / flexSum) : 0));
}
const colNat = (children, w, gap, ctx) => children.reduce((s, c) => s + nat(c, w, ctx), 0) + gap * Math.max(0, children.length - 1);
// ---- natural heights ---------------------------------------------------------------------
function textLines(n, w, ctx) {
    const size = n.size === 'title' ? T : S;
    return wrapT(ctx, n.text, size, n.bold || n.size === 'title' ? 700 : 400, w);
}
function listRows(n, w, ctx) {
    return n.items.map(it => {
        const o = typeof it === 'string' ? { text: it } : it;
        const bw = o.badge ? chipW(ctx, o.badge) + 8 : 0;
        const lines = wrapT(ctx, o.text, S, o.active ? 700 : 400, w - 20 - bw);
        return { o, lines, bw, h: Math.max(32, lines.length * lh(S) + 12) };
    });
}
function kvRows(n, w, ctx) {
    const pairs = n.pairs.map(p => Array.isArray(p) ? { k: p[0], v: p[1] } : p);
    const keyW = n.keyW ?? Math.min(w * 0.5, Math.max(...pairs.map(p => tw(ctx, p.k, S, 400))) + 12);
    return { keyW, rows: pairs.map(p => {
            const lines = wrapT(ctx, p.v, S, 400, w - keyW);
            return { ...p, lines, h: Math.max(24, lines.length * lh(S) + 4) };
        }) };
}
function tableData(n, w, ctx) {
    const cols = n.columns.map(c => typeof c === 'string' ? { label: c } : c);
    const sum = cols.reduce((s, c) => s + (c.flex ?? 1), 0);
    const cw = cols.map(c => w * (c.flex ?? 1) / sum);
    const rows = n.rows.map(r => {
        const cells = r.map((cell, i) => {
            const c = typeof cell === 'string' || typeof cell === 'number' ? { text: String(cell) } : cell;
            const lines = c.badge ? [] : wrapT(ctx, c.text ?? '', S, c.bold ? 700 : 400, cw[i] - 16);
            return { ...c, lines };
        });
        return { cells, h: Math.max(cells.some(c => c.badge) ? 32 : 28, Math.max(...cells.map(c => c.lines.length)) * lh(S) + 8) };
    });
    return { cols, cw, rows };
}
// A widget in a state that replaces its content grows to hold the state's message box (an explicit h is kept).
function nat(n, w, ctx) {
    const base = natBase(n, w, ctx);
    return n.state && n.h == null ? Math.max(base, PARTS.stateMinH(n, w, ctx)) : base;
}
function natBase(n, w, ctx) {
    if (n.h != null)
        return n.h;
    const natFn = NAT[n.t]; // per-t table: the call spot cannot correlate n with its t
    if (natFn)
        return natFn(n, w, ctx);
    switch (n.t) {
        case 'spacer': return 8;
        case 'text': return Math.max(1, textLines(n, w, ctx).length) * lh(n.size === 'title' ? T : S);
        case 'btn':
        case 'input':
        case 'select': return 32;
        case 'chip': return 24;
        case 'tabs': return 36;
        case 'appbar': return 44;
        case 'seek': return 28;
        case 'stat': return 88;
        case 'kv': return kvRows(n, w, ctx).rows.reduce((s, r) => s + r.h, 0);
        case 'list': return (n.title ? 32 : 0) + listRows(n, w, ctx).reduce((s, r) => s + r.h, 0);
        case 'table': {
            const d = tableData(n, w, ctx);
            return 28 + d.rows.reduce((s, r) => s + r.h, 0);
        }
        case 'alert': return Math.max(36, wrapT(ctx, n.text, S, 700, w - 44).length * lh(S) + 16);
        case 'col': {
            const p = n.pad ?? 0;
            return colNat(n.children, w - 2 * p, n.gap ?? GAP, ctx) + 2 * p;
        }
        case 'row': {
            const p = n.pad ?? 0;
            const ws = rowWidths(n, w - 2 * p, ctx);
            return Math.max(0, ...n.children.map((c, i) => nat(c, ws[i], ctx))) + 2 * p;
        }
        case 'card': {
            const p = n.pad ?? 10;
            return (n.title ? 28 : 0) + colNat(n.children, w - 2 * p, n.gap ?? GAP, ctx) + 2 * p;
        }
        default: return n.min ?? (n.t === 'chart' ? 100 : 80);
    }
}
// ---- placement ---------------------------------------------------------------------------
function place(n, x, y, w, h, ctx) {
    const natural = nat(n, w, ctx);
    const H = h ?? natural;
    if (CONTAINER.has(n.t) && natural > H + 1) {
        throw new Error(`wireframe(): "${label(n)}" (${n.t}) needs ${Math.ceil(natural)}px of height but only ${Math.floor(H)}px is available — raise h or remove content`);
    }
    const r = DRAW[n.t]?.(n, x, y, w, H, ctx); // per-t table: the call spot cannot correlate n with its t
    if (!r)
        throw new Error(`wireframe(): unknown node type "${n.t}"`);
    if (n.state)
        PARTS.drawState(n, x, y, r.w, r.h, ctx);
    if (n.mark) {
        ctx.used.add(n.mark);
        rect(ctx, x - 3, y - 3, r.w + 6, r.h + 6, { r: 8, stroke: 'accent', sw: 2.5, dash: n.mark === 'new' ? '6,4' : undefined });
    }
    if (n.n != null)
        ctx.callouts.push({ n: n.n, x: x + 12, y: y - (n.mark ? 9 : 6) }); // wireframe() has replaced `true` by a number
    return r;
}
function placeCol(children, x, y, w, h, gap, ctx) {
    const natH = children.map(c => nat(c, w, ctx));
    const total = natH.reduce((a, b) => a + b, 0) + gap * Math.max(0, children.length - 1);
    const flexSum = children.reduce((s, c) => s + flexOf(c), 0);
    const extra = flexSum ? Math.max(0, h - total) : 0;
    let cy = y;
    children.forEach((c, i) => {
        const ch = natH[i] + (flexSum ? extra * flexOf(c) / flexSum : 0);
        place(c, x, cy, w, ch, ctx);
        cy += ch + gap;
    });
}
const DRAW = {
    spacer: (n, x, y, w) => ({ w, h: 8 }),
    col: (n, x, y, w, h, ctx) => {
        const p = n.pad ?? 0;
        placeCol(n.children, x + p, y + p, w - 2 * p, h - 2 * p, n.gap ?? GAP, ctx);
        return { w, h };
    },
    row: (n, x, y, w, h, ctx) => {
        const p = n.pad ?? 0, gap = n.gap ?? GAP;
        const ws = rowWidths(n, w - 2 * p, ctx);
        let cx = x + p;
        n.children.forEach((c, i) => {
            const ch = h - 2 * p;
            const own = nat(c, ws[i], ctx);
            const dy = n.align === 'center' && flexOf(c) === 0 ? (ch - own) / 2 : 0;
            place(c, cx, y + p + dy, ws[i], flexOf(c) || VISUAL.has(c.t) || CONTAINER.has(c.t) ? ch : own, ctx);
            cx += ws[i] + gap;
        });
        return { w, h };
    },
    card: (n, x, y, w, h, ctx) => {
        const p = n.pad ?? 10;
        rect(ctx, x, y, w, h, { r: 8, fill: n.tone === 'muted' ? 'code' : 'bg', stroke: 'border' });
        if (n.title)
            text(ctx, n.title, x + p, y + p + T, { size: T, weight: 700 });
        const top = n.title ? 28 : 0;
        placeCol(n.children, x + p, y + p + top, w - 2 * p, h - 2 * p - top, n.gap ?? GAP, ctx);
        return { w, h };
    },
    text: (n, x, y, w, h, ctx) => {
        const size = n.size === 'title' ? T : S, weight = n.bold || n.size === 'title' ? 700 : 400;
        const lines = textLines(n, w, ctx);
        const fill = toneFill(n.tone);
        const ax = n.align === 'center' ? x + w / 2 : n.align === 'right' ? x + w : x;
        const anchor = n.align === 'center' ? 'middle' : n.align === 'right' ? 'end' : undefined;
        if (ctx.skeleton && !n.keep)
            bars(ctx, lines.map(l => tw(ctx, l, size, weight)), x, y, size);
        else
            lines.forEach((l, k) => text(ctx, l, ax, y + size + k * lh(size), { size, weight, fill, anchor }));
        return { w, h: Math.max(1, lines.length) * lh(size) };
    },
    btn: (n, x, y, w, h, ctx) => {
        const bw = n.full ? w : Math.min(w, autoW(n, ctx) ?? 0);
        const primary = !!n.primary;
        rect(ctx, x, y, bw, 32, { r: 6, fill: primary ? (n.danger ? 'danger' : 'accent') : 'bg', stroke: primary ? null : (n.danger ? 'danger' : 'text') });
        text(ctx, n.label, x + bw / 2, mid(y + 16), { weight: 700, fill: primary ? 'bg' : (n.danger ? 'danger' : 'text'), anchor: 'middle' });
        return { w: bw, h: 32 };
    },
    chip: (n, x, y, w, h, ctx) => ({ w: drawChip(ctx, n.label, x, y, n.tone), h: 24 }),
    input: (n, x, y, w, h, ctx) => {
        rect(ctx, x, y, w, 32, { r: 6, fill: 'bg', stroke: 'muted' });
        text(ctx, n.label, x + 10, mid(y + 16), { fill: n.value ? 'text' : 'muted' });
        return { w, h: 32 };
    },
    select: (n, x, y, w, h, ctx) => {
        rect(ctx, x, y, w, 32, { r: 6, fill: 'bg', stroke: 'muted' });
        text(ctx, n.label, x + 10, mid(y + 16), { fill: n.value ? 'text' : 'muted' });
        path(ctx, `M${Math.round(x + w - 24)},${Math.round(y + 13)} L${Math.round(x + w - 12)},${Math.round(y + 13)} L${Math.round(x + w - 18)},${Math.round(y + 20)} Z`, { fill: 'muted' });
        return { w, h: 32 };
    },
    tabs: (n, x, y, w, h, ctx) => {
        const active = n.active ?? 0;
        line(ctx, x, y + 34, x + w, y + 34, { stroke: 'border' });
        let cx = x;
        n.labels.forEach((l, i) => {
            const tab = tw(ctx, l, S, 700) + 28;
            text(ctx, l, cx + tab / 2, mid(y + 17), { weight: i === active ? 700 : 400, fill: i === active ? 'accent' : 'muted', anchor: 'middle' });
            if (i === active)
                line(ctx, cx, y + 34, cx + tab, y + 34, { stroke: 'accent', sw: 4 });
            cx += tab;
        });
        return { w, h: 36 };
    },
    appbar: (n, x, y, w, h, ctx) => {
        rect(ctx, x, y, w, 44, { fill: 'accent' });
        text(ctx, n.title, x + 14, mid(y + 22), { weight: 700, fill: 'bg' });
        let cx = x + 14 + tw(ctx, n.title, S, 700) + 28;
        if (ctx.skeleton) { // thumbnails: nav items become white bars
            (n.nav ?? []).forEach((l) => { const lw = Math.min(40, tw(ctx, l, S, 400) / 2); if (cx + lw < x + w - 12)
                rect(ctx, cx, y + 18, lw, 8, { r: 4, fill: 'bg', op: 0.7 }); cx += lw + 12; });
            return { w, h: 44 };
        }
        (n.nav ?? []).forEach((l, i) => {
            const active = i === (n.active ?? -1);
            text(ctx, l, cx, mid(y + 22), { weight: active ? 700 : 400, fill: 'bg' });
            const lw = tw(ctx, l, S, active ? 700 : 400);
            if (active)
                line(ctx, cx, y + 34, cx + lw, y + 34, { stroke: 'bg', sw: 3 });
            cx += lw + 24;
        });
        let rx = x + w - 14;
        for (const l of [...(n.right ?? [])].reverse()) {
            text(ctx, l, rx, mid(y + 22), { fill: 'bg', anchor: 'end' });
            rx -= tw(ctx, l, S, 400) + 20;
        }
        return { w, h: 44 };
    },
    seek: (n, x, y, w, h, ctx) => {
        const lw = n.from ? tw(ctx, n.from, S, 400) + 8 : 0, rw = n.to ? tw(ctx, n.to, S, 400) + 8 : 0;
        const x0 = x + 28 + lw, x1 = x + w - rw - 8, cy = y + 14;
        path(ctx, pts([[x + 6, cy - 8], [x + 6, cy + 8], [x + 20, cy]]) + ' Z', { fill: 'accent' });
        if (n.from)
            text(ctx, n.from, x + 28, mid(cy), { fill: 'muted' });
        if (n.to)
            text(ctx, n.to, x + w - 4, mid(cy), { fill: 'muted', anchor: 'end' });
        line(ctx, x0, cy, x1, cy, { stroke: 'border', sw: 4 });
        const at = x0 + (x1 - x0) * (n.at ?? 0.4);
        line(ctx, x0, cy, at, cy, { stroke: 'accent', sw: 4 });
        for (const m of n.marks ?? [])
            line(ctx, x0 + (x1 - x0) * m, cy - 8, x0 + (x1 - x0) * m, cy + 8, { stroke: 'danger', sw: 3 });
        circle(ctx, at, cy, 7, { fill: 'accent', stroke: 'bg' });
        return { w, h: 28 };
    },
    kv: (n, x, y, w, h, ctx) => {
        const { keyW, rows } = kvRows(n, w, ctx);
        let cy = y;
        for (const r of rows) {
            text(ctx, r.k, x, cy + 2 + S, { fill: 'muted' });
            r.lines.forEach((l, k) => text(ctx, l, x + keyW, cy + 2 + S + k * lh(S), { fill: toneFill(toneOf(r.tone)), weight: r.bold ? 700 : 400 }));
            cy += r.h;
        }
        return { w, h: cy - y };
    },
    stat: (n, x, y, w, h, ctx) => {
        const tone = toneOf(n.tone);
        rect(ctx, x, y, w, 88, { r: 8, fill: tone === 'danger' ? 'bg' : 'code', stroke: tone === 'danger' ? 'danger' : 'border' });
        text(ctx, n.value, x + w / 2, y + 52, { size: 34, weight: 700, fill: toneFill(tone), anchor: 'middle' });
        text(ctx, n.label, x + w / 2, y + 76, { fill: 'muted', anchor: 'middle' });
        return { w, h: 88 };
    },
    list: (n, x, y, w, h, ctx) => {
        let cy = y;
        if (n.title) {
            text(ctx, n.title, x, cy + 20, { size: T, weight: 700 });
            line(ctx, x, cy + 31, x + w, cy + 31, { stroke: 'border' });
            cy += 32;
        }
        for (const r of listRows(n, w, ctx)) {
            if (r.o.active)
                rect(ctx, x, cy, w, r.h, { r: 4, fill: 'soft' });
            if (ctx.skeleton && !r.o.keep)
                bars(ctx, r.lines.map(l => tw(ctx, l, S, 400)), x + 10, cy + (r.h - lh(S) * r.lines.length) / 2 - 6);
            else
                r.lines.forEach((l, k) => text(ctx, l, x + 10, cy + (r.h - lh(S) * r.lines.length) / 2 + S + k * lh(S), { weight: r.o.active ? 700 : 400 }));
            if (r.o.badge)
                drawChip(ctx, r.o.badge, x + w - r.bw + 8 - 6, cy + (r.h - 24) / 2, r.o.tone);
            line(ctx, x, cy + r.h, x + w, cy + r.h, { stroke: 'border', sw: 1.5 });
            cy += r.h;
        }
        return { w, h: cy - y };
    },
    table: (n, x, y, w, h, ctx) => {
        const d = tableData(n, w, ctx);
        const total = nat(n, w, ctx);
        rect(ctx, x, y, w, 28, { fill: 'soft' });
        let cx = x;
        d.cols.forEach((c, i) => { text(ctx, c.label, cx + 8, mid(y + 14), { weight: 700 }); cx += d.cw[i]; });
        let cy = y + 28;
        for (const r of d.rows) {
            line(ctx, x, cy, x + w, cy, { stroke: 'border', sw: 1.5 });
            cx = x;
            r.cells.forEach((c, i) => {
                if (c.badge)
                    drawChip(ctx, c.badge, cx + 8, cy + (r.h - 24) / 2, c.tone);
                else if (ctx.skeleton && !c.keep)
                    bars(ctx, c.lines.map(l => tw(ctx, l, S, 400)), cx + 8, cy + (r.h - lh(S) * c.lines.length) / 2 - 6);
                else
                    c.lines.forEach((l, k) => text(ctx, l, cx + 8, cy + (r.h - lh(S) * c.lines.length) / 2 + S + k * lh(S), { weight: c.bold ? 700 : 400, fill: toneFill(toneOf(c.tone)) }));
                cx += d.cw[i];
            });
            cy += r.h;
        }
        rect(ctx, x, y, w, total, { r: 6, stroke: 'border' });
        return { w, h: total };
    },
    alert: (n, x, y, w, h, ctx) => {
        const tone = toneOf(n.tone);
        const ALERT = { danger: { fill: 'bg', stroke: 'danger', text: 'danger' }, accent: { fill: 'soft', stroke: 'accent', text: 'text' } };
        const st = ALERT[tone] ?? { fill: 'code', stroke: 'border', text: 'text' };
        const lines = wrapT(ctx, n.text, S, 700, w - 44);
        const H = Math.max(36, lines.length * lh(S) + 16);
        rect(ctx, x, y, w, H, { r: 6, fill: st.fill, stroke: st.stroke });
        circle(ctx, x + 18, y + H / 2, 9, { fill: tone === 'danger' ? 'danger' : 'accent' });
        text(ctx, '!', x + 18, mid(y + H / 2), { weight: 700, fill: 'bg', anchor: 'middle' });
        lines.forEach((l, k) => text(ctx, l, x + 36, y + (H - lh(S) * lines.length) / 2 + S + k * lh(S), { weight: 700, fill: st.text }));
        return { w, h: H };
    },
    image: (n, x, y, w, h, ctx) => {
        rect(ctx, x, y, w, h, { r: 6, fill: 'code', stroke: 'border' });
        line(ctx, x + 1, y + 1, x + w - 1, y + h - 1, { stroke: 'border', sw: 1.5 });
        line(ctx, x + w - 1, y + 1, x + 1, y + h - 1, { stroke: 'border', sw: 1.5 });
        const lw = tw(ctx, n.label, S, 400) + 16;
        rect(ctx, x + w / 2 - lw / 2, y + h / 2 - 12, lw, 24, { r: 4, fill: 'code' });
        text(ctx, n.label, x + w / 2, mid(y + h / 2), { fill: 'muted', anchor: 'middle' });
        return { w, h };
    },
    video: (n, x, y, w, h, ctx) => {
        rect(ctx, x, y, w, h, { r: 6, fill: 'code', stroke: 'border' });
        const s = Math.min(w, h) * 0.16;
        path(ctx, pts([[x + w / 2 - s / 2, y + h / 2 - s], [x + w / 2 - s / 2, y + h / 2 + s], [x + w / 2 + s, y + h / 2]]) + ' Z', { fill: 'border' });
        frameDecor(n, x, y, w, h, ctx, n.live ? [{ text: 'LIVE', tone: 'solid-danger' }] : []);
        return { w, h };
    },
    heat: (n, x, y, w, h, ctx) => {
        rect(ctx, x, y, w, h, { r: 6, fill: 'code', stroke: 'border' });
        const base = Math.min(w, h), hx = x + w * (n.probe?.x ?? 0.46), hy = y + h * (n.probe?.y ?? 0.5);
        circle(ctx, x + w * 0.2, y + h * 0.66, base * 0.16, { fill: 'accent', op: 0.15 });
        [[0.3, 0.12], [0.2, 0.25], [0.1, 0.5]].forEach(([r, op]) => circle(ctx, hx, hy, base * r, { fill: 'danger', op }));
        line(ctx, hx - 14, hy, hx + 14, hy, { stroke: 'text', sw: 2 });
        line(ctx, hx, hy - 14, hx, hy + 14, { stroke: 'text', sw: 2 });
        [0.6, 0.45, 0.3, 0.2, 0.12].forEach((op, i) => rect(ctx, x + w - 24, y + h * 0.2 + i * (h * 0.12), 12, h * 0.12, { fill: i < 2 ? 'danger' : 'accent', op }));
        const maxLabel = n.probe?.value ?? n.max;
        if (n.scale) { // numeric colour scale: max at the top of the bar, min at the bottom
            const [lo, hi] = n.scale, u = n.unit ?? '℃', top = y + h * 0.2, bot = y + h * 0.8;
            const lab = (v, yy) => text(ctx, `${v}${u}`, x + w - 30, mid(yy), { fill: 'muted', anchor: 'end' });
            lab(hi, top + 6);
            lab(Math.round((lo + hi) * 5) / 10, (top + bot) / 2);
            lab(lo, bot - 6);
        }
        if (maxLabel) {
            const mw = tw(ctx, maxLabel, S, 700) + 12;
            const pref = hx + 18 + mw > x + w - 32 ? hx - 18 - mw : hx + 18;
            const lx = Math.max(x + 6, Math.min(pref, x + w - mw - 6));
            rect(ctx, lx, hy - 32, mw, 22, { r: 4, fill: 'bg', stroke: 'danger' });
            text(ctx, maxLabel, lx + mw / 2, mid(hy - 21), { weight: 700, fill: 'danger', anchor: 'middle' });
        }
        frameDecor(n, x, y, w, h, ctx, []);
        return { w, h };
    },
    pointcloud: (n, x, y, w, h, ctx) => {
        rect(ctx, x, y, w, h, { r: 6, fill: 'code', stroke: 'border' });
        const rnd = rng(7 + Math.round(w) * 31 + Math.round(h));
        const count = Math.max(60, Math.min(260, Math.round(w * h / 450)));
        for (let i = 0; i < count; i++) {
            let px, py;
            const kind = i % 5;
            if (kind < 2) {
                px = x + 12 + rnd() * (w - 24);
                py = y + h * 0.72 + (rnd() - 0.5) * h * 0.06;
            } // floor line
            else if (kind === 2) {
                px = x + w * 0.22 + (rnd() - 0.5) * w * 0.03;
                py = y + 14 + rnd() * h * 0.6;
            } // wall
            else {
                const a = rnd() * Math.PI * 2, rr = rnd();
                px = x + w * 0.62 + Math.cos(a) * rr * w * 0.16;
                py = y + h * 0.5 + Math.sin(a) * rr * h * 0.2;
            } // equipment
            rect(ctx, px, py, 4, 4, { fill: 'accent', op: 0.35 + rnd() * 0.55 });
        }
        frameDecor(n, x, y, w, h, ctx, []);
        return { w, h };
    },
    chart: (n, x, y, w, h, ctx) => {
        rect(ctx, x, y, w, h, { r: 6, fill: 'bg', stroke: 'border' });
        if (n.label)
            text(ctx, n.label, x + 10, y + 8 + S, { weight: 700 });
        const x0 = x + 14, x1 = x + w - 14, y0 = y + (n.label ? 34 : 14), y1 = y + h - (n.xLabels ? 32 : 14);
        for (let i = 0; i < 3; i++)
            line(ctx, x0, y0 + (y1 - y0) * i / 3, x1, y0 + (y1 - y0) * i / 3, { stroke: 'border', sw: 1.5, dash: '4,4' });
        line(ctx, x0, y1, x1, y1, { stroke: 'muted' });
        const vals = n.points ?? [0.3, 0.35, 0.4, 0.45, 0.6, 0.8];
        const px = (i) => x0 + (vals.length === 1 ? 0 : i * (x1 - x0) / (vals.length - 1));
        const py = (v) => y1 - Math.max(0, Math.min(1, v)) * (y1 - y0);
        if (n.threshold != null) {
            line(ctx, x0, py(n.threshold), x1, py(n.threshold), { stroke: 'danger', sw: 2, dash: '6,4' });
            if (n.thresholdLabel) {
                const lw = tw(ctx, n.thresholdLabel, S, 400) + 16;
                rect(ctx, x0 + 2, py(n.threshold) - 26, lw, 22, { fill: 'bg' });
                text(ctx, n.thresholdLabel, x0 + 10, py(n.threshold) - 10, { fill: 'danger' });
            }
        }
        if (n.kind === 'bar') {
            const bw = Math.max(6, (x1 - x0) / vals.length * 0.55);
            vals.forEach((v, i) => rect(ctx, x0 + (x1 - x0) / vals.length * (i + 0.5) - bw / 2, py(v), bw, y1 - py(v), { fill: 'accent', op: 0.8 }));
        }
        else {
            path(ctx, pts(vals.map((v, i) => [px(i), py(v)])), { stroke: 'accent', sw: 3 });
            vals.forEach((v, i) => circle(ctx, px(i), py(v), i === n.alertAt ? 7 : 4, { fill: i === n.alertAt ? 'danger' : 'accent' }));
        }
        if (n.xLabels) {
            text(ctx, n.xLabels[0], x0, y + h - 10, { fill: 'muted' });
            text(ctx, n.xLabels[n.xLabels.length - 1], x1, y + h - 10, { fill: 'muted', anchor: 'end' });
        }
        return { w, h };
    },
    map: (n, x, y, w, h, ctx) => {
        rect(ctx, x, y, w, h, { r: 6, fill: 'code', stroke: 'border' });
        const top = (n.overlay?.length || n.overlayRight?.length) ? 40 : 14;
        const bx = x + 14, by = y + top, bw = w - 28, bh = h - top - 14;
        const F = (fx, fy) => [bx + fx * bw, by + fy * bh];
        const plan = n.plan ?? 'floor';
        if (plan === 'floor') {
            rect(ctx, bx, by, bw, bh, { fill: 'bg', stroke: 'muted' });
            for (const [a, b, c, d] of [[0.38, 0, 0.38, 0.4], [0.38, 0.58, 0.38, 1], [0, 0.55, 0.38, 0.55], [0.38, 0.5, 1, 0.5]]) {
                const [p, q] = [F(a, b), F(c, d)];
                line(ctx, p[0], p[1], q[0], q[1], { stroke: 'muted' });
            }
        }
        else if (plan === 'site') {
            for (const [a, b, c, d] of [[0.06, 0.14, 0.32, 0.42], [0.46, 0.08, 0.24, 0.32], [0.54, 0.5, 0.36, 0.38]]) {
                const [p] = [F(a, b)];
                rect(ctx, p[0], p[1], c * bw, d * bh, { r: 4, fill: 'bg', stroke: 'muted' });
            }
        }
        if (n.route && n.route.length > 1)
            path(ctx, pts(n.route.map(([a, b]) => F(a, b))), { stroke: 'accent', sw: 3, dash: '8,5' });
        for (const m of n.markers ?? [])
            drawMarker(m, F(m.x, m.y), x, x + w, ctx);
        if (n.legend?.length)
            drawMapLegend(n.legend, x + w - 8, y + 8, ctx);
        frameDecor(n, x, y, w, h, ctx, []);
        return { w, h };
    },
};
// A key for the markers on a map: [{kind: 'robot' | 'equip' | 'alert' | 'site', label}], top-right.
function drawMapLegend(items, right, top, ctx) {
    const lw = Math.max(...items.map(i => tw(ctx, i.label, S, 400))) + 44;
    const H = items.length * 24 + 8, X = right - lw, Y = top;
    rect(ctx, X, Y, lw, H, { r: 6, fill: 'bg', op: 0.95, stroke: 'border', sw: 1.5 });
    items.forEach((it, k) => {
        const cx = X + 18, cy = Y + 16 + k * 24;
        if (it.kind === 'alert')
            path(ctx, pts([[cx, cy - 7], [cx + 7, cy], [cx, cy + 7], [cx - 7, cy]]) + ' Z', { fill: 'danger' });
        else if (it.kind === 'equip')
            rect(ctx, cx - 6, cy - 6, 12, 12, { r: 2, fill: 'bg', stroke: 'text' });
        else
            circle(ctx, cx, cy, it.kind === 'site' ? 7 : 6, { fill: 'accent' });
        text(ctx, it.label, X + 34, mid(cy), {});
    });
}
function drawMarker(m, [px, py], minX, maxX, ctx) {
    const kind = m.kind ?? 'robot';
    let r = m.inside != null ? 11 : 9;
    if (kind === 'robot') {
        if (m.fov)
            PARTS.fovSector(ctx, px, py, m.heading ?? 0, m.fov, m.fovR ?? 40);
        if (m.id || m.shape) {
            PARTS.glyph(ctx, px, py, { shape: m.shape, id: m.id, r: 11 });
            r = 12;
        }
        else
            circle(ctx, px, py, 9, { fill: 'accent', stroke: 'bg', sw: 3 });
        if (m.heading != null)
            PARTS.headingArrow(ctx, px, py, m.heading, r + 3);
    }
    else if (kind === 'site') {
        r = 12;
        circle(ctx, px, py, 12, { fill: 'accent', stroke: 'bg', sw: 3 });
    }
    else if (kind === 'alert')
        path(ctx, pts([[px, py - 11], [px + 11, py], [px, py + 11], [px - 11, py]]) + ' Z', { fill: 'danger', stroke: 'bg', sw: 2 });
    else {
        rect(ctx, px - 8, py - 8, 16, 16, { r: 3, fill: 'bg', stroke: m.tone === 'danger' ? 'danger' : 'text' });
        r = 9;
    }
    if (m.inside != null) { // a number drawn inside the dot (route points)
        circle(ctx, px, py, 11, { fill: 'accent', stroke: 'bg', sw: 2 });
        text(ctx, m.inside, px, mid(py), { weight: 700, fill: 'bg', anchor: 'middle' });
    }
    if (m.label) {
        const lw = tw(ctx, m.label, S, 700) + 8;
        const col = kind === 'alert' ? 'danger' : 'text';
        if (m.side === 'bottom' || m.side === 'top') {
            const ly = m.side === 'bottom' ? py + r + 3 : py - r - 3 - 22;
            rect(ctx, px - lw / 2, ly, lw, 22, { r: 4, fill: 'bg', op: 0.92 });
            text(ctx, m.label, px, mid(ly + 11), { weight: 700, fill: col, anchor: 'middle' });
        }
        else {
            let lx = px + r + 4;
            if (m.side === 'left' || lx + lw > maxX - 16)
                lx = px - r - 4 - lw;
            rect(ctx, lx, py - 11, lw, 22, { r: 4, fill: 'bg', op: 0.92 });
            text(ctx, m.label, lx + 4, mid(py), { weight: 700, fill: col });
        }
    }
    if (m.n != null)
        ctx.callouts.push({ n: m.n, x: px + 14, y: py - 14 }); // wireframe() has replaced `true` by a number
}
// overlay chips (top-left / top-right), label (bottom-left), stamp (bottom-right) shared by visual widgets
function frameDecor(n, x, y, w, h, ctx, defaults) {
    let cx = x + 8;
    for (const c of [...defaults, ...(n.overlay ?? []).map(chipSpec)])
        cx += drawChip(ctx, c.text, cx, y + 8, c.tone) + 6;
    let rx = x + w - 8;
    for (const c of [...(n.overlayRight ?? [])].reverse().map(chipSpec)) {
        const cw = chipW(ctx, c.text);
        rx -= cw;
        drawChip(ctx, c.text, rx, y + 8, c.tone);
        rx -= 6;
    }
    if (n.label && n.t !== 'chart') {
        const lw = tw(ctx, n.label, S, 700) + 12;
        rect(ctx, x + 8, y + h - 30, lw, 22, { r: 4, fill: 'bg', op: 0.92 });
        text(ctx, n.label, x + 14, mid(y + h - 19), { weight: 700, fill: 'muted' });
    }
    if (n.stamp) {
        const sw = tw(ctx, n.stamp, S, 400) + 12;
        rect(ctx, x + w - 8 - sw, y + h - 30, sw, 22, { r: 4, fill: 'bg', op: 0.92 });
        text(ctx, n.stamp, x + w - 14, mid(y + h - 19), { fill: 'muted', anchor: 'end' });
    }
}
function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
// ---- screen frame, callouts, notes, legend ------------------------------------------------------
const TITLE_H = 32;
const kidsOf = (v) => v ? [v].flat() : [];
// What an overlay covers is not drawn: text that touches the rect and shapes lying wholly inside it are
// dropped (they would be invisible anyway, and would only confuse overlap checks on the finished SVG).
function hideUnder(ctx, X, Y, W, H) {
    const inside = (x, y, w, h) => x >= X && y >= Y && x + w <= X + W && y + h <= Y + H;
    ctx.prims = ctx.prims.filter(p => {
        if (p.k === 'text') {
            const w = tw(ctx, p.s, p.size, p.weight), x0 = p.anchor === 'middle' ? p.x - w / 2 : p.anchor === 'end' ? p.x - w : p.x;
            return !(x0 < X + W && x0 + w > X && p.y - p.size < Y + H && p.y + 4 > Y);
        }
        if (p.k === 'rect')
            return !inside(p.x, p.y, p.w, p.h);
        if (p.k === 'circle')
            return !inside(p.cx - p.r, p.cy - p.r, 2 * p.r, 2 * p.r);
        return true;
    });
}
// dialog: a dimmed screen with a centred card; toast: a dark notice at the bottom right. Both sit over the screen.
function drawOverlay(o, ctx, x, y, w, h) {
    if (o.t === 'toast') {
        const tone = toneOf(o.tone);
        const lead = o.n != null ? 28 : 0; // room for the callout inside the toast
        const tw_ = tw(ctx, o.text, S, 700) + 32 + lead, H = 36;
        const tx = x + w - 14 - tw_, ty = y + h - 14 - H;
        hideUnder(ctx, tx, ty, tw_, H);
        rect(ctx, tx, ty, tw_, H, { r: 6, fill: tone === 'danger' ? 'danger' : 'text' });
        text(ctx, o.text, tx + lead + (tw_ - lead) / 2, mid(ty + H / 2), { weight: 700, fill: 'bg', anchor: 'middle' });
        if (o.n != null) {
            rect(ctx, tx + 2, ty + 2, 32, H - 4, { fill: tone === 'danger' ? 'danger' : 'text' }); // same colour as the toast: keeps the callout's own box the innermost one for overlap checks
            ctx.callouts.push({ n: o.n, x: tx + 18, y: ty + H / 2 }); // wireframe() has replaced `true` by a number
        }
        return;
    }
    if (o.t !== 'dialog')
        throw new Error(`wireframe(): overlay must be wf.dialog or wf.toast, got "${o.t}"`); // o is `never` here for valid input
    const dw = o.w ?? Math.min(380, w - 48), pad = 16;
    const body = o.body ? wrapT(ctx, o.body, S, 400, dw - 2 * pad) : [];
    const buttons = o.buttons ?? [];
    const dh = pad + 24 + (body.length ? 8 + body.length * lh(S) : 0) + (buttons.length ? 16 + 32 : 0) + pad;
    const dx = x + (w - dw) / 2, dy = y + (h - dh) / 2;
    rect(ctx, x, y, w, h, { fill: 'text', op: 0.3 });
    hideUnder(ctx, dx, dy, dw, dh);
    rect(ctx, dx, dy, dw, dh, { r: 8, fill: 'bg', stroke: 'text', sw: 2.5 });
    text(ctx, o.title, dx + pad, dy + pad + T, { size: T, weight: 700 });
    if (body.length)
        rect(ctx, dx + pad - 8, dy + pad + 24, dw - 2 * pad + 16, body.length * lh(S) + 16, { fill: 'bg' }); // opaque backing: keeps the body text the innermost box for overlap checks
    body.forEach((l, k) => text(ctx, l, dx + pad, dy + pad + 24 + 8 + S + k * lh(S), {}));
    let bx = dx + dw - pad;
    for (const b of [...buttons].reverse()) {
        const bw = autoW(b, ctx) ?? 0; // a btn always has a natural width
        bx -= bw;
        place(b, bx, dy + dh - pad - 32, bw, 32, ctx);
        bx -= 8;
    }
    if (o.n != null)
        ctx.callouts.push({ n: o.n, x: dx + dw - 18, y: dy + 18 }); // wireframe() has replaced `true` by a number
}
function flushCallouts(ctx) {
    for (const c of ctx.callouts) {
        ctx.all.push({ n: c.n, x: c.x, y: c.y }); // kept on the band, so `check` can compare the numbers' order with the reading order
        rect(ctx, c.x - 12, c.y - 12, 24, 24, { fill: 'bg', op: 0 }); // invisible: the number's own "container" (a callout can sit on a frame edge)
        circle(ctx, c.x, c.y, 11, { fill: 'accent', stroke: 'bg', sw: 2 });
        text(ctx, c.n, c.x, mid(c.y), { weight: 700, fill: 'bg', anchor: 'middle' });
    }
    ctx.callouts = [];
}
const rootOf = (item) => Array.isArray(item.root) ? wf.col(item.root, { pad: 8 }) : item.root.t === 'col' && item.root.pad == null ? { ...item.root, pad: 8 } : item.root;
const insetOf = (item) => (item.frame ?? 'screen') === 'none' ? 0 : 3;
// the height a screen/cell needs for its content (h: 'fit')
const fitHeight = (item, ctx, w) => Math.ceil(nat(rootOf(item), w - 2 * insetOf(item), ctx)) + 2 * insetOf(item);
function layoutScreen(item, ctx, x, y, w, defaultH) {
    const frame = item.frame ?? 'screen', inset = insetOf(item);
    const hh = item.h ?? defaultH;
    const H = hh === 'fit' ? fitHeight(item, ctx, w) : hh;
    let y0 = y;
    if (item.title) {
        text(ctx, item.title, x, y + 20, { size: T, weight: 700 });
        if (item.tag)
            drawChip(ctx, item.tag, x + tw(ctx, item.title, T, 700) + 10, y + 2, item.tagTone ?? (item.tag === '新規' ? 'solid' : 'accent'));
        y0 += TITLE_H;
    }
    ctx.skeleton = !!item.skeleton;
    if (frame === 'screen')
        rect(ctx, x, y0, w, H, { r: 4, fill: 'bg', stroke: 'text', sw: 2.5 });
    else if (frame === 'light')
        rect(ctx, x, y0, w, H, { r: 8, fill: 'bg', stroke: 'border', sw: 2 });
    place(rootOf(item), x + inset, y0 + inset, w - 2 * inset, H - 2 * inset, ctx);
    for (const o of kidsOf(item.overlays))
        drawOverlay(o, ctx, x + inset, y0 + inset, w - 2 * inset, H - 2 * inset);
    flushCallouts(ctx);
    return { frame: { x, y: y0, w, h: H }, top: y, bottom: y0 + H };
}
// ---- state matrix: rows (parts) x columns (states); every cell is a design, "対象外" (n/a, with a reason) or "未設計" (to do)
function layoutMatrix(band, ctx, x, y, w) {
    const m = band.matrix, n = m.cols.length, labelW = m.labelW ?? 112, gap = m.gap ?? 12;
    const cw = (w - labelW - gap * n) / n, anchors = [];
    let cy = y;
    m.cols.forEach((c, i) => text(ctx, c, x + labelW + gap + i * (cw + gap) + cw / 2, cy + 20, { size: T, weight: 700, anchor: 'middle' }));
    cy += 32;
    for (const row of m.rows) {
        if (row.cells.length > n)
            throw new Error(`stateMatrix(): row "${row.label}" has ${row.cells.length} cells for ${n} columns`);
        row.cells = Array.from({ length: n }, (_, i) => row.cells[i]); // a missing cell is "未設計", never a blank
        const nodes = row.cells.filter((c) => !!c && typeof c === 'object' && 't' in c && !!c.t);
        const rh = m.cellH ?? Math.max(72, ...nodes.map(nd => Math.ceil(nat(nd, cw - 6, ctx)) + 6));
        const lab = wrapT(ctx, row.label, T, 700, labelW - 8), note = row.note ? wrapT(ctx, row.note, S, 400, labelW - 8) : [];
        const th = lab.length * lh(T) + (note.length ? 2 + note.length * lh(S) : 0);
        let ty = cy + Math.max(0, (rh - th) / 2);
        lab.forEach((l, k) => text(ctx, l, x, ty + T + k * lh(T), { size: T, weight: 700 }));
        ty += lab.length * lh(T) + 2;
        note.forEach((l, k) => text(ctx, l, x, ty + S + k * lh(S), { fill: 'muted' }));
        row.cells.forEach((cell, i) => {
            const cx = x + labelW + gap + i * (cw + gap);
            const na = naOf(cell);
            if (cell === 'na' || na !== undefined) {
                rect(ctx, cx, cy, cw, rh, { r: 8, fill: 'code', stroke: 'border', sw: 2, dash: '6,4' });
                text(ctx, '対象外', cx + cw / 2, mid(cy + rh / 2 - (na ? 10 : 0)), { weight: 700, fill: 'muted', anchor: 'middle' });
                if (na)
                    wrapT(ctx, na, S, 400, cw - 16).forEach((l, k) => text(ctx, l, cx + cw / 2, cy + rh / 2 + 10 + S * 0.36 + k * lh(S), { fill: 'muted', anchor: 'middle' }));
            }
            else if (cell == null || cell === 'todo') {
                rect(ctx, cx, cy, cw, rh, { r: 8, fill: 'bg', stroke: 'danger', sw: 2.5, dash: '6,4' });
                text(ctx, '未設計', cx + cw / 2, mid(cy + rh / 2), { weight: 700, fill: 'danger', anchor: 'middle' });
            }
            else {
                const scr = layoutScreen({ root: cell, h: rh, frame: m.cellFrame ?? 'light', skeleton: band.skeleton }, ctx, cx, cy, cw, rh);
                anchors.push({ x: scr.frame.x, y: scr.top, w: scr.frame.w, h: scr.bottom - scr.top });
            }
        });
        cy += rh + 12;
    }
    return { bottom: cy - 12, anchors };
}
function drawMarksLegend(ctx, marks, x, y) {
    let cx = x;
    for (const k of ['new', 'changed']) {
        if (!ctx.used.has(k))
            continue;
        rect(ctx, cx, y + 4, 28, 16, { r: 4, stroke: 'accent', sw: 2.5, dash: k === 'new' ? '6,4' : undefined });
        const lab = marks?.[k] ?? (k === 'new' ? '新規' : '改修');
        text(ctx, lab, cx + 36, mid(y + 12), {});
        cx += 36 + tw(ctx, lab, S, 400) + 24;
    }
    return ctx.used.size ? 28 : 0;
}
function drawNotes(ctx, notes, x, y, w) {
    let cy = y;
    notes.forEach((nt, i) => {
        const o = typeof nt === 'string' ? { text: nt } : nt;
        const num = o.n ?? i + 1;
        const tl = o.title ? wrapT(ctx, o.title, S, 700, w - 48) : [];
        const bl = o.text ? wrapT(ctx, o.text, S, 400, w - 48) : [];
        circle(ctx, x + 12, cy + 12, 11, { fill: 'accent', stroke: 'bg', sw: 2 });
        text(ctx, num, x + 12, mid(cy + 12), { weight: 700, fill: 'bg', anchor: 'middle' });
        let ty = cy + 4;
        for (const l of tl) {
            text(ctx, l, x + 36, ty + S, { weight: 700 });
            ty += lh(S);
        }
        for (const l of bl) {
            text(ctx, l, x + 36, ty + S, { fill: o.title ? 'muted' : 'text' });
            ty += lh(S);
        }
        cy = Math.max(cy + 28, ty + 4) + 10;
    });
    return cy - 10 - y;
}
export function layoutWireframe(band, x, y, w, widthOf) {
    const ctx = mkCtx(widthOf, band.skeleton);
    const hasNotes = !!band.notes?.length;
    const noteW = band.noteW ?? 264, gap = 28;
    const sw = hasNotes ? w - noteW - gap : w;
    const scr = layoutScreen({ title: band.title, tag: band.tag, tagTone: band.tagTone, root: band.root, overlays: band.overlays, h: band.h, frame: band.frame, skeleton: band.skeleton }, ctx, x, y, sw, 440);
    let bottom = scr.bottom;
    if (hasNotes)
        bottom = Math.max(bottom, scr.frame.y + drawNotes(ctx, band.notes, x + sw + gap, scr.frame.y, noteW));
    bottom += drawMarksLegend(ctx, band.marks, x, bottom + 4) ? 32 : 0;
    return { type: 'wireframe', id: band.id, title: band.title, x, y, w, h: bottom - y, prims: ctx.prims, callouts: ctx.all, anchors: band.id ? [{ id: band.id, ...scr.frame }] : [] };
}
export function layoutScreens(band, x, y, w, widthOf) {
    const ctx = mkCtx(widthOf, band.skeleton);
    if (band.matrix) {
        const r = layoutMatrix(band, ctx, x, y, w);
        const bottom = r.bottom + (drawMarksLegend(ctx, band.marks, x, r.bottom + 4) ? 32 : 0);
        return { type: 'screens', id: band.id, title: band.matrix.rows[0]?.label, x, y, w, h: bottom - y, prims: ctx.prims, anchors: r.anchors }; // matrix cells have no id (see LaidOutScreens.anchors)
    }
    const gap = band.gap ?? 64, rowGap = band.rowGap ?? 56;
    const explicit = band.items.some(it => it.at);
    const cols = band.cols ?? (explicit ? Math.max(...band.items.map(it => it.at ? Math.ceil(it.at[1] + 1) : 0)) : 3);
    const cw = (w - (cols - 1) * gap) / cols;
    // each item gets [row, col]; col may be fractional (0.5 = half a column in) — explicit via `at`, else row-major
    const cells = band.items.map((it, i) => ({ it, row: it.at ? it.at[0] : Math.floor(i / cols), col: it.at ? it.at[1] : i % cols }));
    const nRows = Math.max(...cells.map(c => c.row)) + 1;
    const anchors = [];
    let cy = y;
    for (let r = 0; r < nRows; r++) {
        let rowBottom = cy;
        const inRow = cells.filter(c => c.row === r);
        // h: 'fit' — every screen in a row takes the height of the tallest content in that row
        const fits = inRow.filter(({ it }) => (it.h ?? band.h) === 'fit').map(({ it }) => fitHeight(it, ctx, cw));
        const rowFit = fits.length ? Math.max(...fits) : undefined;
        for (const { it, col } of inRow) {
            const scr = layoutScreen({ ...it, h: (it.h ?? band.h) === 'fit' ? rowFit : it.h, skeleton: it.skeleton ?? band.skeleton }, ctx, x + col * (cw + gap), cy, cw, band.h ?? 320);
            if (it.id)
                anchors.push({ id: it.id, x: scr.frame.x, y: scr.top, w: scr.frame.w, h: scr.bottom - scr.top }); // includes the title row, so arrows stop above it
            rowBottom = Math.max(rowBottom, scr.bottom);
        }
        cy = rowBottom + rowGap;
    }
    let bottom = cy - rowGap;
    bottom += drawMarksLegend(ctx, band.marks, x, bottom + 4) ? 32 : 0;
    return { type: 'screens', id: band.id, title: band.items[0]?.title, x, y, w, h: bottom - y, prims: ctx.prims, anchors };
}
// ---- parts defined in wireframe-parts.ts (states, fusion, robot status, insight, compare, controls) ----
const AUTO_W = {}, NAT = {};
const PARTS = installParts({ wf, DRAW, NAT, AUTO_W, S, T, lh, rect, circle, text, path, line, pts, mid, tw, wrapT, drawChip, chipW, hideUnder });
