import { resolveIcon } from '../icon-registry.js';
import { statesWords } from '../states-words.js';
import { CAUSE_ROLES } from '../toc.js';
import { ftaIds, ftaResolve, ftaSinglePoints, ftaQuant } from '../fta.js';
import { coreDrivers, reachCounts } from '../toc-analysis.js';
import { bowtieCheck } from '../bowtie.js';
import { whyWhyTreeFindings } from '../rca-rules.js';
import { criticalPath, exact } from '../qc.js';
import { grid, row } from './containers.js';
import { assertBoxTone, revealOf, scopeOpt, withAnchors, withHandle } from './shared.js';
import { box, caption, group } from './text-bands.js';
export function tree(root, opts = {}) {
    if (!root || typeof root !== 'object' || typeof root.label !== 'string')
        throw new Error('tree(root) needs a root node: {label: "...", children: [...]}');
    if (opts.dir !== undefined && opts.dir !== 'down' && opts.dir !== 'right' && opts.dir !== 'auto')
        throw new Error(`tree(): dir must be 'down', 'right' or 'auto' (got ${String(opts.dir)})`);
    if (opts.maxNodeW !== undefined && !(opts.maxNodeW >= 80 && Number.isFinite(opts.maxNodeW)))
        throw new Error(`tree(): maxNodeW must be a number >= 80 (got ${opts.maxNodeW})`);
    const ids = [];
    const walk = (n) => {
        if (n.tone !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'].includes(n.tone))
            throw new Error(`tree(): "${n.label}" has tone ${String(n.tone)}`);
        ids.push(n.id);
        for (const c of n.children ?? [])
            walk(c);
    };
    walk(root);
    const band = { type: 'tree', root, ...(opts.dir === undefined ? {} : { dir: opts.dir }), ...(opts.maxNodeW === undefined ? {} : { maxNodeW: opts.maxNodeW }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'tree()'), ...revealOf(opts) };
    return withAnchors(withHandle(band, opts.id), ids);
}
export function bpmn(lanes, nodes, flows, opts = {}) {
    if (!Array.isArray(lanes) || lanes.length === 0)
        throw new Error('bpmn(lanes, nodes, flows) needs at least one lane');
    if (!Array.isArray(nodes) || nodes.length === 0)
        throw new Error('bpmn(lanes, nodes, flows) needs at least one node');
    for (const l of lanes)
        if (l.tone !== undefined)
            assertBoxTone(l.tone, `bpmn() lane "${l.id}"`);
    for (const n of nodes)
        if (n.tone !== undefined) {
            assertBoxTone(n.tone, `bpmn() node "${n.id}"`);
            if (!['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'].includes(n.tone))
                throw new Error(`bpmn(): node "${n.id}" has tone ${String(n.tone)}`);
        }
    // an icon is resolved here (the shell) and carried on the node, so layout and emit stay free of I/O
    const placedNodes = nodes.map(n => n.icon === undefined ? n : { ...n, iconGlyph: resolveIcon(n.icon, `bpmn() task "${n.id}" icon`) });
    for (const f of flows)
        if (f.line !== undefined && f.line !== 'solid' && f.line !== 'dashed')
            throw new Error(`bpmn(): flow ${f.from} -> ${f.to} has line ${String(f.line)}`);
    if (opts.fit !== undefined && opts.fit !== 'shrink')
        throw new Error(`bpmn(): fit must be 'shrink' (got ${String(opts.fit)})`);
    const band = { type: 'bpmn', lanes: [...lanes], nodes: placedNodes, flows: [...flows], ...(opts.id === undefined ? {} : { id: opts.id }), ...(opts.fit === undefined ? {} : { fit: opts.fit }), ...scopeOpt(opts, 'bpmn()'), ...revealOf(opts) };
    return withAnchors(withHandle(band, opts.id), nodes.map(n => n.id));
}
export function classDiagram(classes, relations, opts = {}) {
    if (!Array.isArray(classes) || classes.length === 0)
        throw new Error('classDiagram(classes, relations) needs at least one class');
    if (opts.straighten !== undefined && typeof opts.straighten !== 'boolean')
        throw new Error(`classDiagram(): straighten must be true or false (got ${String(opts.straighten)})`);
    if (opts.dir !== undefined && opts.dir !== 'down' && opts.dir !== 'right' && opts.dir !== 'auto')
        throw new Error(`classDiagram(): dir must be 'down', 'right' or 'auto' (got ${String(opts.dir)})`);
    for (const c of classes)
        if (c.tone !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'].includes(c.tone))
            throw new Error(`classDiagram(): class "${c.id}" has tone ${String(c.tone)}`);
    const band = { type: 'classes', classes: [...classes], relations: [...relations], ...(opts.dir === undefined ? {} : { dir: opts.dir }), ...(opts.straighten === undefined ? {} : { straighten: opts.straighten }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'classDiagram()'), ...revealOf(opts) };
    return withAnchors(withHandle(band, opts.id), classes.map(c => c.id));
}
export function stateDiagram(states, transitions, opts = {}) {
    return statesBandOf(states, transitions, opts);
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
    const band = { type: 'states', ...(flavor ? { flavor } : {}), states: states.map(s => s.icon === undefined ? s : { ...s, iconGlyph: resolveIcon(s.icon, w.who + ' ' + w.node + ' "' + s.id + '" icon') }), transitions: [...transitions], ...(opts.dir === undefined ? {} : { dir: opts.dir }), ...(opts.initial === undefined ? {} : { initial: opts.initial }), ...(opts.maxNodeW === undefined ? {} : { maxNodeW: opts.maxNodeW }), ...(returns === undefined ? {} : { returns }), ...(flavor === 'flowchart' && opts.dir === undefined ? { defaultDir: 'down' } : {}), ...(opts.straighten === undefined ? {} : { straighten: opts.straighten }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, w.who), ...revealOf(opts) };
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
/**
 * A cause-and-effect tree of the Theory of Constraints: entities (boxes) and the arrows from cause to effect, placed in layers with
 * the causes at the bottom and the effects at the top (dir: 'down' / 'right' / 'left' turn it). The one figure behind the Current
 * and Future Reality Trees, the Prerequisite Tree and the Transition Tree: a link whose `from` is an array is an AND (the causes
 * together; an arc is drawn across their arrows), separate links are alternatives. `role` colours an entity: ude (undesirable
 * effect), root (root cause), de (desirable effect), injection, goal, obstacle, io (intermediate objective), action.
 *   causeTree([{id: 'late', label: '納期遅れ', role: 'ude'}, {id: 'multi', label: '並行作業が多い', role: 'root'}, {id: 'sw', label: '切替ロス'}],
 *             [{from: 'multi', to: 'sw'}, {from: 'sw', to: 'late'}])
 */
/** The words `roleTags` writes, by role. */
const ROLE_TAGS = { root: '根本原因', goal: 'ゴール', injection: '施策', start: '開始' };
export function causeTree(nodes, links, opts = {}) {
    return causeBand(nodes, links, opts);
}
/**
 * The entities and links of a transition tree written as units (current reality + need + action → new reality, the result being the next unit's current
 * reality): a 3-input AND for each unit, to be given to causeTree(nodes, links, {tree: 'tt'}).
 *   const {nodes, links} = transitionUnits([{id: 'u1', current: '受注順に着手している', need: '納期を守りたい', action: '着手の枠を決める', result: '仕掛りが見える'}, ...]);
 */
export function transitionUnits(units) {
    if (!Array.isArray(units) || units.length === 0)
        throw new Error('transitionUnits(units) needs at least one unit');
    const nodes = [], links = [], seen = new Set();
    const text = (u, key) => {
        const v = u[key];
        if (typeof v !== 'string' || !v.trim())
            throw new Error(`transitionUnits(): unit "${u.id}" needs a ${key} text`);
        return v;
    };
    units.forEach((u, i) => {
        if (typeof u.id !== 'string' || !u.id)
            throw new Error('transitionUnits(): every unit needs an id');
        if (seen.has(u.id))
            throw new Error(`transitionUnits(): duplicate unit id "${u.id}"`);
        seen.add(u.id);
        if (i === 0 && u.current === undefined)
            throw new Error(`transitionUnits(): the first unit "${u.id}" needs the current reality (current)`);
        if (i > 0 && u.current !== undefined)
            throw new Error(`transitionUnits(): unit "${u.id}" starts from the result of the unit before it: leave current out`);
        if (u.resultRole !== undefined && !(u.resultRole in CAUSE_ROLES))
            throw new Error(`transitionUnits(): unit "${u.id}" has resultRole ${String(u.resultRole)}`);
        const current = i === 0 ? `${u.id}.current` : units[i - 1].id;
        if (i === 0)
            nodes.push({ id: current, label: text(u, 'current'), role: 'precondition' });
        nodes.push({ id: `${u.id}.need`, label: text(u, 'need'), role: 'need' }, { id: `${u.id}.action`, label: text(u, 'action'), role: 'action' }, { id: u.id, label: text(u, 'result'), role: u.resultRole ?? 'io' });
        links.push({ from: [current, `${u.id}.need`, `${u.id}.action`], to: u.id });
    });
    return { nodes, links };
}
/** causeTree's body; pdpc() and relationDiagram() pass `base: 'down'` (their direction when `dir` is left out, from which they may also turn to 'right' to fit). */
function causeBand(nodes, links, opts, base, unanchored = []) {
    if (!Array.isArray(nodes) || nodes.length === 0)
        throw new Error('causeTree(nodes, links) needs at least one node');
    if (!Array.isArray(links))
        throw new Error('causeTree(nodes, links): links must be an array');
    if (opts.dir !== undefined && !['up', 'down', 'right', 'left', 'auto'].includes(opts.dir))
        throw new Error(`causeTree(): dir must be 'up', 'down', 'right', 'left' or 'auto' (got ${String(opts.dir)})`);
    if (opts.maxNodeW !== undefined && opts.maxNodeW !== 'auto' && !(opts.maxNodeW >= 80 && Number.isFinite(opts.maxNodeW)))
        throw new Error(`causeTree(): maxNodeW must be a number >= 80 or 'auto' (got ${String(opts.maxNodeW)})`);
    for (const l of links)
        if (l.line !== undefined && !['solid', 'dashed', 'dotted'].includes(l.line))
            throw new Error(`causeTree(): link to ${l.to} has line ${String(l.line)}`);
    if (opts.hop !== undefined && typeof opts.hop !== 'boolean' && opts.hop !== 'all')
        throw new Error(`causeTree(): hop must be true, false or 'all' (got ${String(opts.hop)})`);
    if (opts.fold !== undefined && typeof opts.fold !== 'boolean')
        throw new Error(`causeTree(): fold must be true or false (got ${String(opts.fold)})`);
    if (opts.straighten !== undefined && typeof opts.straighten !== 'boolean')
        throw new Error(`causeTree(): straighten must be true or false (got ${String(opts.straighten)})`);
    if (opts.returns !== undefined && opts.returns !== 'inline' && opts.returns !== 'outer')
        throw new Error(`causeTree(): returns must be 'inline' or 'outer' (got ${String(opts.returns)})`);
    for (const l of links) {
        if (l.kind !== undefined && l.kind !== 'cause' && l.kind !== 'blocks')
            throw new Error(`causeTree(): link to ${l.to} has kind ${String(l.kind)} (use 'cause' or 'blocks')`);
        if (l.kind === 'blocks' && typeof l.from !== 'string')
            throw new Error(`causeTree(): a 'blocks' link to ${l.to} needs one entity as its from (a string, not an AND)`);
        if (l.back === undefined)
            continue;
        if (l.back !== true)
            throw new Error(`causeTree(): link to ${l.to} has back ${String(l.back)} (write back: true, or leave it out)`);
        if (typeof l.from !== 'string')
            throw new Error(`causeTree(): a link to "${l.to}" is an AND (from is a list) and also back: true. A return is one arrow: write the link that returns on its own`);
    }
    for (const n of nodes) {
        if (n.role !== undefined && !(n.role in CAUSE_ROLES))
            throw new Error(`causeTree(): node "${n.id}" has role ${String(n.role)} (use ${Object.keys(CAUSE_ROLES).join(', ')})`);
        if (n.tone !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'].includes(n.tone))
            throw new Error(`causeTree(): node "${n.id}" has tone ${String(n.tone)}`);
    }
    if (opts.tree !== undefined && !['crt', 'frt', 'prt', 'tt', 'nbr'].includes(opts.tree))
        throw new Error(`causeTree(): tree must be 'crt', 'frt', 'prt', 'tt' or 'nbr' (got ${String(opts.tree)})`);
    if (opts.mirrors !== undefined && (opts.mirrors.type !== 'cause' || opts.mirrors.tree !== 'crt'))
        throw new Error("causeTree(): mirrors is the band causeTree() made for tree: 'crt' (the current reality tree this one answers)");
    for (const n of nodes)
        if (n.mirrors !== undefined && (typeof n.mirrors !== 'string' || !n.mirrors || (n.role !== 'de' && n.role !== 'goal')))
            throw new Error(`causeTree(): node "${n.id}" has mirrors ${JSON.stringify(n.mirrors)} (the id of a ude of the current reality tree; only a role: 'de' or 'goal' node takes it)`);
    if (opts.layer !== undefined && opts.layer !== 'asap' && opts.layer !== 'alap')
        throw new Error(`causeTree(): layer must be 'asap' or 'alap' (got ${String(opts.layer)})`);
    if (opts.roleTags !== undefined && opts.roleTags !== true && (typeof opts.roleTags !== 'object' || opts.roleTags === null || Object.entries(opts.roleTags).some(([k, v]) => !(k in ROLE_TAGS) || typeof v !== 'string' || !v.trim() || /[\r\n]/.test(v))))
        throw new Error(`causeTree(): roleTags is true, or an object with root / goal / injection / start, each a non-empty one-line text (got ${JSON.stringify(opts.roleTags)})`);
    if (opts.coreDriverLabel !== undefined && (typeof opts.coreDriverLabel !== 'string' || !opts.coreDriverLabel.trim() || /[\r\n]/.test(opts.coreDriverLabel)))
        throw new Error(`causeTree(): coreDriverLabel is a non-empty one-line text with {n} (the number reached) and {total} (the number of ude entities) (got ${JSON.stringify(opts.coreDriverLabel)})`);
    if (opts.coreDriver !== undefined && typeof opts.coreDriver !== 'boolean')
        throw new Error(`causeTree(): coreDriver must be true or false (got ${String(opts.coreDriver)})`);
    for (const n of nodes)
        if (n.foldsInto !== undefined && (n.role !== 'trim' || typeof n.foldsInto !== 'string' || !n.foldsInto.trim()))
            throw new Error(`causeTree(): node "${n.id}" has foldsInto ${JSON.stringify(n.foldsInto)} (foldsInto is a non-empty text, and only a role: 'trim' node takes it)`);
    // foldsInto is a line under the label (the injection it is folded into need not be in the figure): added here, so that it is measured with the label
    // roleTags: the words in front of the author's sub line (tag, then sub, then foldsInto / counts)
    const tagMap = opts.roleTags === undefined ? undefined : { ...ROLE_TAGS, ...(opts.roleTags === true ? {} : opts.roleTags) };
    const tagged = tagMap ? nodes.map(n => { const tag = n.role !== undefined && n.role in tagMap ? tagMap[n.role] : undefined; return tag ? { ...n, sub: `【${tag}】${n.sub ? `　${n.sub}` : ''}` } : n; }) : nodes;
    const noted = tagged.map(n => { if (n.foldsInto === undefined)
        return n; const { foldsInto, ...rest } = n; return { ...rest, sub: `${n.sub ? `${n.sub}　` : ''}→ ${foldsInto} に組み込む` }; });
    const udeTotal = nodes.filter(n => n.role === 'ude').length, coreLabel = (n) => (opts.coreDriverLabel ?? '{n}/{total} 件に届く').replaceAll('{n}', String(n)).replaceAll('{total}', String(udeTotal));
    const counted = opts.coreDriver ? reachCounts(nodes, links) : undefined, core = new Set(counted ? coreDrivers(counted) : []);
    const marked = counted ? noted.map(n => { const reach = counted.get(n.id); return reach === undefined || n.role === 'trim' ? n : { ...n, ...(core.has(n.id) ? { core: true } : {}), ...(opts.counts === false ? {} : { sub: `${n.sub ? `${n.sub}　` : ''}${coreLabel(reach)}` }) }; }) : noted;
    const band = { type: 'cause', nodes: [...marked], links: links.map(l => ({ ...l, ...(typeof l.from === 'string' ? {} : { from: [...l.from] }) })), ...(opts.dir === undefined ? (base === undefined ? {} : { dir: base, dirLeftOut: true }) : { dir: opts.dir }), ...(base === undefined ? {} : { base }), ...(opts.maxNodeW === undefined ? {} : { maxNodeW: opts.maxNodeW }), ...(opts.tree === undefined ? {} : { tree: opts.tree }), ...(tagMap === undefined ? {} : { roleTags: tagMap }), ...(opts.mirrors === undefined ? {} : { mirrorOf: { ids: opts.mirrors.nodes.map(n => n.id), udes: opts.mirrors.nodes.filter(n => n.role === 'ude').map(n => n.id) } }), ...(opts.layer === undefined ? {} : { layer: opts.layer }), ...(opts.returns === undefined ? {} : { returns: opts.returns }), ...(opts.hop === undefined ? (opts.tree === undefined ? {} : { hop: 'all' }) : { hop: opts.hop }), ...(opts.straighten === undefined ? {} : { straighten: opts.straighten }), ...(opts.fold === undefined || base !== undefined ? {} : { fold: opts.fold }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'causeTree()'), ...revealOf(opts) };
    if (unanchored.length)
        band.unanchored = [...unanchored];
    return withAnchors(withHandle(band, opts.id), nodes.map(n => n.id).filter(id => !unanchored.includes(id)));
}
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
export function bowtie(input, opts = {}) {
    bowtieCheck(input);
    if (opts.maxNodeW !== undefined && opts.maxNodeW !== 'auto' && !(typeof opts.maxNodeW === 'number' && Number.isFinite(opts.maxNodeW) && opts.maxNodeW >= 80))
        throw new Error(`bowtie(): maxNodeW must be a number >= 80 or 'auto' (got ${String(opts.maxNodeW)})`);
    const side = (s) => ({ label: s.label, ...(s.barriers === undefined ? {} : { barriers: [...s.barriers] }) });
    const band = { type: 'bowtie', ...(input.hazard === undefined ? {} : { hazard: input.hazard }), event: input.top, threats: input.threats.map(side), consequences: input.consequences.map(side), ...(opts.maxNodeW === undefined ? {} : { maxNodeW: opts.maxNodeW }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'bowtie()'), ...revealOf(opts) };
    return withHandle(band, opts.id);
}
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
/**
 * An affinity diagram (親和図): cards of ideas or facts gathered into groups, each group named by a short sentence (its 表札), and
 * larger groups made of smaller ones. Groups sit side by side (`cols`), cards stack inside a group (`cardCols` to put them in columns).
 *   affinity([{title: '準備が足りない', cards: ['段取りが決まっていない', '資料が古い']}, {title: '連絡が遅い', groups: [{title: '社内', cards: ['報告が遅れる']}]}])
 */
export function affinity(groups, opts = {}) {
    if (!Array.isArray(groups) || groups.length === 0)
        throw new Error('affinity(groups) needs at least one group');
    const cols = opts.cols ?? 3, cardCols = opts.cardCols ?? 1;
    for (const [k, v] of [['cols', cols], ['cardCols', cardCols]])
        if (!(Number.isInteger(v) && v >= 1 && v <= 6))
            throw new Error(`affinity(): ${k} must be a whole number from 1 to 6 (got ${v})`);
    const spanOf = (g, unit) => Math.min(unit, Math.max(1, g.groups?.length ?? 1));
    // a group made of smaller groups is as many columns wide as it has of them, so the small ones are not squeezed
    const build = (g, depth, span, unit) => {
        if (typeof g?.title !== 'string' || !g.title.trim())
            throw new Error('affinity(): every group needs a title (its 表札)');
        const cards = (g.cards ?? []).map(t => {
            if (typeof t !== 'string' || !t.trim())
                throw new Error(`affinity(): group "${g.title}" has an empty card`);
            return box({ body: t, tone: 'plain' });
        });
        if (!cards.length && !g.groups?.length)
            throw new Error(`affinity(): group "${g.title}" has no cards and no groups`);
        const inner = [...rows(g.groups ?? [], depth + 1, span), ...(cardCols > 1 && cards.length ? [grid(cards, { cols: cardCols })] : cards)];
        return group(inner, { title: g.title, tone: depth === 0 ? 'accent' : 'muted', dashed: false, ...(unit > 1 ? { span } : {}) });
    };
    // rows of `unit` columns, groups packed in order
    const rows = (list, depth, unit) => {
        const out = [];
        let cur = [], used = 0;
        const flush = () => { if (cur.length)
            out.push(row(cur, { cols: unit })); cur = []; used = 0; };
        for (const g of list) {
            const span = spanOf(g, unit);
            if (used + span > unit)
                flush();
            cur.push(build(g, depth, span, unit));
            used += span;
        }
        flush();
        return out;
    };
    return rows(groups, 0, cols);
}
export function pdpc(nodes, links, opts = {}) {
    if (!Array.isArray(nodes) || nodes.length === 0)
        throw new Error('pdpc(nodes, links) needs at least one node');
    const side = new Set((Array.isArray(nodes) ? nodes : []).filter(n => n.role === 'risk' || n.role === 'measure').map(n => n.id));
    for (const n of nodes ?? [])
        if (n.role !== undefined && !['start', 'step', 'risk', 'measure', 'goal'].includes(n.role))
            throw new Error(`pdpc(): node "${n.id}" has role ${String(n.role)} (use start, step, risk, measure or goal)`);
    const band = causeBand(nodes.map(n => ({ ...n, role: n.role ?? 'step' })), (links ?? []).map(l => ({ ...l, line: l.line ?? (side.has(l.from) || side.has(l.to) ? 'dashed' : 'solid') })), opts, 'down');
    return opts.returns === undefined ? Object.assign(band, { returnsDefault: 'outer' }) : band;
}
export function relationDiagram(nodes, links, opts = {}) {
    if (!Array.isArray(nodes) || nodes.length === 0)
        throw new Error('relationDiagram(nodes, links) needs at least one node');
    const ids = new Set(nodes.map(n => n.id)), problems = new Set(opts.problem === undefined ? [] : typeof opts.problem === 'string' ? [opts.problem] : opts.problem);
    for (const p of problems)
        if (!ids.has(p))
            throw new Error(`relationDiagram(): problem names unknown node "${p}"`);
    for (const l of links ?? [])
        if (typeof l.from !== 'string')
            throw new Error(`relationDiagram(): a link to "${l.to}" needs one cause as a string (use causeTree() for an AND)`);
    const out = new Map(nodes.map(n => [n.id, (links ?? []).filter(l => l.kind !== 'blocks' && l.from === n.id).length])), into = new Map(nodes.map(n => [n.id, (links ?? []).filter(l => l.kind !== 'blocks' && l.to === n.id).length]));
    const top = Math.max(0, ...nodes.filter(n => !problems.has(n.id) && n.role === undefined).map(n => out.get(n.id) ?? 0));
    const { problem: _p, counts, ...rest } = opts;
    return causeBand(nodes.map(n => ({
        ...n,
        role: n.role ?? (problems.has(n.id) ? 'ude' : top >= 2 && out.get(n.id) === top ? 'root' : 'effect'),
        ...(counts === false ? {} : { sub: `${n.sub ? `${n.sub}　` : ''}出 ${out.get(n.id)}・入 ${into.get(n.id)}` }),
    })), (links ?? []).map(l => ({ ...l })), rest, 'down');
}
export function cloud(boxes, opts = {}) {
    for (const k of ['a', 'b', 'c', 'd', 'd2'])
        if (boxes?.[k] == null)
            throw new Error(`cloud({a, b, c, d, d2}): box ${k} is missing`);
    if (opts.maxNodeW !== undefined && !(opts.maxNodeW >= 120 && Number.isFinite(opts.maxNodeW)))
        throw new Error(`cloud(): maxNodeW must be a number >= 120 (got ${opts.maxNodeW})`);
    for (const k of ['a', 'b', 'c', 'd', 'd2']) {
        const t = typeof boxes[k] === 'string' ? undefined : boxes[k].tone;
        if (t !== undefined && !['plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger'].includes(t))
            throw new Error(`cloud(): box ${k} has tone ${String(t)}`);
    }
    const band = { type: 'cloud', a: boxes.a, b: boxes.b, c: boxes.c, d: boxes.d, d2: boxes.d2, ...(opts.assumptions === undefined ? {} : { assumptions: opts.assumptions.map(a => ({ ...a })) }), ...(opts.conflictLabel === undefined ? {} : { conflictLabel: opts.conflictLabel }), ...(opts.maxNodeW === undefined ? {} : { maxNodeW: opts.maxNodeW }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'cloud()'), ...revealOf(opts) };
    return withAnchors(withHandle(band, opts.id), ['a', 'b', 'c', 'd', 'd2'].map(k => { const v = boxes[k]; return typeof v === 'string' ? undefined : v.id; }));
}
export function mindmap(root, opts = {}) {
    if (opts.sides)
        for (const [id, side] of Object.entries(opts.sides))
            if (side !== 'left' && side !== 'right')
                throw new Error(`mindmap(): sides.${id} must be 'left' or 'right' (got ${String(side)})`);
    const layouts = ['radial', 'right', 'left', 'down', 'up', 'org', 'list', 'brace', 'fishbone', 'timeline'];
    if (opts.layout !== undefined && !layouts.includes(opts.layout))
        throw new Error(`mindmap(): layout must be ${layouts.join(' | ')} (got ${String(opts.layout)})`);
    if (opts.edges !== undefined && !['elbow', 'curve', 'straight'].includes(opts.edges))
        throw new Error(`mindmap(): edges must be elbow | curve | straight (got ${String(opts.edges)})`);
    const band = tree(root, { ...(opts.maxNodeW === undefined ? {} : { maxNodeW: opts.maxNodeW }), ...(opts.id === undefined ? {} : { id: opts.id }), ...(opts.scope === undefined ? {} : { scope: opts.scope }), ...revealOf(opts) });
    Object.assign(band, { balanced: true, ...(opts.sides ? { sides: opts.sides } : {}), ...(opts.layout ? { layout: opts.layout } : {}), ...(opts.edges ? { edges: opts.edges } : {}) });
    return band;
}
export function faultTree(top, opts = {}) {
    if (opts.maxNodeW !== undefined && opts.maxNodeW !== 'auto' && !(typeof opts.maxNodeW === 'number' && Number.isFinite(opts.maxNodeW) && opts.maxNodeW >= 80))
        throw new Error(`faultTree(): maxNodeW must be a number >= 80 or 'auto' (got ${String(opts.maxNodeW)})`);
    if (opts.cutSets !== undefined && typeof opts.cutSets !== 'boolean')
        throw new Error(`faultTree(): cutSets is true or false (got ${String(opts.cutSets)})`);
    const { root } = ftaResolve(top); // every mistake in the tree throws here, naming the event
    if (opts.cutSets)
        ftaSinglePoints(root); // throws when the tree has too many cut sets to find them
    if (opts.quant !== undefined && typeof opts.quant !== 'boolean')
        throw new Error(`faultTree(): quant is true or false (got ${String(opts.quant)})`);
    if (opts.quantPeriod !== undefined && (typeof opts.quantPeriod !== 'string' || !opts.quantPeriod.trim() || !opts.quant))
        throw new Error('faultTree(): quantPeriod is a non-empty string, and goes with quant: true');
    if (opts.quant)
        ftaQuant(root, opts.quantPeriod); // throws for an event without p
    const band = { type: 'fta', root: top, ...(opts.maxNodeW === undefined ? {} : { maxNodeW: opts.maxNodeW }), ...(opts.cutSets === undefined ? {} : { cutSets: opts.cutSets }), ...(opts.quant === undefined ? {} : { quant: opts.quant }), ...(opts.quantPeriod === undefined ? {} : { quantPeriod: opts.quantPeriod }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'faultTree()'), ...revealOf(opts) };
    return withAnchors(withHandle(band, opts.id), ftaIds(top));
}
