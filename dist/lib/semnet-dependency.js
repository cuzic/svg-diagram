import { must } from './must.js';
import { checkText, fail, finiteNum, numText } from './charts-base.js';
import { textWidth } from './atoms.js';
import { arrow, direction, straightenOf, headBox, networkCanvas, nodeBox, pathOf, placeEdgeLabel, validateNodes } from './semnet-common.js';
export function resolveDependency(nodes, edges, opts = {}) {
    validateNodes('dependencyNetwork', nodes, opts.id);
    const ids = new Set(nodes.map(n => n.id));
    edges.forEach((e, i) => {
        if (!ids.has(e.from) || !ids.has(e.to))
            fail('dependencyNetwork', `edges[${i}] ${e.from} -> ${e.to} names unknown node`);
        checkText('dependencyNetwork', `edges[${i}].type`, e.type);
        if (e.weight !== undefined)
            finiteNum('dependencyNetwork', `edges[${i}].weight`, e.weight, { min: 0 });
    });
    return { nodes: nodes.map(n => ({ ...n })), edges: edges.map(e => ({ ...e })), direction: direction('dependencyNetwork', opts.direction), nodeKinds: { ...(opts.nodeKinds ?? {}) }, edgeTypes: { ...(opts.edgeTypes ?? {}) }, straighten: straightenOf('dependencyNetwork', opts.straighten) };
}
export const dependencyAlt = (s) => `Dependency network. ${s.edges.map(e => `${e.from} ${e.type} ${e.to}${e.weight === undefined ? '' : `, weight ${numText(e.weight)}`}`).join('; ')}`;
export function dependencyTexts(s) {
    const kinds = [...new Set(s.nodes.flatMap(n => n.kind ? [n.kind] : []))], types = [...new Set(s.edges.map(e => e.type))];
    return [...s.nodes.map(n => [n.label, 700]), ...s.edges.map(e => [[e.label ?? s.edgeTypes[e.type] ?? e.type, e.weight === undefined ? '' : numText(e.weight)].filter(Boolean).join(' '), 400]), ...kinds.map(k => [s.nodeKinds[k] ?? k, 400]), ...types.map(t => [s.edgeTypes[t] ?? t, 400])];
}
const kindTone = (i) => ['accent', 'danger', 'muted', 'text'][i % 4] ?? 'text';
/** How an edge type is drawn; the legend uses the same style. */
const edgeStyle = (type, ti) => ({ stroke: type === 'blocks' ? 'danger' : kindTone(ti), dash: type === 'uses' ? '8,5' : type === 'relates' ? '2,5' : type === 'blocks' ? '10,4,2,4' : ti > 3 ? (ti % 2 ? '8,5' : '2,5') : undefined });
export function layoutDependency(s, g) {
    const kinds = [...new Set(s.nodes.flatMap(n => n.kind ? [n.kind] : []))], types = [...new Set(s.edges.map(e => e.type))];
    // legend: node kinds then edge types, wrapped into rows that fit the width
    const items = [...kinds.map((k, i) => ({ kind: true, key: k, i, label: s.nodeKinds[k] ?? k })), ...types.map((t, i) => ({ kind: false, key: t, i, label: s.edgeTypes[t] ?? t }))];
    const rowH = g.size + 10, rows = [];
    let used = Infinity;
    for (const it of items) {
        const w = (it.kind ? 20 : 28) + textWidth(g.widthOf, it.label, g.size, 400) + 18;
        if (used + w - 18 > g.w - 8) {
            rows.push([]);
            used = 0;
        }
        must(rows.at(-1)).push(it);
        used += w;
    }
    const legendH = rows.length ? 34 + (rows.length - 1) * rowH : 0;
    const ns = s.nodes.map(n => ({ ...n, w: Math.max(116, textWidth(g.widthOf, n.label, g.size, 700) + 28), h: 52 })), { c, positions, paths } = networkCanvas(g, ns, s.edges, s.direction, legendH, s.straighten);
    // two stages: every line and box first, then the labels over them (a label drawn before a later edge's line would be struck through)
    const drawn = s.edges.map((e, i) => {
        const sw = e.weight === undefined ? 2 : Math.min(7, 1.5 + Math.sqrt(e.weight));
        const path = pathOf(paths, i, e, positions);
        arrow(c, path, { ...edgeStyle(e.type, types.indexOf(e.type)), sw, edge: e }, e.type !== 'relates');
        return { e, path, head: e.type === 'relates' ? [] : [headBox(path, sw)] };
    });
    const heads = drawn.flatMap(d => d.head);
    for (const n of s.nodes) {
        const p = must(positions.get(n.id)), ki = n.kind ? kinds.indexOf(n.kind) : -1, tone = ki < 0 ? 'text' : kindTone(ki), host = nodeBox(c, p, n.id, n.label, tone);
        c.text(n.label, p.x + p.w / 2, c.mid(p.y + p.h / 2), 'middle', 'text', { bold: true, host, of: n.id });
    }
    for (const { e, path } of drawn) {
        const text = [e.label ?? s.edgeTypes[e.type] ?? e.type, e.weight === undefined ? '' : numText(e.weight)].filter(Boolean).join(' ');
        // a label with no room is left out, as before (it does not change what the figure says, and stopping would break charts that draw today)
        placeEdgeLabel(c, text, path, m => [{ x: m.x, y: m.y - 6, anchor: 'middle' }, { x: m.x, y: m.y + g.size + 8, anchor: 'middle' }, { x: m.x + 12, y: m.y - 6, anchor: 'start' }], 'text', { plate: true }, heads);
    }
    rows.forEach((row, r) => {
        let x = c.x + 4;
        const base = c.y + c.h - 5 - (rows.length - 1 - r) * rowH;
        for (const [k, it] of row.entries())
            c.legendEntry(r * 100 + k, it.label, () => {
                if (it.kind) {
                    c.rect(x, base - g.size + 2, 14, 10, { fill: 'bg', stroke: kindTone(it.i), sw: 2 });
                    x += 20;
                }
                else {
                    c.line(x, base - 4, x + 22, base - 4, edgeStyle(it.key, it.i));
                    x += 28;
                }
                c.text(it.label, x, base, 'start', 'text');
                x += c.tw(it.label) + 18;
            });
    });
    return c.done();
}
