import { whyWhyTreeFindings } from '../rca-rules.js';
import { criticalPath, exact } from '../qc.js';
import { causeBand } from './cause.js';
import { revealOf, scopeOpt } from './shared.js';
import { stateDiagram } from './states.js';
import { caption } from './text-bands.js';
export { tree, mindmap } from './tree.js';
export { bpmn } from './bpmn.js';
export { classDiagram } from './classes.js';
export { flowchart, stateDiagram } from './states.js';
export { causeTree, pdpc, relationDiagram, transitionUnits } from './cause.js';
export function whyWhyTree(problem, whys, opts = {}) {
    if (typeof problem !== 'string' || !problem.trim())
        throw new Error('whyWhyTree(problem, whys) needs the problem as text');
    if (!Array.isArray(whys) || whys.length === 0)
        throw new Error('whyWhyTree(problem, whys) needs at least one answer to "なぜ?"');
    if (opts.readingNote !== undefined && typeof opts.readingNote !== 'boolean')
        throw new Error(`whyWhyTree(): readingNote is true or false (got ${String(opts.readingNote)})`);
    const prefix = opts.id === undefined ? '' : `${opts.id}.`, nodes = [], links = [], seen = new Set();
    const add = (n) => {
        if (seen.has(n.id))
            throw new Error(`whyWhyTree(): the id "${n.id}" is used twice${/(^|\.)(problem|w\d[\d.]*(\.m)?)$/.test(n.id) ? ' (problem, w1, w1.1, w1.m ... are the names the tree gives its own entities: write another id)' : ''}`);
        seen.add(n.id);
        nodes.push(n);
    };
    const problemId = `${prefix}problem`;
    add({ id: problemId, label: problem, role: 'effect', tone: 'danger' });
    const walk = (n, path, effect) => {
        if (!n || typeof n.why !== 'string' || !n.why.trim())
            throw new Error(`whyWhyTree(): "${path}" needs a why (the answer to "なぜ?" as text)`);
        if (n.trueCause !== undefined && n.trueCause !== true)
            throw new Error(`whyWhyTree(): "${n.why}": trueCause is true (or leave it out)`);
        if (n.measure !== undefined && (typeof n.measure !== 'string' || !n.measure.trim()))
            throw new Error(`whyWhyTree(): "${n.why}": measure is the text of what is done`);
        if (n.because !== undefined && !Array.isArray(n.because))
            throw new Error(`whyWhyTree(): "${n.why}": because is a list of whys`);
        const id = n.id ?? `${prefix}w${path}`;
        add({ id, label: n.why, ...(n.trueCause ? { role: 'root' } : {}) });
        links.push({ from: id, to: effect });
        if (n.measure !== undefined) {
            const m = `${id}.m`;
            add({ id: m, label: n.measure, role: 'measure' });
            links.push({ from: m, to: id, kind: 'blocks' });
        }
        (n.because ?? []).forEach((c, i) => walk(c, `${path}.${i + 1}`, id));
    };
    whys.forEach((w, i) => walk(w, String(i + 1), problemId));
    const own = userIds(whys), unanchored = opts.id === undefined ? nodes.filter(n => !own.has(n.id)).map(n => n.id) : [];
    const band = causeBand(nodes, links, { dir: 'auto', ...(opts.id === undefined ? {} : { id: opts.id }), ...(opts.maxNodeW === undefined ? {} : { maxNodeW: opts.maxNodeW }), ...revealOf(opts), ...scopeOpt(opts, 'whyWhyTree()') }, undefined, unanchored);
    band.origin = 'whywhy';
    band.layerFrom = 'effect'; // also: never folded (a layer cut into rows would put one "why n" on two levels)
    band.rca = { kind: 'whywhy-tree', findings: whyWhyTreeFindings(whys) };
    if (opts.readingNote === false)
        return [band];
    const notes = [caption('矢印は原因 → 結果。「なぜ?」は矢印をさかのぼって（下へ）読む', revealOf(opts))];
    if (nodes.some(n => n.role === 'measure'))
        notes.push(caption('対策（破線の棒）は真因に打つ手で、なぜの答えではない', revealOf(opts)));
    return [band, ...notes];
}
function userIds(whys, out = new Set()) {
    for (const w of whys) {
        if (w.id !== undefined)
            out.add(w.id);
        userIds(w.because ?? [], out);
    }
    return out;
}
export { bowtie } from './bowtie.js';
/**
 * An arrow diagram (アロー・ダイヤグラム; PERT): events are circles, activities are the arrows between them, each labelled with its name and
 * days, and a dummy (`dummy: true`, dashed) only says "this before that". The earliest and latest time of every event, the float of every
 * activity and the critical path are worked out: critical activities are thick red arrows and critical events are red.
 * In each circle: the event number, and under it the earliest / latest time. Exactly one event starts the network and one ends it.
 *   arrowDiagram([{from: 1, to: 2, name: '設計', days: 5}, {from: 2, to: 3, name: '製作', days: 7}, {from: 2, to: 3, dummy: true}, {from: 3, to: 4, name: '検査', days: 2}])
 */
export function arrowDiagram(activities, opts = {}) {
    const r = criticalPath(activities), unit = opts.unit ?? '日', show = opts.times !== false;
    const states = r.events.map(e => ({ id: e.id, label: e.id, shape: 'circle', ...(show ? { sub: `${exact(e.early)}/${exact(e.late)}` } : {}), ...(e.late - e.early < 1e-9 ? { tone: 'danger' } : {}) }));
    const transitions = r.activities.map(a => ({
        from: a.from, to: a.to, ...(a.dummy ? { line: 'dashed' } : { label: `${a.name} ${exact(a.days)}${show && !a.critical && a.float > 0 ? `（余裕${exact(a.float)}）` : ''}` }),
        ...(a.critical ? { tone: 'danger', strong: true } : {}),
    }));
    const { times: _t, unit: _u, summary, ...rest } = opts;
    const band = stateDiagram(states, transitions, { ...rest, ...(opts.dir === undefined ? {} : { dir: opts.dir }) });
    return summary === false ? [band] : [band, caption(`全体で ${exact(r.length)}${unit}　クリティカルパス: ${r.path.join(' → ')}${r.activities.filter(a => a.critical && !a.dummy).length > r.path.length ? '（ほかにも同じ長さの経路がある）' : ''}`, { align: 'left' })];
}
export { affinity } from './affinity.js';
export { cloud } from './cloud.js';
export { faultTree } from './fta.js';
