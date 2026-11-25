import { partStep } from './parts.js';
import { assertScope } from './scope-name.js';
import { must } from './must.js';
import { TEXT_TONES, common, checkTones, WIDEN, refIndex, nodeOf, LINE, g4 } from './flow-layout-core.js';
export function concentricBand(rings, opts = {}) {
    assertScope(opts.scope, 'concentric()');
    if (typeof rings === 'number') {
        if (!opts.sectors)
            throw new Error('concentric(): rings is a number only with sectors (plain rings cut into sectors); otherwise name each ring');
        if (!(Number.isInteger(rings) && rings >= 1 && rings <= 6))
            throw new Error(`concentric(): rings must be 1..6 (got ${rings})`);
    }
    else {
        common('concentric', rings, opts.id);
        checkTones('concentric', rings, TEXT_TONES);
    }
    const list = typeof rings === 'number' ? Array.from({ length: rings }, () => ({ label: '' })) : [...rings];
    const order = opts.order ?? 'outer-first', labels = opts.labels ?? 'inside';
    const { sectors, marks, ...rest } = opts;
    if (marks !== undefined && !sectors)
        throw new Error('concentric(): marks sit in sectors — give sectors too');
    if (opts.fromLegend !== undefined && !sectors)
        throw new Error('concentric(): fromLegend is the key of the marks\' moves — give sectors and marks');
    if (opts.layout !== undefined && opts.layout !== 'circle' && opts.layout !== 'stack')
        throw new Error(`concentric(): layout must be 'circle' or 'stack' (got ${JSON.stringify(opts.layout)})`);
    if (opts.layout === 'stack' && !sectors)
        throw new Error("concentric(): layout: 'stack' draws the sectors as columns — give sectors too");
    if (!sectors)
        return { ...rest, type: 'concentric', rings: list, order, labels };
    if (labels === 'side')
        throw new Error("concentric(): with sectors the ring names are written along the 12 o'clock cut — leave out labels: 'side'");
    if (list.some(r => r.description))
        throw new Error("concentric(): a ring's description is written in the side key only (labels: 'side'), which sectors do not have");
    if (list.length > 6)
        throw new Error(`concentric(): with sectors, 1..6 rings (got ${list.length})`);
    return { ...rest, type: 'concentric', rings: list, order, labels, ...concentricMarks(list, order, sectors, marks, opts) };
}
/** ADR 0065: the sectors and the marks of a concentric, the marks' rings counted from the centre. */
function concentricMarks(rings, order, sectors, given, opts) {
    if (sectors.length < 1 || sectors.length > 8)
        throw new Error(`concentric(): needs 1..8 sectors (got ${sectors.length})`);
    common('concentric', sectors, opts.id);
    const n = rings.length, plain = rings.every(r => !r.label);
    // a ring or a sector is named by its label: two with one label could not be told apart (nor share an id)
    for (const [what, xs] of [['sector', sectors], ['ring', plain ? [] : rings]]) {
        const seen = new Set();
        for (const x of xs) {
            if (seen.has(x.label))
                throw new Error(`concentric(): two ${what}s are labelled "${x.label}" — a mark names its ${what} by label, so each needs its own`);
            seen.add(x.label);
        }
    }
    const ids = new Set();
    for (const x of [...rings, ...sectors])
        if (x.id) {
            if (ids.has(x.id))
                throw new Error(`concentric(): duplicate id "${x.id}"`);
            ids.add(x.id);
        }
    // a ring as written (1 = the first of `rings`) -> its place from the centre (0 = the innermost)
    const fromCentre = (i) => order === 'outer-first' ? n - 1 - i : i;
    const at = (what, ring, r) => {
        if (ring !== undefined && r !== undefined)
            throw new Error(`concentric(): ${what} gives both ring and r — keep one`);
        if (r !== undefined) {
            if (!(typeof r === 'number' && r >= 0 && r <= 1))
                throw new Error(`concentric(): ${what} r must be from 0 (the centre) to 1 (the outer edge) (got ${r})`);
            return { r };
        }
        if (ring === undefined)
            throw new Error(`concentric(): ${what} needs a ring (1..${n}, in the order rings are written${plain ? '' : ', or its name'}) or r (0..1)`);
        if (typeof ring === 'string' && plain)
            throw new Error(`concentric(): ${what} names the ring "${ring}", but the rings have no names — give its number (1..${n})`);
        return { ring: fromCentre(refIndex('concentric', `${what} ring`, ring, rings)) };
    };
    const marks = (given ?? []).map((m, i) => {
        const what = `mark ${i + 1}${m?.label ? ` "${m.label}"` : ''}`;
        if (!m || typeof m.label !== 'string' || !m.label.trim())
            throw new Error(`concentric(): mark ${i + 1} needs a non-empty label`);
        if (m.tone !== undefined && !TEXT_TONES.has(m.tone))
            throw new Error(`concentric(): ${what} has unknown tone "${m.tone}" (${[...TEXT_TONES].join(' | ')})`);
        if (m.id !== undefined) {
            if (ids.has(m.id) || m.id === opts.id)
                throw new Error(`concentric(): duplicate id "${m.id}"`);
            ids.add(m.id);
        }
        const sector = refIndex('concentric', `${what} sector`, m.sector, sectors);
        const from = m.from === undefined ? undefined : { sector: m.from.sector === undefined ? sector : refIndex('concentric', `${what} from.sector`, m.from.sector, sectors), at: at(`${what} from`, m.from.ring, m.from.r) };
        return { label: m.label, ...(m.id ? { id: m.id } : {}), tone: m.tone ?? 'accent', sector, at: at(what, m.ring, m.r), ...(from ? { from } : {}) };
    });
    const fl = opts.fromLegend;
    if (fl !== undefined && fl !== false && !(Array.isArray(fl) && fl.length === 2 && fl.every(x => typeof x === 'string' && x.trim())))
        throw new Error("concentric(): fromLegend must be two words, [where it was, where it is] (default ['前回', '今回']), or false to leave the key out");
    return { sectors: [...sectors], marks };
}
const marksLegend = (b) => b.fromLegend === false || !b.marks?.some(m => m.from) ? undefined : b.fromLegend ?? ['前回', '今回'];
const ringLabel = (r) => r.description ? `${r.label} — ${r.description}` : r.label;
export function concentricTexts(b, roles) {
    const bold = (t) => t ? [[t, roles.note, 700]] : [];
    const plain = (t) => t ? [[t, roles.note, 400]] : [];
    const specs = b.sectors
        ? [...b.sectors.flatMap(x => bold(x.label)), ...b.rings.flatMap(r => plain(r.label || undefined)), ...(b.marks ?? []).flatMap(m => plain(m.label)), ...bold(b.centre), ...(marksLegend(b) ?? []).flatMap(plain)]
        : [...b.rings.flatMap(r => bold(ringLabel(r))), ...bold(b.centre)];
    return specs.map(([text, size, weight]) => [text, size, weight, 'sans']);
}
export function layoutConcentricShape(b, out, t, anchor, roles) {
    if (b.sectors)
        (b.layout === 'stack' ? layoutStack : layoutSectors)(b, out, t, anchor);
    else
        layoutConcentric(b, out, t, anchor, roles);
}
function layoutConcentric(b, out, t, anchor, roles) {
    const w = out.w, side = b.labels === 'side', n = b.rings.length, lh = roles.note * LINE;
    const ordered = b.order === 'outer-first' ? b.rings : b.rings.toReversed(); // outermost first
    const R = side ? Math.min(200, w * .3) : Math.min(220, w * .42), radius = (i) => R * (n - i) / n;
    const keyW = w - 2 * R - 64;
    const keys = side ? ordered.map(r => t.wrap(ringLabel(r), keyW)) : [];
    // side keys: the rings and their keys are one block, set in the middle of the width (the circle's left edge was always 16px from the band's)
    const left = side ? Math.max(out.x + 8, g4(out.x + (w - (2 * R + 48 + Math.max(...keys.map(k => k.w)))) / 2)) : out.x + 16, keyLeft = left + 2 * R + 48;
    const keyH = keys.reduce((a, k) => a + k.h + 12, 0);
    out.h = Math.max(2 * R + 16, keyH + 16);
    const cx = g4(side ? left + R : out.x + w / 2), cy = g4(out.y + out.h / 2);
    const TONES = ['accent', 'muted', 'danger', 'text'];
    ordered.forEach((ring, i) => {
        const rr = radius(i);
        out.primitives.push({ k: 'circle', cx, cy, r: rr, tone: ring.tone ?? must(TONES[i % 4]), opacity: .10 + (i % 2) * .05, ...(i % 2 ? { dash: '7,5' } : {}), ...nodeOf(ring) });
        anchor(ring.id, { x: cx - rr, y: cy - rr, w: 2 * rr, h: 2 * rr });
    });
    if (side) {
        // the key, top to bottom from the outermost ring; each entry has a leader to a dot in its ring (on the ray to the upper right)
        const slot = (out.h - 16) / n;
        ordered.forEach((ring, i) => {
            const k = must(keys[i]), top = out.y + 8 + i * slot + (slot - k.h) / 2, ly = top + Math.min(k.h, lh) / 2;
            const rm = (radius(i) + (i < n - 1 ? radius(i + 1) : 0)) / 2, a = -Math.PI / 6, dot = [g4(cx + rm * Math.cos(a)), g4(cy + rm * Math.sin(a))];
            const part = partStep('callout', ring.id ?? i, ringLabel(ring)); // ADR 0054: the leader, its dot and the key
            out.primitives.push({ k: 'path', d: `M${dot[0].toFixed(1)},${dot[1].toFixed(1)} L${(keyLeft - 8).toFixed(1)},${ly.toFixed(1)}`, tone: 'muted', thin: true, part });
            out.primitives.push({ k: 'circle', cx: dot[0], cy: dot[1], r: 3.5, tone: 'text', opacity: 1, part });
            t.place(k, keyLeft, top, ring.tone ?? 'text', 'start', part);
        });
    }
    let innerBottom = -Infinity; // the bottom of the innermost ring's label: the centre text goes below it
    if (!side) {
        // each label is centred in the top of its own band (between its ring and the next one in); the width is the ring's chord
        // at the label's top edge, so a label that wraps to more lines is re-wrapped narrower
        ordered.forEach((ring, i) => {
            const rr = radius(i), mid = (rr + (i < n - 1 ? radius(i + 1) : 0)) / 2, chord = (h) => 2 * Math.sqrt(Math.max(0, rr * rr - (mid + h / 2) ** 2)) - 12;
            let k = t.wrap(ringLabel(ring), Math.max(60, chord(lh)));
            for (let tries = 0; tries < 3 && k.w > chord(k.h) && chord(k.h) >= 60; tries++)
                k = t.wrap(ringLabel(ring), chord(k.h));
            const top = cy - mid - k.h / 2;
            t.place(k, cx, top, ring.tone ?? 'text');
            innerBottom = top + k.h;
        });
    }
    if (b.centre) {
        const c = t.wrap(b.centre, Math.max(60, 1.4 * radius(n - 1)));
        t.place(c, cx, Math.max(cy - c.h / 2, innerBottom + 4));
    }
}
// emblem: a word or two inside a circle, square, triangle, diamond, hexagon, trapezoid, parallelogram, pentagon-down, pill, rounded square, document or cylinder (outlines: emblem-shapes.ts). Each shape has a rectangle in it where text fits (a fraction of
// the shape's width D): the label is wrapped to that rectangle's width and the shape grows, in 8px steps and all to the same size, until
// every label (and its sub line) is inside its own rectangle. The text is then centred in that rectangle, so it never touches the outline.
// concentric with sectors (ADR 0065): the rings, from the centre out, cut into sectors from 12 o'clock clockwise. The sector names sit outside
// the rings, the ring names along the 12 o'clock cut. A mark is a dot with its label beside it: the dot starts at its share of its sector (the
// marks at one distance in one sector spread evenly) and the dot and label together take the nearest spot (along the dot's circle, and for a
// mark on a ring a little in or out within it) where the label crosses no line (ring, cut) and touches no other text or dot. Failing that,
// the nearest spot where it only crosses a line, which is reported (`crossings`). A mark with `from` gets a dotted ring where it was and an
// arrow to where it is now, and the key under the figure draws the two the same way.
const rectsHit = (a, b, m = 2) => a.x < b.x + b.w + m && b.x < a.x + a.w + m && a.y < b.y + b.h + m && b.y < a.y + a.h + m;
/** The eight places for a mark's label beside its dot: right, left, above, below, then the corners — `right`: the right side first. */
function labelSides(blk, px, py, right) {
    const sides = [
        { x: px + 10, top: py - blk.h / 2, anchor: 'start', box: { x: px + 10, y: py - blk.h / 2, w: blk.w, h: blk.h } },
        { x: px - 10, top: py - blk.h / 2, anchor: 'end', box: { x: px - 10 - blk.w, y: py - blk.h / 2, w: blk.w, h: blk.h } },
        { x: px, top: py - 9 - blk.h, anchor: 'middle', box: { x: px - blk.w / 2, y: py - 9 - blk.h, w: blk.w, h: blk.h } },
        { x: px, top: py + 9, anchor: 'middle', box: { x: px - blk.w / 2, y: py + 9, w: blk.w, h: blk.h } },
        { x: px + 7, top: py - 7 - blk.h, anchor: 'start', box: { x: px + 7, y: py - 7 - blk.h, w: blk.w, h: blk.h } },
        { x: px - 7, top: py - 7 - blk.h, anchor: 'end', box: { x: px - 7 - blk.w, y: py - 7 - blk.h, w: blk.w, h: blk.h } },
        { x: px + 7, top: py + 7, anchor: 'start', box: { x: px + 7, y: py + 7, w: blk.w, h: blk.h } },
        { x: px - 7, top: py + 7, anchor: 'end', box: { x: px - 7 - blk.w, y: py + 7, w: blk.w, h: blk.h } },
    ];
    // right, left, above, below, then the corners — the side away from the centre first
    return (right ? [0, 1, 2, 3, 4, 6, 5, 7] : [1, 0, 2, 3, 5, 7, 4, 6]).map(i => must(sides[i]));
}
function layoutSectors(b, out, t, anchor) {
    const sectors = b.sectors ?? [], marks = b.marks ?? [];
    const w = out.w, n = b.rings.length, k = sectors.length;
    const inner1st = b.order === 'outer-first' ? b.rings.toReversed() : b.rings; // [0] is the innermost
    const secW = Math.min(150, Math.max(80, w * .18)), secs = sectors.map(s => t.wrap(s.label, secW)), secH = Math.max(...secs.map(x => x.h));
    const R = g4(Math.max(80, Math.min(240, (w - 2 * secW - 40) / 2))), pad = secH + 20;
    // the inner rings are a little wider than the outer ones (edges at ((i + 1) / n)^0.75 of the radius: a mark near the centre has room for its
    // label); when the centre's word needs more, the innermost ring holds it (up to 45% of the radius) and the others share the rest evenly
    const centre = b.centre ? t.wrap(b.centre, R * .7, 700) : undefined, need = centre ? Math.min(R * .45, Math.hypot(centre.w, centre.h) / 2 + 8) : 0;
    const inner = n === 1 ? R : Math.max(R * (1 / n) ** .75, need), widened = inner > R * (1 / n) ** .75;
    const edge = (i) => i < 0 ? 0 : n === 1 ? R : widened ? inner + (R - inner) * i / (n - 1) : R * ((i + 1) / n) ** .75; // the outer edge of ring i
    const radius = (a) => 'r' in a ? a.r * R : (edge(a.ring - 1) + edge(a.ring)) / 2;
    const cx = g4(out.x + w / 2), cy = g4(out.y + pad + R), a0 = -Math.PI / 2, span = 2 * Math.PI / k;
    const legendWords = marksLegend(b), legendH = legendWords ? 28 : 0;
    out.h = 2 * (pad + R) + legendH;
    const at = (a, r) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const f1 = (v) => v.toFixed(1);
    // the rings, outermost first: each a faint tint, so the centre reads darkest
    for (let i = n - 1; i >= 0; i--) {
        const ring = must(inner1st[i]), part = partStep('ring', ring.id ?? i, ring.label);
        out.primitives.push({ k: 'circle', cx, cy, r: edge(i), tone: 'accent', opacity: .07, ...nodeOf(ring), part });
        anchor(ring.id, { x: cx - edge(i), y: cy - edge(i), w: 2 * edge(i), h: 2 * edge(i) }, part);
    }
    // the cuts between the sectors; with a centre word they start at the innermost ring (the word stands for the whole, and stays clear of them),
    // or, when there is only one ring, just outside the word
    const cutFrom = !centre ? 0 : n === 1 ? need : edge(0);
    const cuts = k > 1 ? Array.from({ length: k }, (_v, i) => [at(a0 + i * span, cutFrom), at(a0 + i * span, R)]) : [];
    for (const [[x1, y1], [x2, y2]] of cuts)
        out.primitives.push({ k: 'path', d: `M${f1(x1)},${f1(y1)} L${f1(x2)},${f1(y2)}`, tone: 'muted', thin: true });
    sectors.forEach((s, i) => {
        const am = k === 1 ? a0 : a0 + (i + .5) * span, c = Math.cos(am), sn = Math.sin(am), [px, py] = at(am, R + 12), blk = must(secs[i]);
        const side = c > .3 ? 'start' : c < -.3 ? 'end' : 'middle', top = sn < -.3 ? py - blk.h : sn > .3 ? py : py - blk.h / 2;
        const part = partStep('sector', s.id ?? i, s.label);
        t.place(blk, px, top, 'text', side, part);
        anchor(s.id, { x: side === 'middle' ? px - blk.w / 2 : side === 'start' ? px : px - blk.w, y: top, w: blk.w, h: blk.h }, part);
    });
    inner1st.forEach((ring, i) => {
        if (!ring.label)
            return;
        const blk = t.wrap(ring.label, Math.max(60, R * .6), 400), mid = radius({ ring: i });
        t.place(blk, cx + 6, cy - mid - blk.h / 2, ring.tone ?? 'muted', 'start', partStep('ring', ring.id ?? i, ring.label));
    });
    if (centre)
        t.place(centre, cx, cy - centre.h / 2);
    // what a mark's label must not touch: every text so far (the ring names with room to spare) and every dot; what it should not cross: the lines
    const busy = new Busy(out.labelBoxes.map(r => ({ x: r.x - 4, y: r.y - 2, w: r.w + 8, h: r.h + 4 })));
    const crossesRing = (r) => {
        const near = Math.hypot(Math.max(r.x - cx, 0, cx - r.x - r.w), Math.max(r.y - cy, 0, cy - r.y - r.h));
        const far = Math.max(...[[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]].map(([x, y]) => Math.hypot(must(x) - cx, must(y) - cy)));
        return Array.from({ length: n }, (_v, i) => edge(i)).some(e => e > near - 2 && e < far + 2);
    };
    const crossesCut = (r) => cuts.some(([p, q]) => { for (let u = 0; u <= 1; u += 1 / 64) {
        const x = p[0] + (q[0] - p[0]) * u, y = p[1] + (q[1] - p[1]) * u;
        if (x >= r.x - 2 && x <= r.x + r.w + 2 && y >= r.y - 2 && y <= r.y + r.h + 2)
            return true;
    } return false; });
    const inside = (r) => r.x >= out.x && r.x + r.w <= out.x + w && r.y >= out.y && r.y + r.h <= out.y + out.h - legendH;
    // where a mark was in another sector is a fixed spot (the middle of that sector at its distance): no dot is put there
    const wasAt = (m, a) => m.from ? at(m.from.sector === m.sector ? a : a0 + span * (m.from.sector + .5), radius(m.from.at)) : undefined;
    for (const m of marks)
        if (m.from && m.from.sector !== m.sector) {
            const [x, y] = must(wasAt(m, 0));
            busy.push({ x: x - 8, y: y - 8, w: 16, h: 16 });
        }
    const placed = placeMarks(marks, t, busy, {
        width: 130, inside, crossing: r => crossesRing(r) || crossesCut(r),
        // the nearest spot first: along the circle (both ways) from the mark's share of its sector, then a little in and out (a mark on a ring
        // within 30% of the ring's width; a mark at r, 8% of the radius: r is where it is about)
        *spots(m, j, count) {
            const lo = a0 + span * m.sector, hi = lo + span, home = radius(m.at), ideal = lo + span * (j + 1) / (count + 1);
            const band = 'ring' in m.at ? (edge(m.at.ring) - edge(m.at.ring - 1)) * .3 : R * .08;
            for (const dr of [0, band / 2, -band / 2, band, -band]) {
                const r = Math.max(0, home + dr), step = r > 0 ? Math.min(.2, 8 / r) : Math.PI;
                for (let i = 0; i < 60; i++) {
                    const a = ideal + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * step;
                    if (k > 1 && (a < lo + .03 || a > hi - .03))
                        continue;
                    const [x, y] = at(a, r), was = wasAt(m, a);
                    yield { px: g4(x), py: g4(y), right: Math.cos(a) >= 0 || r === 0, ...(was ? { was } : {}) };
                }
            }
        },
        // failing those (the label then crosses a line, and is reported): anywhere in its ring for a mark on a ring, within 20% of the radius for
        // a mark at r, every 6px out and in, the nearest first; along the whole sector
        *wider(m, j, count) {
            const lo = a0 + span * m.sector, hi = lo + span, home = radius(m.at), ideal = lo + span * (j + 1) / (count + 1);
            const [inner, outer] = 'ring' in m.at ? [edge(m.at.ring - 1) + 8, edge(m.at.ring) - 8] : [Math.max(0, home - R * .2), Math.min(R - 8, home + R * .2)];
            const drs = Array.from({ length: Math.floor(Math.max(0, outer - inner) / 6) + 1 }, (_v, i) => inner + i * 6 - home).sort((p, q) => Math.abs(p) - Math.abs(q));
            for (const dr of drs) {
                const r = Math.max(0, home + dr), step = r > 0 ? Math.min(.2, 8 / r) : Math.PI;
                for (let i = 0; i < 2 * Math.ceil(span / step) + 2; i++) {
                    const a = ideal + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * step;
                    if (k > 1 && (a < lo + .03 || a > hi - .03))
                        continue;
                    const [x, y] = at(a, r), was = wasAt(m, a);
                    yield { px: g4(x), py: g4(y), right: Math.cos(a) >= 0 || r === 0, ...(was ? { was } : {}) };
                }
            }
        },
    });
    drawMarks(placed, out, t, anchor, cx, legendWords);
}
/** What the marks keep off (ADR 0065): boxes in a grid of 32px buckets, so that a test looks only at the boxes near it (a crowded figure
 * holds thousands: every move's arrow is a box every 12px). */
