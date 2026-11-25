import { graphTones, resolveFocus } from '../focus.js';
import { resolveIcon } from '../icon-registry.js';
import { must } from '../must.js';
import { assertBoxTone, revealOf, scopeOpt, TREE_TONES, withAnchors, withHandle } from './shared.js';
export function bpmn(lanes, nodes, flows, opts = {}) {
    if (!Array.isArray(lanes) || lanes.length === 0)
        throw new Error('bpmn(lanes, nodes, flows) needs at least one lane');
    if (!Array.isArray(nodes) || nodes.length === 0)
        throw new Error('bpmn(lanes, nodes, flows) needs at least one node');
    for (const l of lanes)
        if (l.tone !== undefined)
            assertBoxTone(l.tone, `bpmn() lane "${l.id}"`);
    for (const n of nodes)
        if (n.tone !== undefined && !TREE_TONES.includes(n.tone))
            throw new Error(`bpmn(): node "${n.id}" has tone ${String(n.tone)} (use ${TREE_TONES.join(', ')})`);
    // an icon is resolved here (the shell) and carried on the node, so layout and emit stay free of I/O
    const placedNodes = nodes.map(n => n.icon === undefined ? n : { ...n, iconGlyph: resolveIcon(n.icon, `bpmn() task "${n.id}" icon`) });
    for (const f of flows)
        if (f.line !== undefined && f.line !== 'solid' && f.line !== 'dashed')
            throw new Error(`bpmn(): flow ${f.from} -> ${f.to} has line ${String(f.line)}`);
    if (opts.fit !== undefined && opts.fit !== 'shrink')
        throw new Error(`bpmn(): fit must be 'shrink' (got ${String(opts.fit)})`);
    if (opts.dir !== undefined && opts.dir !== 'h' && opts.dir !== 'v')
        throw new Error(`bpmn(): dir must be 'h' or 'v' (got ${String(opts.dir)})`);
    if (opts.dir === 'v' && opts.fit !== undefined)
        throw new Error("bpmn(): fit: 'shrink' is for the horizontal figure; a vertical one (dir: 'v') takes its column width from the lanes");
    const focused = opts.focus === undefined ? undefined : resolveFocus(opts.focus, nodes.map(n => n.id), 'bpmn()');
    const toned = focused === undefined ? placedNodes : (() => {
        const ids = nodes.map(n => n.id), tones = graphTones(ids.length, flows.map(f => [ids.indexOf(f.from), ids.indexOf(f.to)]), focused);
        return placedNodes.map((n, i) => ({ ...n, tone: must(tones[i]) }));
    })();
    const band = { type: 'bpmn', lanes: [...lanes], nodes: toned, flows: [...flows], ...(focused === undefined ? {} : { focused: [...focused].map(i => must(nodes[i]).id) }), ...(opts.id === undefined ? {} : { id: opts.id }), ...(opts.fit === undefined ? {} : { fit: opts.fit }), ...(opts.dir === 'v' ? { dir: 'v' } : {}), ...scopeOpt(opts, 'bpmn()'), ...revealOf(opts) };
    return withAnchors(withHandle(band, opts.id), nodes.map(n => n.id));
}
