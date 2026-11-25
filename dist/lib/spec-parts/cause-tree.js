import { EMPHASIS_TONE, LINE, MAX_CAUSE_LINKS, MAX_CAUSE_NODES, MAX_NODE_WIDTH, id, items, list, mustExist, object, oneOf, text, uniqueIds, withoutType } from '../spec-kit.js';
export function defineCauseTreePart(builder) {
    return {
        type: 'causeTree',
        anchors: 'nodes',
        description: "A Theory of Constraints logic tree or another cause-and-effect diagram: boxes joined by arrows from cause to effect. Set `tree`: 'crt' for a Current Reality Tree (undesirable effects as role ude at the top, root causes as role root at the bottom), 'frt' for a Future Reality Tree (changes as role injection, results as role de, facts nobody controls as role precondition), 'prt' for a Prerequisite Tree, 'tt' for a Transition Tree, 'nbr' for a Negative Branch. Give a link an array as `from` when the causes are only sufficient together (AND). Saying `tree` also turns on the checks for that kind of tree.",
        schema: object({
            type: { const: 'causeTree' },
            nodes: list(object({
                id: id('Referred to by links.'),
                label: text('One entity, written as a statement.'),
                sub: text('A second, muted line.'),
                role: { ...oneOf('effect', 'ude', 'root', 'de', 'injection', 'precondition', 'goal', 'obstacle', 'io', 'action', 'need', 'tipping', 'trim'), description: "ude: undesirable effect. root: root cause. de: desirable effect. injection: the change put in. precondition: a fact nobody controls. goal, obstacle, io (intermediate objective): prerequisite tree. action, need: transition tree. tipping, trim: negative branch. Default effect." },
                tone: EMPHASIS_TONE,
            }, ['id', 'label']), MAX_CAUSE_NODES, 1),
            links: list(object({
                from: { oneOf: [id('The cause.'), { type: 'array', items: id('A cause.'), minItems: 2, maxItems: 5, description: 'Causes that are sufficient only together (AND).' }], description: 'A node id, or several for an AND.' },
                to: id('The effect.'),
                line: LINE,
                kind: { ...oneOf('cause', 'blocks'), description: 'blocks: this entity cuts that one (a negative branch). Needs a single cause.' },
                back: { enum: [true], description: 'true: the return arrow of a loop. Needs a single cause; one per cycle.' },
            }, ['from', 'to']), MAX_CAUSE_LINKS),
            tree: { ...oneOf('crt', 'frt', 'prt', 'tt', 'nbr'), description: 'Which kind of tree this is. It does not change the drawing; it turns on the checks for that kind.' },
            dir: { ...oneOf('up', 'down', 'right', 'left', 'auto'), description: 'The way the arrows run (default up: causes at the bottom).' },
            coreDriver: { type: 'boolean', description: 'true: mark the starting entity that reaches the most undesirable effects.' },
            coreDriverLabel: text("The line under each starting entity with coreDriver: '{n}' is how many undesirable effects it reaches, '{total}' all of them.", 40),
            maxNodeW: MAX_NODE_WIDTH,
        }, ['type', 'nodes', 'links']),
        example: { type: 'causeTree', tree: 'crt', nodes: [{ id: 'late', label: '納期に遅れる', role: 'ude' }, { id: 'wip', label: '仕掛りが多い' }, { id: 'kpi', label: '稼働率で評価される', role: 'root' }], links: [{ from: 'kpi', to: 'wip' }, { from: 'wip', to: 'late' }] },
        check(part, at, issues) {
            const nodes = uniqueIds(part, 'nodes', at, issues);
            items(part, 'links').forEach((l, i) => {
                const from = l['from'];
                if (Array.isArray(from)) {
                    from.forEach((c, j) => mustExist(c, nodes, `${at}.links[${i}].from[${j}]`, 'node id', issues));
                    for (const key of ['kind', 'back'])
                        if (l[key] !== undefined && !(key === 'kind' && l[key] === 'cause'))
                            issues.push({ path: `${at}.links[${i}].${key}`, message: 'needs a single cause, not an AND' });
                }
                else
                    mustExist(from, nodes, `${at}.links[${i}].from`, 'node id', issues);
                mustExist(l['to'], nodes, `${at}.links[${i}].to`, 'node id', issues);
            });
        },
        build(part) {
            const { nodes, links, ...opts } = withoutType(part);
            return builder(nodes, links, opts);
        },
    };
}