class Busy {
    cells = new Map();
    constructor(rs = []) { this.push(...rs); }
    static key = (i, j) => (i + 4096) * 8192 + (j + 4096);
    push(...rs) {
        for (const r of rs)
            for (let i = Math.floor(r.x / 32); i <= Math.floor((r.x + r.w) / 32); i++)
                for (let j = Math.floor(r.y / 32); j <= Math.floor((r.y + r.h) / 32); j++) {
                    const k = Busy.key(i, j), xs = this.cells.get(k);
                    if (xs)
                        xs.push(r);
                    else
                        this.cells.set(k, [r]);
                }
    }
    /** Whether a box comes within `m` of `r` (rectsHit). */
    hits(r, m = 2) {
        for (let i = Math.floor((r.x - m) / 32); i <= Math.floor((r.x + r.w + m) / 32); i++)
            for (let j = Math.floor((r.y - m) / 32); j <= Math.floor((r.y + r.h + m) / 32); j++) {
                const xs = this.cells.get(Busy.key(i, j));
                if (xs?.some(o => rectsHit(o, r, m)))
                    return true;
            }
        return false;
    }
}
/** About the most spots a mark tries at each stage (the stack's search gets coarser to stay near it; past it, the next stage): a crowded box
 * would otherwise try every 8px of a tall, wide row, each against its move's whole arrow (ADR 0065). */
