// Per-band-type reveal resolution (prepareReveal's walk): what a band type adds to the click-stage bookkeeping beyond its own
// reveal / until: its children, row slot ids, a plane's elements, an image's marks, a bars value's `replaces`.
// One entry per band type, each checked against its own band type; a band type without one fails to compile
// (UnrevealedBandTypes), and test/reveal-handlers.test.ts checks the table at run time.
import { childrenOf } from './band-children.js';
import { must } from './must.js';
export function checked(value, where) {
    if (value === undefined)
        return undefined;
    if (!Number.isInteger(value) || value < 1)
        throw new Error(`${where}: reveal must be a whole number >= 1 (got ${value})`);
    return value;
}
// `until`: the click an element vanishes at (a group's until takes its children with it). It must come after the reveal it ends up with.
export const earlier = (a, b) => a === undefined ? b : b === undefined ? a : Math.min(a, b);
const plain = { stage: true };
/** A band whose nested bands (childrenOf) inherit its stage and until. */
const nested = { stage: true, visit: (b, n, u, ctx) => ctx.walk(childrenOf(b), n, u) };
const unrevealed = { stage: false };
// plane(): each point / line / dim / label / path takes max(the plane's, its own) — and a line / dim / path the later of the
// points it names (a coordinate counts 0), like a connect(). An explicit reveal earlier than those ends warns.
function revealPlane(p, n, _u, ctx) {
    const own = (x, where) => checked(x.reveal, where);
    const lvl = new Map();
    for (const [i, pt] of (p.points ?? []).entries()) {
        const r = Math.max(n, own(pt, `plane() point ${i + 1}`) ?? 0);
        if (r)
            pt.reveal = r;
        if (pt.id)
            lvl.set(pt.id, r); // a plane's points are its own: the lines and dims of the same plane name them
        ctx.max = Math.max(ctx.max, r);
    }
    const ends = (refs) => Math.max(0, ...refs.map(r => typeof r === 'string' ? lvl.get(r) ?? 0 : 0));
    const derived = (x, refs, where, what) => {
        const explicit = own(x, where), e = ends(refs);
        if (explicit !== undefined && explicit < e)
            ctx.warnings.push(`${what} reveal ${explicit} is earlier than an endpoint (reveal ${e})`);
        const r = Math.max(n, explicit ?? e);
        if (r)
            x.reveal = r;
        ctx.max = Math.max(ctx.max, r);
    };
    for (const [i, l] of (p.lines ?? []).entries())
        derived(l, [l.from, l.to], `plane() line ${i + 1}`, `plane() line ${i + 1} (${l.from} -> ${l.to})`);
    for (const [i, pa] of (p.paths ?? []).entries()) {
        if (!pa.grow) {
            derived(pa, pa.through, `plane() path ${i + 1}`, `plane() path ${i + 1}`);
            continue;
        }
        // a growing path: piece k appears with the later of the points it runs between (and everything before it, so the curve only grows)
        const lv = pa.through.map(r => typeof r === 'string' ? lvl.get(r) ?? 0 : 0);
        const explicit = own(pa, `plane() path ${i + 1}`) ?? 0;
        let run = Math.max(n, explicit, lv[0] ?? 0);
        pa.segReveal = pa.through.slice(1).map((_r, k) => (run = Math.max(run, lv[k + 1] ?? 0)));
        if (pa.segReveal[0])
            pa.reveal = pa.segReveal[0];
        else
            delete pa.reveal;
        ctx.max = Math.max(ctx.max, ...pa.segReveal);
    }
    for (const [i, d] of (p.dims ?? []).entries())
        derived(d, [d.from, d.to], `plane() dim ${i + 1}`, `plane() dim "${d.label}"`);
    for (const [i, l] of (p.labels ?? []).entries())
        derived(l, [], `plane() label ${i + 1}`, `plane() label "${l.text}"`);
}
// row / grouprow: the children are cells (set, not walked), a group in a grouprow is walked, and `row#k` ids name the slots.
function revealRow(b, n, u, ctx) {
    const childLevels = b.children.map((c, i) => ctx.set(c, n, `row() child ${i + 1}`, u));
    b.children.forEach((c, i) => { if ('children' in c)
        ctx.walk(c.children, childLevels[i], c.until); }); // a group in a grouprow
    if (!b.id)
        return;
    // row#k: the stage its cell appears at and the stage it vanishes at (the latest of its children; none if any child stays)
    const slotUntil = new Map(), stays = new Set();
    const cell = (key, r, until) => {
        ctx.ids.set(key, Math.max(ctx.ids.get(key) ?? 0, r));
        if (until === undefined)
            stays.add(key);
        else
            slotUntil.set(key, Math.max(slotUntil.get(key) ?? 0, until));
    };
    if (b.cols) {
        let next = 1;
        b.children.forEach((c, i) => {
            const span = c.span ?? 1, col = c.col ?? next;
            for (let a = col; a < col + span; a++)
                cell(`${b.id}#${a}`, must(childLevels[i]), c.until);
            next = col + span;
        });
    }
    else
        b.children.forEach((c, i) => cell(`${b.id}#${i + 1}`, must(childLevels[i]), c.until));
    for (const [key, un] of slotUntil)
        if (!stays.has(key))
            ctx.untils.set(key, un);
}
function revealImage(b, n, u, ctx) {
    for (const [i, m] of (b.marks ?? []).entries()) {
        const r = ctx.set(m, n, `image() mark ${i + 1}`, u);
        if (m.id)
            ctx.ids.set(ctx.name(m.id), r);
    }
    for (const [i, l] of (b.labels ?? []).entries())
        ctx.set(l, n, `image() label ${i + 1}`, u);
    ctx.walk(childrenOf(b), n, u);
}
// bars: each value is an element; `replaces` ends an earlier bar at the very click its replacement comes.
function revealBars(b, n, u, ctx) {
    for (const [i, bar] of b.data.entries()) {
        ctx.ownUntils.set(bar, bar.until); // the bar's own, before set() merges in the band's
        if (bar.replaces !== undefined) {
            if (b.stack)
                throw new Error(`bars() value ${i + 1}: replaces does not work with stack (the segments share one bar)`);
            const old = b.data.slice(0, i).find(d => d.id === bar.replaces);
            if (!old)
                throw new Error(`bars() value ${i + 1}: replaces "${bar.replaces}" must name the id of an earlier bar of the same band`);
            if (bar.reveal === undefined)
                throw new Error(`bars() value ${i + 1}: a bar that replaces another needs a reveal (the click it takes the place at)`);
            if (ctx.replaced.has(ctx.name(bar.replaces)))
                throw new Error(`bars() value ${i + 1}: "${bar.replaces}" is already replaced by another bar`);
            ctx.replaced.add(ctx.name(bar.replaces));
            const oldOwn = ctx.ownUntils.get(old);
            if (oldOwn !== undefined && oldOwn !== bar.reveal)
                throw new Error(`bars() value ${i + 1}: replaces "${bar.replaces}", which already vanishes at ${oldOwn}, not at this bar's reveal ${bar.reveal}`);
            if (bar.reveal <= (old.reveal ?? 0))
                throw new Error(`bars() value ${i + 1}: replaces "${bar.replaces}" but is revealed (${bar.reveal}) no later than it (${old.reveal ?? 0})`);
            if (old.id)
                ctx.untils.set(ctx.name(old.id), bar.reveal);
            old.until = bar.reveal; // the replaced bar goes at the very click its replacement comes
        }
        const r = ctx.set(bar, n, `bars() value ${i + 1}`, u);
        if (bar.id)
            ctx.ids.set(ctx.name(bar.id), r);
    }
}
const setEach = (what, items) => ({
    stage: true,
    visit: (b, n, u, ctx) => items(b).forEach((c, i) => ctx.set(c, n, `${what} ${i + 1}`, u)),
});
/**
 * The handler of every band type. Typed per key (the `satisfies` below), so each is checked against its own band type;
 * UnrevealedBandTypes makes a band type without one a compile error.
 */
