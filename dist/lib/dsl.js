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
import { wf } from './wireframe.js';
import { layoutDiagram } from './layout.js';
import { emitSvg } from './emit.js';
import { xmlProblems } from './xml-check.js';
import { verifyDiagram } from './verify.js';
import { applyAutoLegend } from './rules.js';
import { analyzeFit } from './fit.js';
import { getSlideBudget, readSlideBudgetCache } from './slide-budget.js';
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
        connectDefaults: opts.connectDefaults, wireframeDefaults: opts.wireframeDefaults,
        fill: !!opts.fill, // fit-figure slide: build to the measured width/height, growing fonts to use the slack (see build())
        bands: [],
    };
    return {
        ...d,
        add(...bands) {
            let flat = bands.flat();
            if (d.connectDefaults)
                flat = applyConnectDefaults(flat, d.connectDefaults);
            if (d.wireframeDefaults)
                flat = applyWireframeDefaults(flat, d.wireframeDefaults);
            d.bands.push(...flat);
            return this;
        },
        connect(from, to, opts = {}) { return this.add(connectBand(from, to, opts)); },
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
// A table cell with a status symbol: `cell('通る', {mark: 'ok'})` draws "○ 通る" in the accent tone; mark: 'ok' ○ | 'mid' △ | 'ng' × | 'best' ◎.
// `cell('', {mark: 'ng'})` is the symbol alone. The symbol says it, the colour only reinforces it (never colour alone).
//
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
        return connectBand(from, to, { route: 'elbow', bend: f.bend ?? 'auto', bendOffset: f.bendOffset ?? 6 + (k % 3) * 7, label: f.label, chip: f.chip ?? !!f.label, labelAt: f.labelAt ?? 0.4, line: f.line, arrow: f.arrow, tone: f.tone }, false);
    });
    const block = { type: 'swimlane', lanes, steps: placed, cols, phases: opts.phases, labelW: opts.labelW, colGap: opts.colGap, id: opts.id };
    return withAnchors([block, ...flows], placed.map(st => st.id));
}
export function wireframe(root, opts = {}) {
    const numbering = autoNumber(root, opts.overlays);
    return Object.defineProperty(withHandle({ type: 'wireframe', root, ...opts }, opts.id), NUMBERING, { value: numbering });
}
const NUMBERING = Symbol('wireframe-numbering'); // on a wireframe band: its Numbering, so a diagram shell can number ITS callouts first
/** `skip`: nodes that are not walked (nor descended into) — used to number only a shell, not the content it wraps. */
function collectNumbering(skip, trees) {
    const todo = [];
    let max = 0;
    const num = (v) => { if (typeof v === 'number')
        max = Math.max(max, v); };
    const walk = (nd) => {
        if (!nd || typeof nd !== 'object')
            return;
        if (Array.isArray(nd))
            return nd.forEach(c => walk(c));
        if (!nd.t || skip?.has(nd))
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
    return { todo, max };
}
const assignNumbers = (max, ...groups) => { let next = max + 1; for (const g of groups)
    for (const set of g)
        set(next++); };
function autoNumber(...trees) {
    const nm = collectNumbering(null, trees);
    assignNumbers(nm.max, nm.todo);
    return nm;
}
/** Every node of a tree (so a shell can tell its own nodes from the content's). */
function nodesOf(root) {
    const out = new Set();
    const walk = (nd) => {
        if (!nd || typeof nd !== 'object')
            return;
        if (Array.isArray(nd))
            return nd.forEach(walk);
        out.add(nd);
        walk(nd.children);
    };
    walk(root);
    return out;
}
export function screens(items, opts = {}) {
    return withAnchors({ type: 'screens', items, ...opts }, items.map(i => i.id));
}
export function stateMatrix(cols, rowsIn, opts = {}) {
    const rows = rowsIn.map((r) => 'type' in r && r.type === 'part-row' ? { label: r.label, note: r.note, cells: r.cells(cols) } : r);
    return { type: 'screens', items: [], matrix: { cols, rows, required: opts.required, labelW: opts.labelW, cellH: opts.cellH, gap: opts.gap, cellFrame: opts.cellFrame }, marks: opts.marks, skeleton: opts.skeleton, id: opts.id };
}
// One part drawn once per state: `part` is the function that builds it (the one you would call as `part({state: 'loading'})`),
// `states` says, per column, what differs from `base`:
//   {} (as is) | {state: 'loading', ...} (options merged over `base`) | 'loading' (= {state: 'loading'}) | 'na' | {na: reason} | undefined (未設計)
// Types: `states` has a key for every column of the matrix (a state left out is a type error, like a short `cells` row).
//   stateMatrix(['通常', '読み込み中', '空'], [
//     stateRow('在庫カード', stock, {通常: {}, 読み込み中: 'loading', 空: {na: '必ず 1 件ある'}}),
//     stateRow('検索結果', results, {通常: {}, 読み込み中: 'loading', 空: {state: 'empty', stateNote: '該当なし'}}, {note: '0 件のとき空'}),
//   ])
export function stateRow(label, part, states, opts = {}) {
    return {
        type: 'part-row', label, note: opts.note,
        cells(cols) {
            for (const k of Object.keys(states))
                if (!cols.includes(k))
                    throw new Error(`stateRow("${label}"): "${k}" is not a column of the matrix (${cols.join(', ')})`);
            return cols.map((col) => {
                const v = states[col];
                if (v === undefined || v === 'na' || v === 'todo')
                    return v;
                const call = part;
                if (typeof v === 'string')
                    return call({ ...opts.base, state: v });
                if (Object.keys(v).length === 1 && 'na' in v && typeof v.na === 'string')
                    return { na: v.na }; // `{na: reason}` alone; a part's own `na` option comes with others
                return call({ ...opts.base, ...v });
            });
        },
    };
}
export function spacer(h) {
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
export function row(children, opts = {}) {
    const hasGroup = children.some(c => c?.type === 'group');
    if (hasGroup) {
        if (opts.arrows === 'between')
            throw new Error("row(): arrows: 'between' cannot be used when a child is a group()");
        assertRowChildren(children);
    }
    else
        assertBoxChildren('row', children);
    const { cols, kids } = spanRow(children, opts.cols);
    const band = hasGroup
        ? { type: 'grouprow', id: opts.id, cols, children: kids, gap: opts.gap ?? 16, justify: opts.justify ?? 'stretch', itemWidth: opts.width }
        : { type: 'row', id: opts.id, cols, children: kids, gap: opts.gap ?? 16, arrows: opts.arrows ?? 'none', justify: opts.justify ?? 'stretch', itemWidth: opts.width };
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
    if (!Array.isArray(cols))
        return { cols, kids: children };
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
export function grid(children, opts) {
    if (!opts?.cols)
        throw new Error('grid(children, {cols}) needs cols');
    assertBoxChildren('grid', children);
    return { type: 'grid', children, cols: opts.cols, gap: opts.gap ?? 16 };
}
export function connect(from, to, opts = {}) {
    return connectBand(from, to, opts);
}
// A band copied with the same properties (including the non-enumerable handles) so a diagram's defaults never change the
// object the caller holds — the same band can be added to another diagram with other defaults (or none).
function cloneBand(b) {
    return Object.create(Object.getPrototypeOf(b), Object.getOwnPropertyDescriptors(b));
}
/** Maps a band list; a container is copied only when something inside it changed. */
function mapBands(bands, fn) {
    return bands.map(b => {
        const changed = fn(b);
        if (changed)
            return changed;
        if ('children' in b && Array.isArray(b.children)) {
            const kids = mapBands(b.children, fn);
            if (kids.some((k, i) => k !== b.children[i]))
                return Object.assign(cloneBand(b), { children: kids });
        }
        return b;
    });
}
// diagram({wireframeDefaults}): fill the screen fields a wireframe() / screens() item leaves out, and wrap its content in the shell.
// The result is a copy; a copy made here is never wrapped again (adding it to a diagram a second time is safe). `n: true` callouts
// of the shell are numbered BEFORE the content's auto-numbered ones (the shell is on top of the screen); that renumbers the
// content's auto numbers, which are written into the content nodes themselves — only when the shell has such callouts.
const SHELLED = new WeakSet();
function applyWireframeDefaults(bands, defaults) {
    const apply = (orig, numbering) => {
        if (SHELLED.has(orig))
            return orig;
        const screen = cloneBand(orig);
        SHELLED.add(screen);
        const s = screen;
        for (const k of ['h', 'frame', 'skeleton', 'tag', 'tagTone'])
            if (s[k] === undefined && defaults[k] !== undefined)
                s[k] = defaults[k];
        if (screen.shell === false)
            return screen;
        const props = screen.shell ?? {};
        const own = nodesOf(orig.root);
        let content = [orig.root].flat();
        if (defaults.appbar) {
            const { title, nav, right } = defaults.appbar;
            let active;
            if (typeof props.active === 'string') {
                active = (nav ?? []).indexOf(props.active);
                if (active < 0)
                    throw new Error(`wireframeDefaults.appbar: "${props.active}" is not one of the nav items (${(nav ?? []).join(', ')})`);
            }
            else
                active = props.active;
            content = [wf.appbar(props.title ?? title, { nav, right, active }), ...content];
        }
        if (defaults.shell)
            content = [defaults.shell(content, props)].flat();
        screen.root = content.length === 1 ? content[0] : content;
        if (numbering) {
            const shellNumbers = collectNumbering(own, [screen.root]);
            if (shellNumbers.todo.length)
                assignNumbers(Math.max(numbering.max, shellNumbers.max), shellNumbers.todo, numbering.todo);
        }
        else
            autoNumber(screen.root, screen.overlays);
        return screen;
    };
    return mapBands(bands, b => {
        if (b.type === 'wireframe')
            return apply(b, b[NUMBERING]);
        if (b.type === 'screens') {
            const sc = b, items = sc.items.map(it => apply(it));
            return items.some((it, i) => it !== sc.items[i]) ? Object.assign(cloneBand(sc), { items }) : undefined;
        }
        return undefined;
    });
}
// The options a connector was written with, kept (non-enumerable) so diagram({connectDefaults}) can tell "not given" from "given as the default".
// Only connect() and branch() keep them: swimlane() flows are not connectors the user wrote, so the defaults do not touch them.
const GIVEN = Symbol('connect-options');
function applyConnectDefaults(bands, defaults) {
    return mapBands(bands, b => {
        if (b.type !== 'connect')
            return undefined;
        const given = b[GIVEN];
        if (!given)
            return undefined;
        const own = Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined));
        const merged = { ...defaults, ...own };
        if (own.marker !== undefined)
            merged.arrow = own.arrow; // the legacy spellings of arrow / line outrank the default
        if (own.dashed !== undefined)
            merged.line = own.line;
        if (!own.label)
            merged.chip = own.chip; // a chip needs a label
        const route = merged.route ?? 'straight';
        if (route !== 'elbow') {
            merged.bend = own.bend;
            merged.bendOffset = own.bendOffset;
        }
        if (route !== 'loop-under')
            merged.dip = own.dip;
        return connectBand(b.from, b.to, merged);
    });
}
function connectBand(from, to, opts, trackGiven = true) {
    // arrow: 'end' (default) | 'both' | 'start' | 'none'  (legacy `marker: false` = 'none')
    // line:  'solid' (default) | 'dashed' | 'dotted' | 'double'  (legacy `dashed: true` = 'dashed')
    // labelAt: 0..1 along a straight/loop-under connector where the label/chip sits (default 0.5)
    // chip:  true puts the label in a bordered pill sitting ON the line (protocol / rate tags)
    const arrow = opts.arrow ?? (opts.marker === false ? 'none' : 'end');
    const line = opts.line ?? (opts.dashed ? 'dashed' : 'solid');
    const band = { type: 'connect', from, to, route: opts.route ?? 'straight', dip: opts.dip ?? 32, bend: opts.bend ?? 0.5, bendOffset: opts.bendOffset, arrow, line, chip: !!opts.chip, labelAt: opts.labelAt ?? 0.5, tone: opts.tone, label: opts.label };
    return trackGiven ? Object.defineProperty(band, GIVEN, { value: opts, configurable: true }) : band;
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
// A coordinate plane: axes with ticks, points, guide lines, dimension lines and labels, all in the plane's own units.
//   plane({x: {label: 'x', max: 100, step: 20}, y: {label: 'y', max: 60}, yDown?: true (image coordinates), grid?: true,
//          points: [{id: 'a', at: [20, 10], label: 'A', labelAt?, tone?, shape?: 'dot' | 'ring' | 'cross'}],
//          lines:  [{from: 'a', to: [20, 0], tone?, dashed? (default true), arrow?}],       // guides / projections
//          dims:   [{from: 'a', to: 'b', label: '40 m', side?: 'above' | 'below' | 'left' | 'right', tone?}],
//          labels: [{at: [50, 55], text: '原点', anchor?, tone?, bold?}], height?, width?})
// A position is [x, y] or the id of a point. Layout places the ticks, labels and dimension lines; verify reports labels that
// overlap each other or leave the figure.
export function plane(opts) {
    for (const k of ['x', 'y']) {
        const a = opts?.[k];
        if (a && a.step !== undefined && !(a.step > 0 && Number.isFinite(a.step)))
            throw new Error(`plane(): axis ${k} step must be a number > 0 (got ${a.step})`);
        if (!a || typeof a.max !== 'number')
            throw new Error(`plane(): "${k}" needs an axis, e.g. {max: 100}`);
        if (a.max <= (a.min ?? 0))
            throw new Error(`plane(): axis ${k} needs max > min`);
    }
    return { type: 'plane', ...opts, height: opts.height ?? 300 };
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
// opts.name: the SVG's published name when outPath is a scratch file (it keys the slide-budget cache). opts.lint: false skips the per-file lint-svg.ts run (it starts its own Chromium), for callers that lint many
// files in one go afterwards (build-diagram.ts). Default true.
export async function build(d, outPath, opts = {}) {
    const r = await renderDiagram(d, { name: opts.name ?? path.basename(outPath), budget: 'measure' });
    return finishBuild(r, outPath, opts.lint ?? true);
}
// Everything build() does short of the disk: layout (with the slide budget and the fill / font scale search), verification,
// the SVG, its XML well-formedness. It does not throw for a failed verification or a malformed SVG — it reports them in
// `verdict` and `xml`, so build() can refuse to write while `svg-diagram show` can still draw the picture and say what is wrong.
// (A define()/constructor/layout error still throws.) budget: 'measure' measures a slide that has no cached budget (starts the
// dev server, writes the cache); 'cacheOnly' reads the cache and falls back to the default sizes with a note.
export async function renderDiagram(d, opts) {
    applyAutoLegend(d);
    const notes = [];
    // A diagram that names its slide gets a measured height budget and width
    // (cached) instead of fit.ts's defaults.
    let budget = null;
    let budgetSource = null;
    if (d.slide) {
        const key = { ...d.slide, svg: opts.name };
        if (opts.budget === 'measure') {
            budget = await getSlideBudget(key);
            budgetSource = budget.cached ? 'cache' : 'measured';
        }
        else {
            budget = readSlideBudgetCache(key);
            budgetSource = budget ? 'cache' : 'default';
            if (!budget)
                notes.push(`スライドの空き寸法が未計測(キャッシュなし)なので既定の寸法で描いた。\`svg-diagram build\` で一度実測すると正確になる`);
        }
        if (budget) {
            d.maxDisplayHeight = budget.maxHeight;
            d.usableWidth = budget.contentWidth;
        }
    }
    // fill: true (fit-figure slides) — the <img> is stretched to the slide's free
    // area, so draw for that area: canvas as wide as the slot, and the largest
    // font/pad/gap scale (>= 1) whose laid-out height still fits the slot's
    // height. Without this a short diagram leaves the slot half empty and its
    // 14px text is as small as it was at 940px wide.
    let fontScale = 1;
    let laidOut;
    let verdict, svg;
    const baseRoles = { ...ROLES };
    const applyScale = (s) => { for (const k of Object.keys(baseRoles))
        ROLES[k] = Math.round(baseRoles[k] * s); };
    const layoutAt = (s) => { applyScale(s); return layoutDiagram({ ...d, pad: Math.round(d.pad * s), gap: Math.round(d.gap * s) }); };
    try {
        if (d.fill && budget) {
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
        else if (d.fill) {
            if (opts.budget === 'measure' || !d.slide)
                throw new Error('diagram({fill: true}) needs diagram({slide: {page, heading}}) to know the slot size');
            notes.push('fill: true の図はスライドの空き寸法が要るため、既定の幅・倍率で描いた');
        }
        laidOut = await layoutAt(fontScale);
        laidOut.fontScale = fontScale;
        // emit.ts reads ROLES while it draws, so the verdict and the SVG are made at the scale the layout was made at
        verdict = verifyDiagram(laidOut);
        svg = emitSvg(laidOut);
    }
    finally {
        applyScale(1);
    }
    return { svg, laidOut, verdict, xml: xmlProblems(svg), notes, width: laidOut.width, height: laidOut.canvasHeight, fit: analyzeFit(laidOut), budget, budgetSource, fontScale: laidOut.fontScale };
}
// Layout + verification + rules, without writing any file: the engine behind `svg-diagram check`.
export async function checkDiagram(d) {
    applyAutoLegend(d);
    const laidOut = await layoutDiagram(d);
    return { laidOut, verdict: verifyDiagram(laidOut) };
}
async function finishBuild(r, outPath, lint) {
    const { verdict } = r;
    if (!verdict.ok) {
        throw new Error(`build(${outPath}): layout verification failed before any SVG was written:\n  ${verdict.problems.join('\n  ')}`);
    }
    if (r.xml.length)
        throw new Error(`build(${outPath}): the emitted SVG is not well-formed XML (an <img> would fail to load it):\n  ${r.xml.join('\n  ')}`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, r.svg);
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
    return { outPath, width: r.width, height: r.height, fit: r.fit, budget: r.budget, fontScale: r.fontScale, warnings: verdict.warnings, findings: verdict.findings };
}
export { closeMeasurer };
