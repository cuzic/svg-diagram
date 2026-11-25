import { EMPHASIS_TONE, LINE, id, items, list, mustExist, object, oneOf, text, uniqueIds, withoutType } from '../spec-kit.js';
export function defineStateDiagramPart(builder) {
    return {
        type: 'stateDiagram',
        anchors: 'states',
        description: 'A state diagram: the states something goes through and the events that move it, such as an order or a ticket. `initial` draws the start dot; a final state has a double outline.',
        schema: object({
            type: { const: 'stateDiagram' },
            states: list(object({
                id: id('Referred to by transitions.'),
                label: text('The state.', 40),
                sub: text('A second, muted line.', 60),
                tone: EMPHASIS_TONE,
                final: { type: 'boolean', description: 'true: an end state (double outline).' },
            }, ['id', 'label']), 25, 1),
            transitions: list(object({
                from: id('A state id.'),
                to: id('A state id (the same one for a loop).'),
                label: text('The event or condition.', 40),
                line: LINE,
                tone: oneOf('danger', 'accent', 'muted'),
            }, ['from', 'to']), 40),
            initial: id('The state that starts.'),
            dir: { ...oneOf('right', 'down', 'auto'), description: 'The direction of the flow (default right, turning when it does not fit).' },
        }, ['type', 'states', 'transitions']),
        example: { type: 'stateDiagram', initial: 'new', states: [{ id: 'new', label: '受付済み' }, { id: 'paid', label: '入金済み' }, { id: 'done', label: '完了', final: true }], transitions: [{ from: 'new', to: 'paid', label: '入金' }, { from: 'paid', to: 'done', label: '出荷' }] },
        check(part, at, issues) {
            const states = uniqueIds(part, 'states', at, issues);
            items(part, 'transitions').forEach((t, i) => {
                mustExist(t['from'], states, `${at}.transitions[${i}].from`, 'state id', issues);
                mustExist(t['to'], states, `${at}.transitions[${i}].to`, 'state id', issues);
            });
            if (part['initial'] !== undefined)
                mustExist(part['initial'], states, `${at}.initial`, 'state id', issues);
        },
        build(part) {
            const { states, transitions, ...opts } = withoutType(part);
            return builder(states, transitions, opts);
        },
    };
}
