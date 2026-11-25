import { BOX_TONE, EMPHASIS_TONE, id, items, list, mustExist, object, oneOf, text, uniqueIds } from '../spec-kit.js';
import { MAX_BPMN_NODES, MAX_BPMN_FLOWS, withoutMarks } from './r3-common.js';
export function defineBpmnPart(builder) {
    return {
        type: 'bpmn',
        anchors: 'nodes',
        description: "A business process in BPMN style: lanes (who) as rows, tasks, a start and an end event, and gateways (xor: one way, and: all ways in parallel, or: some ways) joined by flows. A flow out of a gateway carries its condition as a label; a dashed flow is a message between lanes. The columns follow the flow; a wide figure is narrowed to fit.",
        schema: object({
            type: { const: 'bpmn' },
            lanes: list(object({ id: id('Referred to by nodes.'), label: text('Who works in the lane.', 30), tone: BOX_TONE }, ['id', 'label']), 8, 1),
            nodes: list(object({
                id: id('Referred to by flows.'),
                lane: id('A lane id.'),
                kind: { ...oneOf('task', 'start', 'end', 'xor', 'and', 'or'), description: 'task (default), start / end event, or a gateway: xor (exclusive), and (parallel), or (inclusive).' },
                label: text('The task (required for a task); under the shape for an event or a gateway.', 40),
                sub: text('A second, muted line of a task.', 40),
                tone: EMPHASIS_TONE,
            }, ['id', 'lane']), MAX_BPMN_NODES, 1),
            flows: list(object({
                from: id('A node id.'),
                to: id('A node id.'),
                label: text('The condition, on a flow out of a gateway.', 30),
                line: { ...oneOf('solid', 'dashed'), description: 'dashed: a message between lanes.' },
            }, ['from', 'to']), MAX_BPMN_FLOWS),
        }, ['type', 'lanes', 'nodes', 'flows']),
        example: { type: 'bpmn', lanes: [{ id: 'c', label: '顧客' }, { id: 's', label: '店舗' }], nodes: [{ id: 'st', lane: 'c', kind: 'start', label: '注文' }, { id: 'chk', lane: 's', label: '在庫を確認' }, { id: 'g', lane: 's', kind: 'xor' }, { id: 'ship', lane: 's', label: '発送する' }, { id: 'sorry', lane: 's', label: 'お詫びを送る' }, { id: 'e', lane: 'c', kind: 'end' }], flows: [{ from: 'st', to: 'chk' }, { from: 'chk', to: 'g' }, { from: 'g', to: 'ship', label: '在庫あり' }, { from: 'g', to: 'sorry', label: '在庫なし' }, { from: 'ship', to: 'e' }, { from: 'sorry', to: 'e', line: 'dashed' }] },
        check(part, at, issues) {
            const lanes = uniqueIds(part, 'lanes', at, issues), nodes = uniqueIds(part, 'nodes', at, issues);
            items(part, 'nodes').forEach((n, i) => {
                mustExist(n['lane'], lanes, `${at}.nodes[${i}].lane`, 'lane id', issues);
                if ((n['kind'] ?? 'task') === 'task' && n['label'] === undefined)
                    issues.push({ path: `${at}.nodes[${i}].label`, message: 'is required for a task' });
                if (n['sub'] !== undefined && (n['kind'] ?? 'task') !== 'task')
                    issues.push({ path: `${at}.nodes[${i}].sub`, message: 'is only for a task' });
            });
            const kind = new Map(items(part, 'nodes').map(n => [n['id'], n['kind'] ?? 'task']));
            items(part, 'flows').forEach((f, i) => {
                mustExist(f['from'], nodes, `${at}.flows[${i}].from`, 'node id', issues);
                mustExist(f['to'], nodes, `${at}.flows[${i}].to`, 'node id', issues);
                if (f['from'] === f['to'] && typeof f['from'] === 'string')
                    issues.push({ path: `${at}.flows[${i}].to`, message: 'is the node the flow starts at: go back through a gateway instead' });
                if (kind.get(f['from']) === 'end')
                    issues.push({ path: `${at}.flows[${i}].from`, message: `"${String(f['from'])}" is an end event: nothing flows out of it` });
                if (kind.get(f['to']) === 'start')
                    issues.push({ path: `${at}.flows[${i}].to`, message: `"${String(f['to'])}" is a start event: nothing flows into it` });
            });
        },
        build(part) {
            const { lanes, nodes, flows } = withoutMarks(part);
            return builder(lanes, nodes, flows, { fit: 'shrink' });
        },
    };
}
