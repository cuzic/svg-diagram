import { CAUSE_ROLES } from '../cause-roles.js';
import { graphTones, resolveFocus } from '../focus.js';
import { must } from '../must.js';
import { coreDrivers, reachCounts } from '../toc-analysis.js';
import { revealOf, scopeOpt, TREE_TONES, withAnchors, withHandle } from './shared.js';
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
export function causeBand(nodes, links, opts, base, unanchored = []) {
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
        if (n.tone !== undefined && !TREE_TONES.includes(n.tone))
            throw new Error(`causeTree(): node "${n.id}" has tone ${String(n.tone)} (use ${TREE_TONES.join(', ')})`);
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
    if (opts.coreBadge !== undefined && (typeof opts.coreBadge !== 'string' || !opts.coreBadge.trim() || opts.coreBadge.length > 6))
        throw new Error(`causeTree(): coreBadge must be a short word (at most 6 characters; got ${JSON.stringify(opts.coreBadge)})`);
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
    const band = { type: 'cause', ...(opts.coreBadge === undefined ? {} : { coreBadge: opts.coreBadge }), nodes: [...marked], links: links.map(l => ({ ...l, ...(typeof l.from === 'string' ? {} : { from: [...l.from] }) })), ...(opts.dir === undefined ? (base === undefined ? {} : { dir: base, dirLeftOut: true }) : { dir: opts.dir }), ...(base === undefined ? {} : { base }), ...(opts.maxNodeW === undefined ? {} : { maxNodeW: opts.maxNodeW }), ...(opts.tree === undefined ? {} : { tree: opts.tree }), ...(tagMap === undefined ? {} : { roleTags: tagMap }), ...(opts.mirrors === undefined ? {} : { mirrorOf: { ids: opts.mirrors.nodes.map(n => n.id), udes: opts.mirrors.nodes.filter(n => n.role === 'ude').map(n => n.id) } }), ...(opts.layer === undefined ? {} : { layer: opts.layer }), ...(opts.returns === undefined ? {} : { returns: opts.returns }), ...(opts.hop === undefined ? (opts.tree === undefined ? {} : { hop: 'all' }) : { hop: opts.hop }), ...(opts.straighten === undefined ? {} : { straighten: opts.straighten }), ...(opts.fold === undefined || base !== undefined ? {} : { fold: opts.fold }), ...(opts.id === undefined ? {} : { id: opts.id }), ...scopeOpt(opts, 'causeTree()'), ...revealOf(opts) };
    if (unanchored.length)
        band.unanchored = [...unanchored];
    if (opts.focus !== undefined) {
        const ids = band.nodes.map(n => n.id), hit = resolveFocus(opts.focus, ids, 'causeTree()');
        const pairs = band.links.flatMap(l => (typeof l.from === 'string' ? [l.from] : l.from).map(f => [ids.indexOf(f), ids.indexOf(l.to)]));
        const tones = graphTones(ids.length, pairs, hit);
        band.nodes = band.nodes.map((n, i) => ({ ...n, tone: must(tones[i]) }));
        band.focused = [...hit].map(i => must(ids[i]));
    }
    return withAnchors(withHandle(band, opts.id), nodes.map(n => n.id).filter(id => !unanchored.includes(id)));
}
export function pdpc(nodes, links, opts = {}) {
    if (!Array.isArray(nodes) || nodes.length === 0)
        throw new Error('pdpc(nodes, links) needs at least one node');
    const side = new Set((Array.isArray(nodes) ? nodes : []).filter(n => n.role === 'risk' || n.role === 'measure').map(n => n.id));
    for (const n of nodes ?? [])
        if (n.role !== undefined && !['start', 'step', 'risk', 'measure', 'goal'].includes(n.role))
            throw new Error(`pdpc(): node "${n.id}" has role ${String(n.role)} (use start, step, risk, measure or goal)`);
    const band = causeBand(nodes.map(n => ({ ...n, role: n.role ?? 'step' })), (links ?? []).map(l => ({ ...l, line: l.line ?? (side.has(l.from) || side.has(l.to) ? 'dashed' : 'solid') })), opts, 'down');
    band.origin = 'pdpc';
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
    return Object.assign(causeBand(nodes.map(n => ({
        ...n,
        role: n.role ?? (problems.has(n.id) ? 'ude' : top >= 2 && out.get(n.id) === top ? 'root' : 'effect'),
        ...(counts === false ? {} : { sub: `${n.sub ? `${n.sub}　` : ''}出 ${out.get(n.id)}・入 ${into.get(n.id)}` }),
    })), (links ?? []).map(l => ({ ...l })), rest, 'down'), { origin: 'relation' });
}
