import { LINE, MAX_NODE_WIDTH, id, items, list, mustExist, object, text, uniqueIds } from '../spec-kit.js';
import { MAX_RELATION_NODES, MAX_RELATION_LINKS, english, optionsOf } from './r4-common.js';
export function defineRelationDiagramPart(builder) {
    return {
        type: 'relationDiagram',
        anchors: 'nodes',
        description: "A relations diagram: the factors of a tangled problem and arrows from cause to effect, which may cross and go back. Each factor shows how many arrows leave and enter it; the factor with the most leaving arrows (2 or more) is marked as the key cause. `problem` names the result being analysed (red).",
        schema: object({
            type: { const: 'relationDiagram' },
            nodes: list(object({ id: id('Referred to by links.'), label: text('A factor, written as a statement.', 40), sub: text('A second, muted line.', 40) }, ['id', 'label']), MAX_RELATION_NODES, 2),
            links: list(object({ from: id('The cause.'), to: id('The effect.'), line: LINE }, ['from', 'to']), MAX_RELATION_LINKS, 1),
            problem: { oneOf: [id('The problem node.'), { type: 'array', items: id('A problem node.'), minItems: 1, maxItems: 3 }], description: 'The node id (or ids) of the problem being analysed.' },
            counts: { type: 'boolean', description: 'false: do not write the arrow counts under each factor.' },
            maxNodeW: MAX_NODE_WIDTH,
        }, ['type', 'nodes', 'links', 'problem']),
        example: { type: 'relationDiagram', problem: 'late', nodes: [{ id: 'late', label: '納期に遅れる' }, { id: 'rush', label: '急ぎの割り込み' }, { id: 'plan', label: '計画が守られない' }, { id: 'est', label: '見積もりが甘い' }], links: [{ from: 'est', to: 'plan' }, { from: 'plan', to: 'rush' }, { from: 'rush', to: 'late' }, { from: 'plan', to: 'late' }, { from: 'est', to: 'rush' }] },
        en: { lang: 'en' },
        check(part, at, issues) {
            const nodes = uniqueIds(part, 'nodes', at, issues), seen = new Set();
            items(part, 'links').forEach((l, i) => {
                mustExist(l['from'], nodes, `${at}.links[${i}].from`, 'node id', issues);
                mustExist(l['to'], nodes, `${at}.links[${i}].to`, 'node id', issues);
                if (l['from'] === l['to'])
                    issues.push({ path: `${at}.links[${i}].to`, message: 'is the same node as from' });
                const key = `${String(l['from'])}>${String(l['to'])}`;
                if (seen.has(key))
                    issues.push({ path: `${at}.links[${i}]`, message: 'repeats an earlier link' });
                seen.add(key);
            });
            const p = part['problem'];
            (Array.isArray(p) ? p : [p]).forEach((x, i) => mustExist(x, nodes, Array.isArray(p) ? `${at}.problem[${i}]` : `${at}.problem`, 'node id', issues));
        },
        build(part) {
            const { nodes, links, ...opts } = optionsOf(part);
            if (!english(part) || opts['counts'] === false)
                return builder(nodes, links, opts);
            // the builder writes the counts in Japanese: write them here in English, and let it mark the key cause as usual
            const ls = links, n = (id, end) => ls.filter(l => l[end] === id).length;
            const withCounts = nodes.map(x => ({ ...x, sub: `${x['sub'] ? `${String(x['sub'])}  ` : ''}Out ${n(x['id'], 'from')} · In ${n(x['id'], 'to')}` }));
            return builder(withCounts, ls, { ...opts, counts: false });
        },
    };
}
