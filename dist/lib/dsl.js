// Public API: a vertical stack of bands (caption, box, banner, spacer, raw,
// row, grid, connect, pyramid, curve). bar() is the one primitive still
// deferred — nothing in this deck has needed it since row()/grid() covered
// the rest of the pattern catalog.
//
// Deliberately absent from every function signature: x, y, fill, stroke,
// font-family, and (on the normal path) font-size/height. That absence IS
// the constraint system — a caller cannot express an off-token color or a
// sub-14px font because there is no parameter that accepts one.
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { layoutDiagram } from './layout.js';
import { emitSvg } from './emit.js';
import { verifyDiagram } from './verify.js';
import { applyAutoLegend } from './rules.js';
import { analyzeFit } from './fit.js';
import { getSlideBudget } from './slide-budget.js';
import { closeMeasurer } from './measure.js';
import { MIN_FONT_SIZE, ROLES, THEMES } from './tokens.js';
export { wf } from './wireframe.js';
export function diagram(opts = {}) {
    // `theme` (name from tokens.ts PALETTE) is the general form; `day` (1|2) is the
    // training deck's legacy spelling of the same thing. Stored as d.day internally.
    const theme = opts.theme ?? opts.day;
    if (!THEMES.map(String).includes(String(theme)))
        throw new Error(`diagram({theme}) must be one of ${THEMES.join(', ')} (or legacy day: 1|2)`);
    const d = {
        day: theme,
        // 'slide' (legacy day: 1|2 diagrams) gets slide-fit warnings; 'doc' (theme: ...) does not.
        medium: (opts.medium ?? (opts.theme === undefined ? 'slide' : 'doc')),
        title: opts.title, desc: opts.desc, // exposed as the SVG's <title> / <desc> (doc medium)
        accept: opts.accept, // {'rule-id': 'why this finding is fine'} — shown as info instead of a warning
        legend: opts.legend, legendLabels: opts.legendLabels, // legend: 'auto' adds entries for every notation used but not listed
        width: opts.width ?? 940,
        pad: opts.pad ?? 20,
        gap: opts.gap ?? 16,
        maxDisplayHeight: opts.maxDisplayHeight, // slide room for the <img> (see fit.ts)
        minEffectiveFont: opts.minEffectiveFont,
        slide: opts.slide, // {page, heading}: measure the real budget from this slide (slide-budget.ts)
        fill: !!opts.fill, // fit-figure slide: build to the measured width/height, growing fonts to use the slack (see build())
        bands: [],
    };
    return {
        ...d,
        add(...bands) { d.bands.push(...bands.flat()); return this; },
        get bands() { return d.bands; },
    };
}
// `const list = box({id: 'list'})`: a band built with an id also works as a handle (`list.right`, `list.at('top', 0.25)`),
// so connect() can name it without typing the id again. The helpers are NON-enumerable properties: spreading or
// serialising a band, and every existing consumer of bands, sees exactly what it saw before.
function handleFor(id) {
    const side = (s) => `${id}:${s}`;
    return {
        left: { value: side('left') }, right: { value: side('right') }, top: { value: side('top') }, bottom: { value: side('bottom') }, center: { value: side('center') },
        at: { value: (s, t) => `${id}:${s}@${t}` },
    };
}
function withHandle(band, id) {
    if (id)
        Object.defineProperties(band, handleFor(id));
    return band;
}
// screens() / swimlane(): `.anchors.<id>` is the handle of each item / step that has an id.
function withAnchors(band, ids) {
    const anchors = {};
    for (const id of ids)
        if (id)
            anchors[id] = Object.defineProperties({ id }, handleFor(id));
    return Object.defineProperty(band, 'anchors', { value: anchors });
}
export function caption(text, opts = {}) {
    return { type: 'caption', text, align: opts.align ?? 'center', role: opts.role ?? 'label', tone: opts.tone ?? 'muted', bold: !!opts.bold, mono: !!opts.mono };
}
export function box(opts) {
    if (opts.size !== undefined)
        assertFontSize(opts.size);
    if (opts.step != null && !opts.title)
        throw new Error('box({step}) needs a title — the badge aligns to the title\'s first line');
    return withHandle({ type: 'box', ...opts }, opts.id);
}
export function banner(opts) {
    return withHandle({ type: 'banner', tone: opts.tone ?? 'accent', ...opts }, opts.id);
}
export function group(children, opts = {}) {
    return withHandle({ type: 'group', children: [children].flat(), title: opts.title, titleTone: opts.titleTone, titleAlign: opts.titleAlign, tone: opts.tone ?? 'muted', dashed: opts.dashed ?? (opts.tone === 'plain' ? true : undefined), pad: opts.pad, id: opts.id, flex: opts.flex, width: opts.width, span: opts.span, col: opts.col }, opts.id);
}
// Key for line styles / tones used in the diagram. items:
//   {line: 'solid'|'dashed'|'dotted'|'double', arrow?: 'end'|'both'|'none', label}
//   {tone: 'accent'|'muted'|'plain'|'danger'|'new'|'changed'|'removed', label}
export function legend(items, opts = {}) {
    return { type: 'legend', items, align: opts.align ?? 'center' };
}
export function sequence(actors, steps, opts = {}) {
    return withHandle({ type: 'sequence', actors, steps, numbered: opts.numbered, id: opts.id }, opts.id);
}
export function table(columns, rows, opts = {}) {
    return withHandle({ type: 'table', columns, rows: rows, title: opts.title, header: opts.header, width: opts.width, tone: opts.tone, id: opts.id }, opts.id);
}
// A table cell whose tone stays a literal when the cell is built apart from the table() call
// (`const c = {text: '通る', tone: 'accent'}` widens tone to string; `cell('通る', {tone: 'accent'})` does not).
export function cell(text, opts = {}) {
    return { text: String(text), ...opts };
}
export function swimlane(lanes, steps, opts = {}) {
    const laneIdx = new Map(lanes.map((l, i) => [l.id, i]));
    let next = 1, cols = 0;
    const placed = steps.map(st => {
        if (!laneIdx.has(st.lane))
            throw new Error(`swimlane(): step "${st.id ?? st.title}" uses unknown lane "${st.lane}"`);
        const span = st.span ?? 1;
        const col = st.col ?? next;
        next = col + span;
        cols = Math.max(cols, col + span - 1);
        if (st.size !== undefined)
            assertFontSize(st.size);
        return { ...st, type: 'box', col, span };
    });
    const byId = new Map(placed.map(st => [st.id, st]));
    // 1) pick sides, 2) spread flows that share a side of one step along that side, 3) stagger the
    // vertical legs that enter the same column so parallel arrows stay distinguishable.
    const specs = (opts.flows ?? []).map(f => {
        const [fid, fside] = String(f.from).split(':'), [tid, tside] = String(f.to).split(':');
        const a = byId.get(fid), b = byId.get(tid);
        if (!a || !b)
            throw new Error(`swimlane(): flow ${f.from} -> ${f.to} refers to an unknown step id`);
        let from = f.from, to = f.to, auto = false;
        if (!fside && !tside) {
            auto = true;
            const la = laneIdx.get(a.lane), lb = laneIdx.get(b.lane);
            if (b.col > a.col + a.span - 1) {
                from = `${fid}:right`;
                to = `${tid}:left`;
            }
            else if (a.col > b.col + b.span - 1) {
                from = `${fid}:left`;
                to = `${tid}:right`;
            }
            else if (lb > la || (lb === la && (b.row ?? 0) > (a.row ?? 0))) {
                from = `${fid}:bottom`;
                to = `${tid}:top`;
            }
            else {
                from = `${fid}:top`;
                to = `${tid}:bottom`;
            }
        }
        return { f, a, b, from, to, auto };
    });
    const uses = new Map();
    const note = (k) => uses.set(k, (uses.get(k) ?? 0) + 1);
    for (const sp of specs)
        if (sp.auto) {
            note(sp.from);
            note(sp.to);
        }
    const seen = new Map();
    const spread = (ref) => {
        const n = uses.get(ref) ?? 1;
        if (n < 2)
            return ref;
        const k = seen.get(ref) ?? 0;
        seen.set(ref, k + 1);
        return `${ref}@${((k + 1) / (n + 1)).toFixed(2)}`;
    };
    const slot = new Map();
    const flows = specs.map(({ f, b, from, to, auto }) => {
        if (auto) {
            from = spread(from);
            to = spread(to);
        }
        const k = slot.get(b.col) ?? 0;
        slot.set(b.col, k + 1);
        return connectBand(from, to, { route: 'elbow', bend: f.bend ?? 'auto', bendOffset: f.bendOffset ?? 6 + (k % 3) * 7, label: f.label, chip: f.chip ?? !!f.label, labelAt: f.labelAt ?? 0.4, line: f.line, arrow: f.arrow, tone: f.tone });
    });
    const block = { type: 'swimlane', lanes, steps: placed, cols, phases: opts.phases, labelW: opts.labelW, colGap: opts.colGap, id: opts.id };
    return withAnchors([block, ...flows], placed.map(st => st.id));
}
export function wireframe(root, opts = {}) {
    autoNumber(root, opts.overlays);
    return withHandle({ type: 'wireframe', root, ...opts }, opts.id);
}
// `n: true` (on a node, on a part in `parts: {...}`, or on a map marker) means "number me": such callouts get consecutive
// numbers in reading order (top to bottom, left to right), continuing after any explicit numbers.
function autoNumber(...trees) {
    const todo = []; // each one writes the number it is given back into its callout
    let max = 0;
    const num = (v) => { if (typeof v === 'number')
        max = Math.max(max, v); };
    const walk = (nd) => {
        if (!nd || typeof nd !== 'object')
            return;
        if (Array.isArray(nd))
            return nd.forEach(c => walk(c));
        if (!nd.t)
            return;
        const node = nd;
        if (node.n === true)
            todo.push(v => { node.n = v; });
        else
            num(node.n);
        const parts = node.parts;
        if (parts)
            for (const [k, v] of Object.entries(parts)) {
                if (v === true)
                    todo.push(nv => { parts[k] = nv; });
                else
                    num(v);
            }
        if (node.t === 'map')
            for (const m of node.markers ?? []) {
                if (m.n === true)
                    todo.push(v => { m.n = v; });
                else
                    num(m.n);
            }
        walk('children' in node ? node.children : undefined);
    };
    trees.forEach(t => walk(t));
    let next = max + 1;
    for (const set of todo)
        set(next++);
}
export function screens(items, opts = {}) {
    return withAnchors({ type: 'screens', items, ...opts }, items.map(i => i.id));
}
export function stateMatrix(cols, rows, opts = {}) {
    return { type: 'screens', items: [], matrix: { cols, rows, required: opts.required, labelW: opts.labelW, cellH: opts.cellH, gap: opts.gap, cellFrame: opts.cellFrame }, marks: opts.marks, skeleton: opts.skeleton, id: opts.id };
}
export function spacer(h) {
    return { type: 'spacer', h };
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
export function row(children, opts = {}) {
    if (children.some(c => c?.type === 'group')) {
        if (opts.arrows === 'between')
            throw new Error("row(): arrows: 'between' cannot be used when a child is a group()");
        assertRowChildren(children);
        return { type: 'grouprow', cols: opts.cols, children, gap: opts.gap ?? 16, justify: opts.justify ?? 'stretch', itemWidth: opts.width };
    }
    assertBoxChildren('row', children);
    return { type: 'row', cols: opts.cols, children: children, gap: opts.gap ?? 16, arrows: opts.arrows ?? 'none', justify: opts.justify ?? 'stretch', itemWidth: opts.width };
}
export function grid(children, opts) {
    if (!opts?.cols)
        throw new Error('grid(children, {cols}) needs cols');
    assertBoxChildren('grid', children);
    return { type: 'grid', children, cols: opts.cols, gap: opts.gap ?? 16 };
}
export function connect(from, to, opts = {}) {
    return connectBand(from, to, opts);
}
function connectBand(from, to, opts) {
    // arrow: 'end' (default) | 'both' | 'start' | 'none'  (legacy `marker: false` = 'none')
    // line:  'solid' (default) | 'dashed' | 'dotted' | 'double'  (legacy `dashed: true` = 'dashed')
    // labelAt: 0..1 along a straight/loop-under connector where the label/chip sits (default 0.5)
    // chip:  true puts the label in a bordered pill sitting ON the line (protocol / rate tags)
    const arrow = opts.arrow ?? (opts.marker === false ? 'none' : 'end');
    const line = opts.line ?? (opts.dashed ? 'dashed' : 'solid');
    return { type: 'connect', from, to, route: opts.route ?? 'straight', dip: opts.dip ?? 32, bend: opts.bend ?? 0.5, bendOffset: opts.bendOffset, arrow, line, chip: !!opts.chip, labelAt: opts.labelAt ?? 0.5, tone: opts.tone, label: opts.label };
}
export function branch(from, targets, opts = {}) {
    return targets.map(t => connectBand(from, t.to, { route: 'elbow', ...opts, ...t }));
}
export function pyramid(layers, opts = {}) {
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
// Escape hatch. `draw(ctx)` must return a raw SVG fragment string; it
// receives its allocated origin/size and a couple of tone-aware helpers, but
// nothing stops it from emitting arbitrary markup — the fragment is passed
// through emit.ts unmodified. build() runs `lint-svg.ts --strict` on the
// finished file regardless, so an off-token color or sub-14px size written
// here still gets caught before the file is trusted — raw() only escapes
// layout, never the constraint system's verification step.
export function raw(opts) {
    if (typeof opts.draw !== 'function')
        throw new Error('raw({draw}) needs a draw(ctx) function');
    return { type: 'raw', h: opts.h ?? 0, draw: opts.draw };
}
function assertFontSize(size) {
    if (size < MIN_FONT_SIZE) {
        throw new Error(`font-size ${size} is below the ${MIN_FONT_SIZE}px floor — this deck never uses smaller text. Reconsider the layout instead of shrinking the text.`);
    }
}
// Lays out, verifies, renders, writes, and lints a diagram in one call.
// build(d, 'public/svg/day2-11-example.svg')
//
// Two verification layers, in order:
//   1. verifyDiagram() — pure-geometry checks on the laid-out tree, before
//      any SVG exists. Catches sibling/neighbor overlap, canvas-bounds
//      overflow, and low-contrast tone pairs in milliseconds, with no
//      Chromium render involved. This is the primary check.
//   2. lint-svg.ts --strict — a real Playwright render of the finished
//      file. Slower, but it's the only thing that can see what raw()
//      actually drew (verifyDiagram only checks raw()'s self-reported
//      x/y/w/h against its neighbors) and catches real-font-rendering
//      discrepancies verifyDiagram's measured-atom approximation can't.
// opts.lint: false skips the per-file lint-svg.ts run (it starts its own Chromium), for callers that lint many
// files in one go afterwards (build-diagram.ts). Default true.
export async function build(d, outPath, opts = {}) {
    applyAutoLegend(d);
    // A diagram that names its slide gets a measured height budget and width
    // (cached) instead of fit.ts's defaults.
    let budget = null;
    if (d.slide) {
        budget = await getSlideBudget({ ...d.slide, svg: path.basename(outPath) });
        d.maxDisplayHeight = budget.maxHeight;
        d.usableWidth = budget.contentWidth;
    }
    // fill: true (fit-figure slides) — the <img> is stretched to the slide's free
    // area, so draw for that area: canvas as wide as the slot, and the largest
    // font/pad/gap scale (>= 1) whose laid-out height still fits the slot's
    // height. Without this a short diagram leaves the slot half empty and its
    // 14px text is as small as it was at 940px wide.
    let fontScale = 1;
    let laidOut;
    const baseRoles = { ...ROLES };
    const applyScale = (s) => { for (const k of Object.keys(baseRoles))
        ROLES[k] = Math.round(baseRoles[k] * s); };
    const layoutAt = (s) => { applyScale(s); return layoutDiagram({ ...d, pad: Math.round(d.pad * s), gap: Math.round(d.gap * s) }); };
    try {
        if (d.fill) {
            if (!budget)
                throw new Error('diagram({fill: true}) needs diagram({slide: {page, heading}}) to know the slot size');
            d.width = budget.contentWidth;
            let lo = 1, hi = 1.8;
            if ((await layoutAt(1)).canvasHeight > budget.maxHeight)
                hi = 1; // doesn't even fit at 1x: report via fit warnings
            for (let i = 0; i < 7 && hi - lo > 0.01; i++) {
                const mid = (lo + hi) / 2;
                if ((await layoutAt(mid)).canvasHeight <= budget.maxHeight)
                    lo = mid;
                else
                    hi = mid;
            }
            fontScale = Math.floor(lo * 100) / 100;
        }
        laidOut = await layoutAt(fontScale);
        laidOut.fontScale = fontScale;
        return await finishBuild(d, laidOut, outPath, budget, opts.lint ?? true);
    }
    finally {
        applyScale(1);
    }
}
// Layout + verification + rules, without writing any file: the engine behind `svg-diagram check`.
export async function checkDiagram(d) {
    applyAutoLegend(d);
    const laidOut = await layoutDiagram(d);
    return { laidOut, verdict: verifyDiagram(laidOut) };
}
async function finishBuild(d, laidOut, outPath, budget, lint) {
    const verdict = verifyDiagram(laidOut);
    if (!verdict.ok) {
        throw new Error(`build(${outPath}): layout verification failed before any SVG was written:\n  ${verdict.problems.join('\n  ')}`);
    }
    const svg = emitSvg(laidOut);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, svg);
    const lintScript = path.resolve(import.meta.dirname, '..', import.meta.url.endsWith('.ts') ? 'lint-svg.ts' : 'lint-svg.js');
    if (lint)
        try {
            execFileSync('node', [lintScript, outPath, '--strict'], { encoding: 'utf8' });
        }
        catch (err) {
            const e = err;
            const out = (e.stdout || '') + (e.stderr || '');
            throw new Error(`build(${outPath}) produced an SVG that fails lint-svg.ts --strict:\n${out}`);
        }
    const fit = analyzeFit(laidOut);
    return { outPath, width: laidOut.width, height: laidOut.canvasHeight, fit, budget, fontScale: laidOut.fontScale, warnings: verdict.warnings, findings: verdict.findings };
}
export { closeMeasurer };
