import { LINE, id, items, list, mustExist, object, oneOf, text, uniqueIds, withoutType } from '../spec-kit.js';
export function defineFlowchartPart(builder) {
    return {
        type: 'flowchart',
        anchors: 'nodes',
        description: 'A flowchart: steps, decisions (a diamond holding the question) and start / end pills joined by arrows. Use for a process with branches or loops. Put Yes / No on the edges that leave a decision.',
        schema: object({
            type: { const: 'flowchart' },
            nodes: list(object({
                id: id('Referred to by edges.'),
                label: text('The text of the node.'),
                sub: text('A second, muted line.'),
                kind: { ...oneOf('process', 'decision', 'terminator'), description: 'process: a step (default). decision: a diamond. terminator: a start / end pill.' },
                tone: oneOf('plain', 'accent', 'new', 'changed', 'removed', 'muted', 'danger', 'solid', 'solid-danger'),
            }, ['id', 'label']), 40, 1),
            edges: list(object({
                from: id('A node id.'),
                to: id('A node id.'),
                label: text('The condition on the arrow.', 60),
                line: LINE,
                tone: oneOf('danger', 'accent', 'muted'),
                strong: { type: 'boolean', description: 'A thick arrow.' },
            }, ['from', 'to']), 60),
            dir: { ...oneOf('right', 'down', 'auto'), description: 'The direction of the flow (default: down, turning when it does not fit).' },
        }, ['type', 'nodes', 'edges']),
        example: { type: 'flowchart', nodes: [{ id: 'start', kind: 'terminator', label: '受付' }, { id: 'q', kind: 'decision', label: '在庫はある？' }, { id: 'ship', label: '発送する' }, { id: 'order', label: '取り寄せる' }], edges: [{ from: 'start', to: 'q' }, { from: 'q', to: 'ship', label: 'Yes' }, { from: 'q', to: 'order', label: 'No' }] },
        check(part, at, issues) {
            const nodes = uniqueIds(part, 'nodes', at, issues);
            items(part, 'edges').forEach((e, i) => {
                mustExist(e['from'], nodes, `${at}.edges[${i}].from`, 'node id', issues);
                mustExist(e['to'], nodes, `${at}.edges[${i}].to`, 'node id', issues);
            });
        },
        build(part) {
            const { nodes, edges, ...opts } = withoutType(part);
            return builder(nodes, edges, opts);
        },
    };
}
