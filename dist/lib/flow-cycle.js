import { partStep } from './parts.js';
import { assertScope } from './scope-name.js';
import { isSolidTone } from './tokens.js';
import { katakanaWidth } from './tree.js';
import { must } from './must.js';
import { BOX_TONES, common, focusItems, onItem, checkTones, WIDEN, refIndex, nodeOf, g4 } from './flow-layout-core.js';
export function cycleBand(steps, opts = {}) {
    if (steps.length < 3 || steps.length > 8)
        throw new Error(`cycle(): needs 3..8 steps (got ${steps.length})`);
    common('cycle', steps, opts.id);
    assertScope(opts.scope, 'cycle()');
    checkTones('cycle', steps, BOX_TONES);
    if (opts.frame !== undefined && !opts.frame.trim())
        throw new Error('cycle(): frame must be a non-empty name (leave it out for no frame)');
    const { focus, links: given, ...rest } = opts;
    return { ...rest, type: 'cycle', steps: focusItems('cycle', steps, focus), direction: opts.direction ?? 'cw', ...(given === undefined ? {} : { links: cycleLinks(steps, given, opts.direction) }) };
}
/** ADR 0065: the links of a cycle drawn as a polygon, as 0-based steps. */
function cycleLinks(steps, given, direction) {
    if (direction !== undefined)
        throw new Error("cycle(): direction turns the arrows round the ring; with links each link says its own (direction: 'forward' on the link)");
    if (given !== 'all' && !Array.isArray(given))
        throw new Error(`cycle(): links must be 'all' or a list of {from, to} (got ${JSON.stringify(given)})`);
    if (given === 'all' && steps.length > 6)
        throw new Error(`cycle(): links: 'all' joins every pair of up to 6 steps (got ${steps.length}: ${steps.length * (steps.length - 1) / 2} links) — list the links instead`);
    const links = given === 'all'
        ? steps.flatMap((_a, i) => steps.slice(i + 1).map((_b, k) => ({ from: i, to: i + 1 + k, both: true })))
        : given.map((l, i) => {
            const from = refIndex('cycle', `link ${i + 1} from`, l.from, steps), to = refIndex('cycle', `link ${i + 1} to`, l.to, steps);
            if (from === to)
                throw new Error(`cycle(): link ${i + 1} joins "${must(steps[from]).label}" to itself`);
            if (l.direction !== undefined && l.direction !== 'both' && l.direction !== 'forward')
                throw new Error(`cycle(): link ${i + 1} direction must be 'both' or 'forward' (got ${JSON.stringify(l.direction)})`);
            return { from, to, ...(l.label ? { label: l.label } : {}), both: l.direction !== 'forward' };
        });
    if (!links.length)
        throw new Error("cycle(): links is empty — leave it out for the arrows round the ring, or write 'all'");
    const pairs = new Set();
    for (const l of links) {
        const k = `${Math.min(l.from, l.to)},${Math.max(l.from, l.to)}`;
        if (pairs.has(k))
            throw new Error(`cycle(): two links join "${must(steps[l.from]).label}" and "${must(steps[l.to]).label}" — keep one (it is two-way unless direction: 'forward')`);
        pairs.add(k);
    }
    return links;
}
export function cycleTexts(b, roles) {
    const bold = (t) => t ? [[t, roles.note, 700]] : [];
    const plain = (t) => t ? [[t, roles.note, 400]] : [];
    const specs = [...b.steps.flatMap(s => [...bold(s.label), ...plain(s.sub)]), ...(b.centre ? [[b.centre, roles.label, 700]] : []), ...(b.links ?? []).flatMap(l => plain(l.label)), ...bold(b.frame)];
    return specs.map(([text, size, weight]) => [text, size, weight, 'sans']);
}
export function layoutCycleShape(b, out, t, anchor, roles) {
    framed(b.frame, out, t, () => b.links ? layoutLinked(b, out, t, anchor, roles) : layoutCycle(b, out, t, anchor, roles));
}
function layoutCycle(b, out, t, anchor, roles) {
    const w = out.w, n = b.steps.length, h0 = Math.min(520, Math.max(300, w * .62));
    const sinN = Math.sin(Math.PI / n), ARROW_ROOM = 20; // the gap between adjacent circles is at least 2 * ARROW_ROOM, with room left for the arrow
    let R = Math.min(w, h0) * .34;
    let nr = Math.max(28, Math.min(54, R * .38, R * sinN - 14));
    // A katakana word wider than the label area (1.5 nr) would be cut mid-word: grow the circles for it, and the ring (and the height) with them,
    // as far as the width and a 760px height allow. Cycles whose words already fit are drawn exactly as before.
    const word = Math.max(0, ...b.steps.map(s => Math.max(katakanaWidth(s.label, t.widthOf, roles.note, 700), s.sub ? katakanaWidth(s.sub, t.widthOf, roles.note, 400) : 0)));
    if (word > nr * 1.5) {
        const want = Math.ceil(word / 1.5);
        const rMax = Math.min(w / 2 - 4 - want, (760 - 16) / 2 - want); // the ring plus a circle stays inside the width and the height cap
        const rNeed = Math.max(R, 2 * want, (want + ARROW_ROOM) / sinN);
        if (rMax > R) {
            R = Math.min(rNeed, rMax);
            nr = Math.max(nr, Math.min(want, R * .5, R * sinN - ARROW_ROOM));
        }
    }
    const h = Math.max(h0, 2 * (R + nr) + 16);
    out.h = h;
    const cx = out.x + w / 2, cy = out.y + h / 2;
    const sign = b.direction === 'cw' ? 1 : -1, angle = (i) => -Math.PI / 2 + sign * 2 * Math.PI * i / n;
    const at = (a, r = R) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    const skip = 2 * Math.asin(Math.min(1, (nr + 8) / (2 * R))); // the angle a node (plus a gap) covers on the ring
    const r1 = (v) => Math.round(v * 10) / 10;
    // ADR 0054: a step is its circle, its label and the arrow that leaves it
    const stepPart = (i) => partStep('step', b.steps[i]?.id ?? i, b.steps[i]?.label ?? '');
    b.steps.forEach((_s, i) => {
        const [p, q] = [at(angle(i) + sign * skip), at(angle(i + 1) - sign * skip)];
        out.primitives.push({ k: 'path', d: `M${r1(p[0])},${r1(p[1])} A${r1(R)},${r1(R)} 0 0 ${sign > 0 ? 1 : 0} ${r1(q[0])},${r1(q[1])}`, tone: 'text', arrow: true, part: stepPart(i) });
    });
    b.steps.forEach((s, i) => {
        const [ax, ay] = at(angle(i)), nx = g4(ax), ny = g4(ay);
        const tone = s.tone === 'danger' || s.tone === 'removed' ? 'danger' : s.tone === 'muted' ? 'muted' : 'accent';
        // a solid step is a filled circle (white text); the others keep the tinted ring
        out.primitives.push({ k: 'circle', cx: nx, cy: ny, r: nr, tone, ...(isSolidTone(s.tone) ? { fill: s.tone } : {}), ...nodeOf(s), part: stepPart(i) });
        anchor(s.id, { x: nx - nr, y: ny - nr, w: 2 * nr, h: 2 * nr }, stepPart(i));
        const label = t.wrap(s.label, nr * 1.5), sub = s.sub ? t.wrap(s.sub, nr * 1.5, 400) : undefined, top = ny - (label.h + (sub?.h ?? 0)) / 2;
        t.place(label, nx, top, onItem(s.tone, 'text'), 'middle', stepPart(i));
        if (sub)
            t.place(sub, nx, top + label.h, onItem(s.tone, 'muted'), 'middle', stepPart(i));
    });
    if (b.centre) {
        const c = t.wrap(b.centre, 1.5 * (R - nr), 700, roles.label);
        t.place(c, cx, cy - c.h / 2);
    }
}
// cycle with links (ADR 0065): the steps on a regular polygon (an even count with a flat top, an odd one with a point up; four make a square);
// every link a straight line between the circles, two-way as two arrows that meet in the middle. The centre's word sits on a disc of its own,
// over the links that cross the middle. A link's label goes beside the link where it touches no other link, circle or label.
function layoutLinked(b, out, t, anchor, roles) {
    const w = out.w, n = b.steps.length, links = b.links ?? [];
    // the least circle (from 48px, in 4px steps) where every label and sub line is one line; failing that by 76px, the least where they fit wrapped
    // (two lines in a circle have its chord at their edge, about 1.75 r wide; more lines get 1.5 r)
    const blocksAt = (r, f) => b.steps.map(x => ({ label: t.wrap(x.label, r * f), ...(x.sub ? { sub: t.wrap(x.sub, r * f, 400) } : {}) }));
    const fits = (k, r, f) => Math.max(k.label.w, k.sub?.w ?? 0) <= r * f + .5 && k.label.h + (k.sub?.h ?? 0) <= r * 1.4;
    const oneLine = (k) => k.label.lines.length === 1 && (k.sub?.lines.length ?? 1) === 1;
    let nr = 48, blocks = blocksAt(nr, 1.75);
    while (nr < 76 && !blocks.every(k => fits(k, nr, 1.75) && oneLine(k)))
        blocks = blocksAt(nr += 4, 1.75);
    if (!blocks.every(k => fits(k, nr, 1.75) && oneLine(k)))
        for (nr = 48, blocks = blocksAt(nr, 1.5); nr < 84 && !blocks.every(k => fits(k, nr, 1.5));)
            blocks = blocksAt(nr += 4, 1.5);
    const centre = b.centre ? t.wrap(b.centre, 140, 700, roles.label) : undefined, centreR = centre ? Math.max(centre.w, centre.h) / 2 + 14 : 0;
    const sinN = Math.sin(Math.PI / n), labelled = links.some(l => l.label) ? 40 : 0;
    const R = Math.max((nr + 44 + labelled / 2) / sinN, n >= 5 ? (nr + 16) / (1 - Math.cos(2 * Math.PI / n)) : 0, centre ? nr + centreR + 40 : 0, 110);
    // a regular polygon: never squeezed (circles would overlap) — a band too narrow for it is an error
    if (w / 2 < R + nr + 12) {
        const need = Math.ceil(2 * (R + nr + 12));
        throw new Error(`cycle(): with links, ${n} steps need ${need}px across and have ${Math.round(w)}px — ${WIDEN(b, need)}, shorten the labels, or use fewer steps`);
    }
    const Rx = R, Ry = R;
    const a0 = n % 2 ? -Math.PI / 2 : -Math.PI / 2 - Math.PI / n, ang = (i) => a0 + 2 * Math.PI * i / n;
    const sins = b.steps.map((_x, i) => Math.sin(ang(i))), up = -Math.min(...sins) * Ry + nr, down = Math.max(...sins) * Ry + nr;
    const cx = g4(out.x + w / 2), cy = g4(out.y + 8 + up);
    out.h = cy + down + 8 - out.y;
    const pos = b.steps.map((_x, i) => [g4(cx + Rx * Math.cos(ang(i))), g4(cy + Ry * Math.sin(ang(i)))]);
    const stepPart = (i) => partStep('step', b.steps[i]?.id ?? i, b.steps[i]?.label ?? '');
    const f1 = (v) => v.toFixed(1), mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const toward = (p, q, d) => { const L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1; return [p[0] + (q[0] - p[0]) / L * d, p[1] + (q[1] - p[1]) / L * d]; };
    const segs = links.map(l => { const p = must(pos[l.from]), q = must(pos[l.to]); return { p, q, s: toward(p, q, nr + 6), e: toward(q, p, nr + 6) }; });
    links.forEach((l, li) => {
        const { s: st, e } = must(segs[li]), m = mid(st, e), part = partStep('link', li, l.label ?? '');
        // two-way: two arrows that leave the middle (a link through the centre's word meets under its disc)
        if (l.both)
            for (const end of [e, st])
                out.primitives.push({ k: 'path', d: `M${f1(m[0])},${f1(m[1])} L${f1(end[0])},${f1(end[1])}`, tone: 'text', arrow: true, part });
        else
            out.primitives.push({ k: 'path', d: `M${f1(st[0])},${f1(st[1])} L${f1(e[0])},${f1(e[1])}`, tone: 'text', arrow: true, part });
    });
    // the labels: beside their link, at its middle or further along, on either side; the first spot clear of every other link, every circle,
    // the centre's disc and the labels placed so far (else the middle, away from the centre)
    const taken = [];
    const clear = (r, li) => !taken.some(o => r.x < o.x + o.w + 2 && o.x < r.x + r.w + 2 && r.y < o.y + o.h + 2 && o.y < r.y + r.h + 2)
        && !pos.some(c => Math.hypot(Math.max(r.x - c[0], 0, c[0] - r.x - r.w), Math.max(r.y - c[1], 0, c[1] - r.y - r.h)) < nr + 2)
        && !(centre && Math.hypot(Math.max(r.x - cx, 0, cx - r.x - r.w), Math.max(r.y - cy, 0, cy - r.y - r.h)) < centreR + 2)
        && !segs.some((g, gi) => gi !== li && Array.from({ length: 33 }, (_v, u) => [g.s[0] + (g.e[0] - g.s[0]) * u / 32, g.s[1] + (g.e[1] - g.s[1]) * u / 32]).some(([x, y]) => must(x) > r.x - 2 && must(x) < r.x + r.w + 2 && must(y) > r.y - 2 && must(y) < r.y + r.h + 2));
    links.forEach((l, li) => {
        if (!l.label)
            return;
        const { p, q, s: st, e } = must(segs[li]), L = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, nx = -(q[1] - p[1]) / L, ny = (q[0] - p[0]) / L;
        const blk = t.wrap(l.label, 120, 400), d = Math.abs(nx) * blk.w / 2 + Math.abs(ny) * blk.h / 2 + 6;
        const cands = [];
        for (const u of [.5, .35, .65, .25, .75]) {
            const lp = [st[0] + (e[0] - st[0]) * u, st[1] + (e[1] - st[1]) * u], away = (lp[0] - cx) * nx + (lp[1] - cy) * ny >= 0 ? 1 : -1;
            for (const side of [away, -away])
                cands.push({ x: lp[0] + nx * side * d, y: lp[1] + ny * side * d - blk.h / 2 });
        }
        const boxOf = (c) => ({ x: c.x - blk.w / 2, y: c.y, w: blk.w, h: blk.h });
        const c = cands.find(x => clear(boxOf(x), li)) ?? must(cands[0]);
        taken.push(boxOf(c));
        t.place(blk, c.x, c.y, 'muted', 'middle', partStep('link', li, l.label));
    });
    b.steps.forEach((x, i) => {
        const [px, py] = must(pos[i]), k = must(blocks[i]), part = stepPart(i);
        const tone = x.tone === 'danger' || x.tone === 'removed' ? 'danger' : x.tone === 'muted' ? 'muted' : 'accent';
        out.primitives.push({ k: 'circle', cx: px, cy: py, r: nr, tone, ...(isSolidTone(x.tone) ? { fill: x.tone } : {}), ...nodeOf(x), part });
        anchor(x.id, { x: px - nr, y: py - nr, w: 2 * nr, h: 2 * nr }, part);
        const top = py - (k.label.h + (k.sub?.h ?? 0)) / 2;
        t.place(k.label, px, top, onItem(x.tone, 'text'), 'middle', part);
        if (k.sub)
            t.place(k.sub, px, top + k.label.h, onItem(x.tone, 'muted'), 'middle', part);
    });
    if (centre) {
        out.primitives.push({ k: 'circle', cx, cy, r: g4(centreR), tone: 'text', fill: 'plain' });
        t.place(centre, cx, cy - centre.h / 2);
    }
}
/** ADR 0065: a named frame round a figure, as wide as what it holds (and its name): the figure is laid out under the name, then framed. */
function framed(name, out, t, lay) {
    if (!name) {
        lay();
        return;
    }
    const blk = t.wrap(name, out.w - 40), top = out.y, head = blk.h + 20;
    out.y = top + head;
    lay();
    out.y = top;
    out.h += head + 16;
    // the extent of what was drawn (texts and shapes), padded; never narrower than the name
    const xs = [...out.texts.map(x => [x.x, x.x + x.w]), ...out.primitives.flatMap(p => p.k === 'circle' ? [[p.cx - p.r, p.cx + p.r]] : p.k === 'polygon' ? [[Math.min(...p.points.map(q => q[0])), Math.max(...p.points.map(q => q[0]))]] : [])].flat();
    const mid = out.x + out.w / 2, half = Math.min(out.w / 2 - 4, Math.max(Math.max(...xs.map(x => Math.abs(x - mid))) + 32, blk.w / 2 + 24));
    const fx = g4(mid - half), fy = g4(top + 4);
    out.primitives.push({ k: 'rect', x: fx, y: fy, w: g4(mid + half) - fx, h: g4(top + out.h - 4) - fy, tone: 'muted' });
    t.place(blk, fx + 16, top + 12, 'muted', 'start', partStep('frame', 0, name));
}