const MAX_SPOTS = 6000;
/** ADR 0065: each mark in turn takes the first spot where its dot hits nothing in `busy` and its label (beside the dot) stays inside, crosses no
 * line and touches no text, dot or its own move; failing that, on two lines; failing that, the first spot where the label only crosses a line
 * (reported); failing that, one where it also leaves its box (`outer`, reported). Its dot, label and move are then added to `busy`. A label with
 * no spot clear of the other texts and dots is an error: it would be drawn over another. */
function placeMarks(marks, t, busy, g) {
    const placed = [];
    marks.forEach((m, mi) => {
        const same = (x) => x.sector === m.sector && ('ring' in x.at ? 'ring' in m.at && x.at.ring === m.at.ring : 'r' in m.at && x.at.r === m.at.r);
        const mine = marks.filter(same), j = mine.indexOf(m);
        const wide = t.wrap(m.label, g.width, 400), narrow = t.wrap(m.label, Math.max(56, wide.w * .55), 400), blocks = narrow.lines.length > wide.lines.length && narrow.lines.length <= 3 ? [wide, narrow] : [wide];
        const last = g.outer || g.wider ? blocks.map((x) => [false, x, g.outer ?? g.inside, g.wider ?? g.spots]) : [];
        const stages = [...blocks.map((x) => [true, x, g.inside, g.spots]), ...blocks.map((x) => [false, x, g.inside, g.spots]), ...last];
        let best;
        search: for (const [strict, blk, inside, spots] of stages) {
            let tried = 0;
            for (const { px, py, right, was } of spots(m, j, mine.length)) {
                if (++tried > MAX_SPOTS)
                    break;
                const dot = { x: px - 8, y: py - 8, w: 16, h: 16 };
                if (busy.hits(dot, 0))
                    continue;
                // its own move: the label keeps off the arrow from where it was (the line between the two dots); and, while it can, the dotted ring
                // and the arrow keep off the other marks' dots and labels (a ring on another mark's dot would read as that mark's move)
                const steps = was ? Math.max(8, Math.ceil(Math.hypot(px - was[0], py - was[1]) / 8)) : 0;
                const trail = was ? Array.from({ length: steps + 1 }, (_v, q) => ({ x: was[0] + (px - was[0]) * q / steps - 5, y: was[1] + (py - was[1]) * q / steps - 5, w: 10, h: 10 })) : [];
                if (strict && was && m.from?.sector === m.sector && busy.hits({ x: was[0] - 8, y: was[1] - 8, w: 16, h: 16 }, 0))
                    continue;
                if (strict && trail.slice(1, -1).some(tr => busy.hits(tr, 0)))
                    continue;
                for (const side of labelSides(blk, px, py, right)) {
                    if (!inside(side.box) || busy.hits(side.box) || rectsHit(side.box, dot, 0) || trail.some(o => rectsHit(o, side.box, 0)))
                        continue;
                    const crossing = !g.inside(side.box) || g.crossing(side.box);
                    if (strict && crossing)
                        continue;
                    best = { px, py, side, crossing, blk, ...(was ? { was } : {}) };
                    break search;
                }
            }
        }
        if (!best)
            throw new Error(`concentric(): mark ${mi + 1} "${m.label}" has no room for its label clear of the other marks${mine.length > 1 ? ` (${mine.length} at its place in its sector)` : ' and their moves\' arrows'} — use fewer marks there, shorter labels, or spread them over other rings or sectors`);
        const spot = best;
        busy.push({ x: spot.px - 8, y: spot.py - 8, w: 16, h: 16 }, spot.side.box);
        const from = spot.was;
        // where it was, and the arrow from there, are taken too: a later dot beside the arrow would read as the one that moved
        // (one box every 12px or closer, however long the move: a long arrow across columns has no gaps for a dot)
        const steps = from ? Math.max(8, Math.ceil(Math.hypot(spot.px - from[0], spot.py - from[1]) / 12)) : 0;
        if (from)
            for (let q = 0; q <= steps; q++)
                busy.push({ x: from[0] + (spot.px - from[0]) * q / steps - 8, y: from[1] + (spot.py - from[1]) * q / steps - 8, w: 16, h: 16 });
        const room = g.wasRoom ?? 0;
        if (from && room)
            busy.push({ x: from[0] - 8 - room, y: from[1] - 8 - room, w: 16 + 2 * room, h: 16 + 2 * room });
        placed.push({ px: spot.px, py: spot.py, side: spot.side, crossing: spot.crossing, blk: spot.blk, m, mi, ...(from ? { from } : {}) });
    });
    return placed;
}
// concentric with sectors, layout: 'stack' (ADR 0065): the same rings, sectors and marks as columns of boxes — a column per sector (left to
// right), a row per ring with the innermost at the top. The centre's word heads the columns, the sector names sit under them and the ring names
// (when they have names) left of the rows. A mark on a ring sits in its row's box; a mark at r sits at that height of its ring's row (r is cut
// into rings as the circle cuts it: edges at ((i + 1) / n)^0.75). The marks are placed as on the circle (placeMarks): a label stays in its own
// box, or is reported. A mark from another column was at the middle of that column, at its height.
function layoutStack(b, out, t, anchor) {
    const sectors = b.sectors ?? [], marks = b.marks ?? [], n = b.rings.length, k = sectors.length;
    const inner1st = b.order === 'outer-first' ? b.rings.toReversed() : b.rings; // [0] is the innermost: the top row
    const ringBlks = inner1st.map(r => r.label ? t.wrap(r.label, 96, 400) : undefined), gutter = ringBlks.some(Boolean) ? Math.max(...ringBlks.map(x => x?.w ?? 0)) + 16 : 0;
    const left = g4(out.x + 8 + gutter), right = g4(out.x + out.w - 8), colW = (right - left) / k;
    // (the width the diagram gives this figure is its own less its margins: a figure alone in a diagram of the default margins has 40px less)
    if (colW < 96) {
        const need = Math.ceil(k * 96 + 16 + gutter);
        throw new Error(`concentric(): layout 'stack' with ${k} sectors needs ${need}px across and has ${Math.round(out.w)}px — ${WIDEN(b, need)}, use fewer sectors, or the circle (layout: 'circle')`);
    }
    const secs = sectors.map(s => t.wrap(s.label, colW - 12)), secH = Math.max(...secs.map(x => x.h));
    const centre = b.centre ? t.wrap(b.centre, right - left, 700) : undefined;
    const e = (i) => i < 0 ? 0 : ((i + 1) / n) ** .75; // the outer edge of ring i, as a share of the radius
    const rowOf = (a) => 'ring' in a ? a.ring : Math.max(0, Array.from({ length: n }, (_v, i) => i).find(i => a.r <= e(i) + 1e-9) ?? n - 1);
    // the rows are as tall as the fullest box needs: its marks one above another
    const need = new Map(), labelW = Math.max(56, colW - 38);
    for (const m of marks) {
        const key = `${m.sector},${rowOf(m.at)}`;
        need.set(key, (need.get(key) ?? 16) + t.wrap(m.label, labelW, 400).h + 20);
    }
    // (taller when a mark is at r: its height in the row says how far it is, and a move within a row needs room for its arrow)
    // (and as tall as a ring's name; taller when a mark is at r or was at r: its height in the row says how far, and a move within a row needs
    // room for its arrow)
    const rowH = g4(Math.max(marks.some(m => 'r' in m.at || (m.from && 'r' in m.from.at)) ? 88 : 64, ...need.values(), ...ringBlks.map(x => (x?.h ?? 0) + 16)));
    const top = g4(out.y + (centre ? centre.h + 12 : 0)), bottom = top + n * rowH, cx = g4((left + right) / 2);
    const legendWords = marksLegend(b), legendH = legendWords ? 28 : 0;
    out.h = bottom + 8 + secH + 8 + legendH - out.y;
    const f1 = (v) => v.toFixed(1), colX = (i) => left + colW * i, rowY = (i) => top + rowH * i;
    const yOf = (a) => {
        if ('ring' in a)
            return rowY(a.ring) + rowH / 2;
        const i = rowOf(a), f = (a.r - e(i - 1)) / (e(i) - e(i - 1));
        return rowY(i) + 12 + Math.min(1, Math.max(0, f)) * (rowH - 24);
    };
    out.primitives.push({ k: 'rect', x: left, y: top, w: right - left, h: bottom - top, tone: 'muted' });
    const lines = [
        ...Array.from({ length: n - 1 }, (_v, i) => [[left, rowY(i + 1)], [right, rowY(i + 1)]]),
        ...Array.from({ length: k - 1 }, (_v, i) => [[colX(i + 1), top], [colX(i + 1), bottom]]),
    ];
    for (const [[x1, y1], [x2, y2]] of lines)
        out.primitives.push({ k: 'path', d: `M${f1(x1)},${f1(y1)} L${f1(x2)},${f1(y2)}`, tone: 'muted', thin: true });
    if (centre)
        t.place(centre, cx, out.y);
    inner1st.forEach((ring, i) => {
        const part = partStep('ring', ring.id ?? i, ring.label), blk = ringBlks[i];
        anchor(ring.id, { x: left, y: rowY(i), w: right - left, h: rowH }, part);
        if (blk)
            t.place(blk, left - 8, rowY(i) + (rowH - blk.h) / 2, ring.tone ?? 'muted', 'end', part);
    });
    sectors.forEach((s, i) => {
        const part = partStep('sector', s.id ?? i, s.label);
        t.place(must(secs[i]), colX(i) + colW / 2, bottom + 8, 'text', 'middle', part);
        anchor(s.id, { x: colX(i), y: top, w: colW, h: bottom - top }, part);
    });
    const busy = new Busy(out.labelBoxes.map(r => ({ x: r.x - 4, y: r.y - 2, w: r.w + 8, h: r.h + 4 })));
    // where a mark was in another column is a fixed spot (the middle of that column at its height): no dot is put there
    const wasAt = (m, px) => m.from ? [m.from.sector === m.sector ? px : g4(colX(m.from.sector) + colW / 2), g4(yOf(m.from.at))] : undefined;
    for (const m of marks)
        if (m.from && m.from.sector !== m.sector) {
            const [x, y] = must(wasAt(m, 0));
            busy.push({ x: x - 16, y: y - 16, w: 32, h: 32 });
        }
    const placed = placeMarks(marks, t, busy, {
        width: labelW, wasRoom: 24,
        inside: r => r.x >= left + 2 && r.x + r.w <= right - 2 && r.y >= top + 2 && r.y + r.h <= bottom - 2,
        outer: r => r.x >= out.x && r.x + r.w <= out.x + out.w && r.y >= out.y && r.y + r.h <= out.y + out.h - legendH,
        crossing: r => lines.some(([p, q]) => p[0] === q[0] ? p[0] > r.x - 2 && p[0] < r.x + r.w + 2 : p[1] > r.y - 2 && p[1] < r.y + r.h + 2),
        // the dot starts at the left of its box (the marks on one ring one above another; the marks at one r side by side) and moves along the
        // row, then a little up and down (a mark on a ring within 30% of the row, a mark at r 15%: r is where it is about; then anywhere in the row)
        *spots(m, j, count) {
            const row = rowOf(m.at), lo = colX(m.sector) + 16, hi = colX(m.sector + 1) - 16, onRing = 'ring' in m.at;
            const y0 = onRing ? rowY(row) + rowH * (j + 1) / (count + 1) : yOf(m.at), x0 = onRing ? lo : lo + (hi - lo) * j / count;
            // (failing those, anywhere in its row, the nearest first: a mark on a ring says only its row; a mark at r stays in its ring, and the row
            // is as tall as all the labels of its box, so the marks at one r stand one above another rather than overlap)
            // (every 8px; in a box so tall and wide that this would be more than MAX_SPOTS, coarser: the search stays near MAX_SPOTS spots)
            // (the dots along the row: the ones beyond either end of the box are passed over, so about (hi - lo) / 8 of them)
            const step = 8 * Math.max(1, Math.ceil(Math.sqrt((5 + rowH / 8) * ((hi - lo) / 8 + 1) / MAX_SPOTS)));
            const band = rowH * (onRing ? .3 : .15), sweep = Array.from({ length: Math.floor(rowH / step) }, (_v, i) => rowY(row) + 8 + i * step - y0).sort((p, q) => Math.abs(p) - Math.abs(q));
            for (const dy of [0, band / 2, -band / 2, band, -band, ...sweep]) {
                const py = g4(Math.min(rowY(row + 1) - 8, Math.max(rowY(row) + 8, y0 + dy)));
                for (let i = 0; i <= 2 * Math.ceil((hi - lo) / step) + 1; i++) {
                    const px = g4(x0 + (i % 2 ? -1 : 1) * Math.ceil(i / 2) * step);
                    if (px < lo || px > hi)
                        continue;
                    const was = wasAt(m, px);
                    yield { px, py, right: px - colX(m.sector) < colW * .6, ...(was ? { was } : {}) };
                }
            }
        },
    });
    drawMarks(placed, out, t, anchor, cx, legendWords);
}
/** The marks (ADR 0065), drawn the same in both layouts: where it was (a dotted ring) and the arrow from there, the dot and its label; then the key under the figure. */
function drawMarks(placed, out, t, anchor, cx, legendWords) {
    const f1 = (v) => v.toFixed(1);
    const moved = (fx, fy, px, py, part) => {
        out.primitives.push({ k: 'circle', cx: fx, cy: fy, r: 5, tone: 'muted', opacity: .15, dash: '2,2', part });
        const d = Math.hypot(px - fx, py - fy);
        if (d > 20) {
            const ux = (px - fx) / d, uy = (py - fy) / d;
            out.primitives.push({ k: 'path', d: `M${f1(fx + ux * 7)},${f1(fy + uy * 7)} L${f1(px - ux * 9)},${f1(py - uy * 9)}`, tone: 'muted', arrow: true, part });
        }
    };
    for (const p of placed)
        if (p.from)
            moved(p.from[0], p.from[1], p.px, p.py, partStep('mark', p.m.id ?? p.mi, p.m.label));
    for (const p of placed) {
        const part = partStep('mark', p.m.id ?? p.mi, p.m.label);
        out.primitives.push({ k: 'circle', cx: p.px, cy: p.py, r: 6, tone: p.m.tone, opacity: 1, ...nodeOf(p.m), part });
        anchor(p.m.id, { x: p.px - 6, y: p.py - 6, w: 12, h: 12 }, part);
        t.place(p.blk, p.side.x, p.side.top, p.m.tone === 'muted' ? 'muted' : 'text', p.side.anchor, part);
        if (p.crossing)
            (out.crossings ??= []).push(p.m.label);
    }
    // the key, drawn as the figure draws it: the dotted ring and its word, an arrow, the dot and its word
    if (legendWords) {
        const [was, now] = legendWords, part = partStep('legend', 0, `${was} ${now}`), y = g4(out.y + out.h - 12), top = y - t.lineH() / 2;
        const ww = t.width(was, 400), nw = t.width(now, 400), total = 10 + 6 + ww + 10 + 28 + 10 + 12 + 6 + nw;
        let x = cx - total / 2;
        out.primitives.push({ k: 'circle', cx: x + 5, cy: y, r: 5, tone: 'muted', opacity: .15, dash: '2,2', part });
        t.place(t.wrap(was, ww + 4, 400), x + 16, top, 'muted', 'start', part);
        x += 16 + ww + 10;
        out.primitives.push({ k: 'path', d: `M${f1(x)},${y} L${f1(x + 28)},${y}`, tone: 'muted', arrow: true, part });
        x += 28 + 10;
        out.primitives.push({ k: 'circle', cx: x + 6, cy: y, r: 6, tone: 'accent', opacity: 1, part });
        t.place(t.wrap(now, nw + 4, 400), x + 18, top, 'muted', 'start', part);
    }
}
