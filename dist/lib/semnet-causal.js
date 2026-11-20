import { checkIds, checkText, fail } from './charts-base.js';
import { textWidth } from './atoms.js';
import { must } from './must.js';
import { analyzeCausalLoops } from './semnet-analysis.js';
import { checkRing, layoutRing } from './semnet-ring.js';
import { bandInset, planInterventions, ringSide } from './semnet-interventions.js';
import { arrow, direction, straightenOf, headBox, networkCanvas, nodeBox, pathOf, placeEdgeLabel, placePlated, touchesAny, validateNodes } from './semnet-common.js';
const POLARITIES = ['+', '-', 'same', 'opposite'];
function resolveInterventions(list, nodes, bandId) {
    if (list === undefined)
        return [];
    if (!Array.isArray(list))
        fail('causalLoop', 'interventions must be an array');
    const nodeIds = new Set(nodes.map(n => n.id)), ivIds = new Set(list.map(v => v?.id));
    const out = list.map((v, i) => {
        if (typeof v !== 'object' || v === null)
            fail('causalLoop', `interventions[${i}] must be an object {id, label, to, polarity}`);
        checkText('causalLoop', `interventions[${i}].id`, v.id);
        checkText('causalLoop', `intervention "${v.id}"'s label`, v.label);
        const to = typeof v.to === 'string' ? [v.to] : Array.isArray(v.to) ? [...v.to] : fail('causalLoop', `intervention "${v.id}": to must be a node id or an array of node ids`);
        if (!to.length)
            fail('causalLoop', `intervention "${v.id}": to needs at least one node id`);
        const ids = to.map((t, k) => {
            if (typeof t !== 'string')
                fail('causalLoop', `intervention "${v.id}": to[${k}] must be a node id (got ${String(t)})`);
            if (!nodeIds.has(t) && ivIds.has(t))
                fail('causalLoop', `intervention "${v.id}": an intervention cannot act on the intervention "${t}" (to takes node ids; intervention -> intervention is not supported)`);
            if (!nodeIds.has(t))
                fail('causalLoop', `intervention "${v.id}": to names unknown node "${t}" (nodes: ${[...nodeIds].join(', ')})`);
            if (to.indexOf(t) !== k)
                fail('causalLoop', `intervention "${v.id}": to lists node "${t}" twice`);
            return t;
        });
        if (!POLARITIES.includes(v.polarity))
            fail('causalLoop', `intervention "${v.id}" has invalid polarity "${String(v.polarity)}" (+, -, same or opposite; it is required)`);
        if (v.delay !== undefined && typeof v.delay !== 'boolean')
            fail('causalLoop', `intervention "${v.id}": delay must be true or false`);
        return { id: v.id, label: v.label, to: ids, polarity: v.polarity, delay: !!v.delay };
    });
    checkIds('causalLoop', [...nodes.map(n => n.id), ...out.map(v => v.id)], bandId);
    return out;
}
export function resolveCausal(nodes, links, opts = {}) {
    validateNodes('causalLoop', nodes, opts.id);
    const loops = analyzeCausalLoops(nodes.map(n => n.id), links), layout = opts.layout ?? 'layered';
    if (layout !== 'layered' && layout !== 'ring')
        fail('causalLoop', `layout must be 'layered' or 'ring' (got ${String(layout)})`);
    if (layout === 'ring')
        checkRing(nodes, links, loops, opts.direction);
    return { nodes: nodes.map(n => ({ ...n })), links: links.map(e => ({ ...e })), loops, direction: direction('causalLoop', opts.direction), interventions: resolveInterventions(opts.interventions, nodes, opts.id), layout, straighten: straightenOf('causalLoop', opts.straighten) };
}
/** R1, R2, B1, ...: loops are numbered within their kind. */
const loopNames = (loops) => { const n = { R: 0, B: 0 }; return loops.map(l => `${l.kind}${++n[l.kind]}`); };
const signText = (p) => p === 'same' ? '+' : p === 'opposite' ? '-' : p;
export const causalAlt = (s) => {
    const names = loopNames(s.loops), label = (id) => s.nodes.find(n => n.id === id)?.label ?? id;
    const iv = s.interventions.length ? ` Interventions: ${s.interventions.map(v => `${v.label} -> ${v.to.map(label).join(', ')} (${signText(v.polarity)}${v.delay ? ', delayed' : ''})`).join('; ')}.` : '';
    return `Causal loop diagram. ${s.loops.map((l, i) => `${names[i]}: ${l.nodes.join(' → ')}`).join('; ') || 'No loops.'}${iv}`;
};
export const causalTexts = (s) => [...s.nodes.map(n => [n.label, 700]), ...s.links.flatMap(e => [[e.polarity === 'same' ? '+' : e.polarity === 'opposite' ? '-' : e.polarity, 700], ...(e.delay ? [['||', 700]] : []), ...(e.label ? [[e.label, 400]] : [])]), ...loopNames(s.loops).map(n => [n, 700]), ...s.interventions.flatMap(v => [[v.label, 700], [signText(v.polarity), 700], ...(v.delay ? [['||', 700]] : [])])];
export function layoutCausal(s, g) {
    const ns = s.nodes.map(n => ({ ...n, w: Math.max(116, textWidth(g.widthOf, n.label, g.size, 700) + 28), h: 48 })), loop = s.layout === 'ring' ? s.loops.find(l => l.nodes.length > 1) : undefined;
    const selfs = s.links.flatMap((e, index) => e.from === e.to ? [{ index, node: e.from }] : []);
    const items = s.interventions.map(v => ({ id: v.id, label: v.label, to: v.to, w: textWidth(g.widthOf, v.label, g.size, 700) + 28 }));
    // the band is one edge: the top for LR, the left for TB, above and below a ring; the loop gets that much less room, and a thicker band when an arrow finds no way through
    const sideOf = (it) => loop ? ringSide(loop.nodes, it.to) : s.direction === 'TB' ? 'left' : 'top';
    let laid, plan;
    for (let attempt = 0;; attempt++) {
        const has = (side) => items.filter(it => sideOf(it) === side), inset = (side) => has(side).length ? bandInset(side, has(side), attempt) : 0;
        laid = loop ? layoutRing(g, ns, loop, selfs, items.length ? { top: inset('top'), bottom: inset('bottom') } : undefined)
            : { ...networkCanvas(g, ns, s.links, s.direction, 28, s.straighten, items.length ? { top: inset('top'), left: inset('left') } : undefined), centre: undefined };
        if (!items.length)
            break;
        plan = planInterventions(laid.c, items, laid.positions, sideOf);
        if ('placed' in plan)
            break;
        if (attempt === 3)
            fail('causalLoop', `${plan.problem} (even with a thicker band; shorten the intervention labels, name fewer targets, or give the loop more room with a larger width)`);
    }
    const { c, positions, paths, centre } = laid;
    // Stage 1: every line and every box. Stage 2: the signs and names, over the finished lines (a sign placed between two edges' lines would be struck through by the later one).
    const edges = s.links.map((e, i) => { const p = pathOf(paths, i, e, positions); arrow(c, p, { stroke: 'text', dash: undefined, ...(s.layout === 'ring' ? {} : { edge: e }) }); return { e, p }; });
    for (const n of s.nodes) {
        const p = must(positions.get(n.id)), host = nodeBox(c, p, n.id, n.label, 'text');
        c.text(n.label, p.x + p.w / 2, c.mid(p.y + p.h / 2), 'middle', 'text', { bold: true, host, of: n.id });
    }
    // the interventions: a dashed box (an anchor, like a node) and a dashed arrow to each target
    const ivEdges = [];
    for (const { item, box, arrows } of plan && 'placed' in plan ? plan.placed : []) {
        const v = must(s.interventions.find(x => x.id === item.id)), host = c.rect(box.x, box.y, box.w, box.h, { fill: 'bg', stroke: 'accent', sw: 2, dash: '6,4', id: v.id, of: v.id, solid: `intervention "${v.label}"` });
        c.text(v.label, box.x + box.w / 2, c.mid(box.y + box.h / 2), 'middle', 'text', { bold: true, host, of: v.id });
        for (const a of arrows) {
            arrow(c, a.path, { stroke: 'accent', dash: '6,4' });
            ivEdges.push({ e: { from: v.id, to: a.to, polarity: v.polarity, ...(v.delay ? { delay: true } : {}) }, p: a.path });
        }
    }
    const heads = [...edges, ...ivEdges].map(({ p }) => headBox(p));
    // what changes the meaning first (polarities, then delays), then the loop names, and the free text labels last
    // on a ring the first spots are straight out of / into the ring from the arc, where there is always room
    const radial = (m, text, bold = true) => {
        if (!centre)
            return [];
        const dx = m.x - centre.x, dy = m.y - centre.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, d = 13 + Math.abs(ux) * c.tw(text, bold) / 2;
        return [1, -1].map(k => ({ x: m.x + k * ux * d, y: c.mid(m.y + k * uy * 13), anchor: 'middle' }));
    };
    for (const { e, p } of edges)
        placePolarity(c, g, e, p, heads, radial);
    for (const { e, p } of edges)
        if (e.delay)
            placeDelay(c, g, e, p, heads, radial);
    for (const { e, p } of ivEdges)
        placePolarity(c, g, e, p, heads, () => []);
    for (const { e, p } of ivEdges)
        if (e.delay)
            placeDelay(c, g, e, p, heads, () => []);
    placeLoopNames(c, g, s.loops, positions, heads, centre);
    for (const { e, p } of edges)
        if (e.label)
            placeLabel(c, g, e.label, p, heads, radial);
    return c.done();
}
const signOf = (e) => e.polarity === 'same' ? '+' : e.polarity === 'opposite' ? '-' : e.polarity;
/** A polarity or a delay mark that finds no room stops the build: without it the figure says something else (R reads as B). More height or width does not help, the room is beside the edge. */
const noRoom = (what, e) => fail('causalLoop', `${what} of ${e.from} -> ${e.to} has no room (the figure is too dense around this link: drop a link or a node, or shorten the node labels; a larger height / width does not make room)`);
function placePolarity(c, g, e, p, heads, radial) {
    const sign = signOf(e);
    if (!placeEdgeLabel(c, sign, p, m => [...radial(m, sign), { x: m.x, y: m.y - 6, anchor: 'middle' }, { x: m.x, y: m.y + g.size + 8, anchor: 'middle' }, { x: m.x + 12, y: m.y - 6, anchor: 'start' }], sign === '-' ? 'danger' : 'accent', { bold: true, plate: true }, heads))
        noRoom(`the polarity "${sign}"`, e);
}
function placeDelay(c, g, e, p, heads, radial) {
    if (!placeEdgeLabel(c, '||', p, m => [...radial(m, '||'), { x: m.x, y: m.y + g.size + 8, anchor: 'middle' }, { x: m.x + 14, y: m.y + g.size + 8, anchor: 'start' }], 'muted', { bold: true, plate: true }, heads))
        noRoom('the delay mark "||"', e);
}
/** An edge's free text label: left out when there is no room (it does not change what the figure says; stopping would break figures that draw today). */
function placeLabel(c, g, text, p, heads, radial) {
    placeEdgeLabel(c, text, p, m => [...radial(m, text, false), { x: m.x + 12, y: m.y - 6, anchor: 'start' }, { x: m.x, y: m.y + g.size + 8, anchor: 'middle' }], 'text', { plate: true }, heads);
}
/** R1 / B1 under the loop's lowest node; when a sign is already there: above the loop, at its centre, then outwards in 8px steps. Nothing free: where it used to go (the check reports it). */
function placeLoopNames(c, g, loops, positions, heads, centre) {
    const names = loopNames(loops);
    loops.forEach((l, i) => {
        const ps = l.nodes.map(id => must(positions.get(id))), x = ps.reduce((a, p) => a + p.x + p.w / 2, 0) / ps.length, bottom = Math.max(...ps.map(p => p.y + p.h)), top = Math.min(...ps.map(p => p.y));
        const home = { x, y: Math.min(c.y + c.h - 5, bottom + g.size + 6), anchor: 'middle' }, cands = [home, { x, y: top - 6, anchor: 'middle' }, { x, y: c.mid(ps.reduce((a, p) => a + p.y + p.h / 2, 0) / ps.length), anchor: 'middle' }];
        if (centre && l.nodes.length > 1)
            cands.unshift({ x: centre.x, y: c.mid(centre.y), anchor: 'middle' }); // a ring: the name goes in the middle
        for (let k = 1; k <= 12; k++) {
            const ring = [[0, k], [0, -k], [k, 0], [-k, 0]];
            for (const [dx, dy] of ring)
                cands.push({ ...home, x: x + dx * 8, y: home.y + dy * 8 });
        }
        const name = must(names[i]);
        placePlated(c, name, cands, l.kind === 'R' ? 'accent' : 'danger', { bold: true, plate: true }, b => !touchesAny(b, heads)) ?? c.text(name, home.x, home.y, 'middle', l.kind === 'R' ? 'accent' : 'danger', { bold: true, plate: true });
    });
}
