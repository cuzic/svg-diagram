import { graphTones, litLink, resolveFocus } from '../focus.js';
import { resolveIcon } from '../icon-registry.js';
import { statesWords } from '../states-words.js';
import { revealOf, scopeOpt, withAnchors, withHandle } from './shared.js';
export function stateDiagram(states, transitions, opts = {}) {
    return statesBandOf(states, transitions, opts);
}
/** focus on a state diagram / flowchart: the tones of the states (solid / accent / muted) and of the arrows (lit: accent, the rest muted). */
function focusGraph(states, transitions, focus, who) {
    const ids = states.map(x => x.id), hit = resolveFocus(focus, ids, who);
    const tones = graphTones(states.length, transitions.map(t => [ids.indexOf(t.from), ids.indexOf(t.to)]), hit);
    return {
        states: states.map((x, i) => ({ ...x, tone: tones[i] })),
        transitions: transitions.map(t => ({ ...t, tone: litLink(ids.indexOf(t.from), ids.indexOf(t.to), hit) ? 'accent' : 'muted' })),
    };
}
/** The band of stateDiagram() and flowchart(): the same checks, with the words of the one that was called. */
function statesBandOf(states, transitions, opts, flavor) {
    const w = statesWords(flavor);
    // a flowchart goes back to a decision as often as forward: its return arrows take the lane outside the figure (inline they run through other nodes)
    const returns = opts.returns ?? (flavor === 'flowchart' ? 'outer' : undefined);
    if (!Array.isArray(states) || states.length === 0)
        throw new Error(flavor === 'flowchart' ? 'flowchart(nodes, edges) needs at least one node' : 'stateDiagram(states, transitions) needs at least one state');
    if (opts.dir !== undefined && opts.dir !== 'right' && opts.dir !== 'down' && opts.dir !== 'auto')
        throw new Error(`${w.who}: dir must be 'right', 'down' or 'auto' (got ${String(opts.dir)})`);
    if (opts.maxNodeW !== undefined && !(opts.maxNodeW >= 80 && Number.isFinite(opts.maxNodeW)))
        throw new Error(`${w.who}: maxNodeW must be a number >= 80 (got ${opts.maxNodeW})`);
    if (opts.straighten !== undefined && typeof opts.straighten !== 'boolean')
        throw new Error(`${w.who}: straighten must be true or false (got ${String(opts.straighten)})`);
    if (opts.returns !== undefined && opts.returns !== 'inline' && opts.returns !== 'outer')
        throw new Error(`${w.who}: returns must be 'inline' or 'outer' (got ${String(opts.returns)})`);
    for (const t of transitions)
        if (t.line !== undefined && !['solid', 'dashed', 'dotted'].includes(t.line))
            throw new Error(`${w.who}: ${w.edge} ${t.from} -> ${t.to} has line ${String(t.line)}`);
    for (const s of states)
        if (s.tone !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger', 'solid', 'solid-danger'].includes(s.tone))
            throw new Error(`${w.who}: ${w.node} "${s.id}" has tone ${String(s.tone)} (use plain, accent, new, changed, removed, muted, danger, solid or solid-danger)`);
    for (const s of states)
        if (s.shape !== undefined && !['box', 'circle', 'diamond', 'pill'].includes(s.shape))
            throw new Error(`${w.who}: ${w.node} "${s.id}" has shape ${String(s.shape)} (use 'box', 'circle', 'diamond' or 'pill')`);
    for (const s of states)
        if ((s.shape === 'diamond' || s.shape === 'pill') && s.final)
            throw new Error(`${w.who}: ${w.node} "${s.id}" is a ${s.shape} and final: the double outline is a rectangle's (use a box)`);
    for (const t of transitions) {
        const s = states.find(x => x.id === t.from);
        if (t.from === t.to && (s?.shape === 'diamond' || s?.shape === 'pill'))
            throw new Error(`${w.who}: a ${s.shape} cannot loop to itself ("${t.from}": the loop leaves from the side of a rectangle)`);
    }
    for (const t of transitions)
        if (t.tone !== undefined && !['danger', 'accent', 'muted'].includes(t.tone))
            throw new Error(`${w.who}: ${w.edge} ${t.from} -> ${t.to} has tone ${String(t.tone)} (use danger, accent or muted)`);
    if (opts.focus !== undefined)
        ({ states, transitions } = focusGraph(states, transitions, opts.focus, w.who));
    const band = { type: 'states', ...(flavor ? { flavor } : {}), states: states.map(s => s.icon === undefined ? s : { ...s, iconGlyph: resolveIcon(s.icon, w.who + ' ' + w.node + ' "' + s.id + '" icon') }), transitions: [...transitions], ...(opts.dir === undefined ? {} : { dir: opts.dir }), ...(opts.initial === undefined ? {} : { initial: opts.initial }), ...(opts.maxNodeW === undefined ? {} : { maxNodeW: opts.maxNodeW }), ...(returns === undefined ? {} : { returns }), ...(flavor === 'flowchart' && opts.dir === undefined ? { defaultDir: 'down' } : {}), ...(opts.straighten === undefined ? {} : { straighten: opts.straighten }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, w.who), ...revealOf(opts) };
    if (opts.focus !== undefined && band.initial !== undefined)
        band.initialTone = resolveFocus(opts.focus, states.map(x => x.id), w.who).has(states.findIndex(x => x.id === band.initial)) ? 'accent' : 'muted';
    return withAnchors(withHandle(band, opts.id), states.map(s => s.id));
}
const FLOW_SHAPE = { process: undefined, decision: 'diamond', terminator: 'pill' };
const FLOW_NODE_KEYS = ['id', 'label', 'sub', 'kind', 'tone', 'icon'];
export function flowchart(nodes, edges, opts = {}) {
    if (!Array.isArray(nodes) || nodes.length === 0)
        throw new Error('flowchart(nodes, edges) needs at least one node');
    if ('initial' in opts)
        throw new Error("flowchart(): has no `initial`: start with a node of kind 'terminator'");
    const items = nodes.map(n => {
        const extra = Object.keys(n).filter(k => !FLOW_NODE_KEYS.includes(k));
        if (extra.length)
            throw new Error(`flowchart(): node "${n.id}" has an unknown option ${extra.map(k => `'${k}'`).join(', ')} (id, label, sub, kind, tone, icon)`);
        if (n.kind !== undefined && !(n.kind in FLOW_SHAPE))
            throw new Error(`flowchart(): node "${n.id}" has kind ${String(n.kind)} (use 'process', 'decision' or 'terminator')`);
        const { kind: _kind, ...rest } = n, kind = n.kind ?? 'process', shape = FLOW_SHAPE[kind];
        return { ...rest, ...(shape === undefined ? {} : { shape }) };
    });
    return statesBandOf(items, edges, opts, 'flowchart');
}