export const REVEAL_HANDLERS = {
    spacer: unrevealed,
    status: unrevealed,
    group: nested,
    sequence: plain,
    table: plain,
    image: { stage: true, visit: revealImage },
    timeline: plain,
    bpmn: plain,
    fta: plain,
    bowtie: plain,
    classes: plain,
    gantt: plain,
    cause: plain,
    cloud: plain,
    states: plain,
    tree: plain,
    bars: { stage: true, visit: revealBars },
    chart: plain,
    people: plain,
    dots: plain,
    math: plain,
    wireframe: plain,
    screens: plain,
    swimlane: setEach('swimlane() step', (b) => b.steps),
    legend: unrevealed,
    // a connect() is resolved last, from the stages of its ends (see prepareReveal)
    connect: {
        stage: false,
        visit: (b, ctx) => { checked(b.reveal, 'connect()'); checked(b.until, 'connect() (until)'); ctx.connects.push(b); },
    },
    raw: plain,
    grouprow: { stage: true, visit: revealRow },
    row: { stage: true, visit: revealRow },
    // grid() takes box() children only (its constructor rejects a group), and a box holds no bands: nothing nested to walk, so each
    // cell is just set (test/grid-reveal-nested.test.ts pins this)
    grid: setEach('grid() child', (b) => b.children),
    pyramid: plain,
    plane: { stage: true, visit: revealPlane },
    quadrant: plain,
    chevron: plain,
    wordart: plain,
    funnel: plain,
    cycle: plain,
    venn: plain,
    concentric: plain,
    emblem: plain,
    curve: plain,
    caption: plain,
    box: plain,
    banner: plain,
};
export const ALL_BANDS_REVEALED = true;
export function revealHandlerFor(band) {
    return REVEAL_HANDLERS[band.type];
}
