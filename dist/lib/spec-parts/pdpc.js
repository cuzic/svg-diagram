import { EMPHASIS_TONE, LINE, MAX_CAUSE_LINKS, MAX_CAUSE_NODES, MAX_NODE_WIDTH, id, items, list, mustExist, object, oneOf, text, uniqueIds } from '../spec-kit.js';
import { optionsOf } from './r4-common.js';
export function definePdpcPart(builder) {
    return {
        type: 'pdpc',
        anchors: 'nodes',
        description: 'A PDPC (process decision program chart): the steps from the start to the goal, what could go wrong on the way (role risk, a hexagon) and what to do then (role measure). The main path is solid; arrows into or out of a risk or a measure are dashed. A measure usually leads back to a step or on to the goal.',
        schema: object({
            type: { const: 'pdpc' },
            nodes: list(object({
                id: id('Referred to by links.'),
                label: text('The step, risk or measure.', 60),
                sub: text('A second, muted line.', 60),
                role: { ...oneOf('start', 'step', 'risk', 'measure', 'goal'), description: 'Default step.' },
                tone: EMPHASIS_TONE,
            }, ['id', 'label']), MAX_CAUSE_NODES, 2),
            links: list(object({ from: id('A node id.'), to: id('A node id.'), line: LINE }, ['from', 'to']), MAX_CAUSE_LINKS, 1),
            dir: { ...oneOf('down', 'right'), description: 'down (default): from the top; right: from the left.' },
            maxNodeW: MAX_NODE_WIDTH,
        }, ['type', 'nodes', 'links']),
        example: { type: 'pdpc', nodes: [{ id: 's', label: '着手', role: 'start' }, { id: 'a', label: '試作する' }, { id: 'r', label: '強度が足りない', role: 'risk' }, { id: 'm', label: '材質を変える', role: 'measure' }, { id: 'g', label: '量産開始', role: 'goal' }], links: [{ from: 's', to: 'a' }, { from: 'a', to: 'g' }, { from: 'a', to: 'r' }, { from: 'r', to: 'm' }, { from: 'm', to: 'a' }] },
        check(part, at, issues) {
            const nodes = uniqueIds(part, 'nodes', at, issues);
            items(part, 'links').forEach((l, i) => {
                mustExist(l['from'], nodes, `${at}.links[${i}].from`, 'node id', issues);
                mustExist(l['to'], nodes, `${at}.links[${i}].to`, 'node id', issues);
                if (l['from'] === l['to'])
                    issues.push({ path: `${at}.links[${i}].to`, message: 'is the same node as from' });
            });
            const roles = items(part, 'nodes').map(n => n['role']);
            if (!roles.includes('goal'))
                issues.push({ path: `${at}.nodes`, message: "needs a node with role 'goal': the PDPC is the way to it" });
        },
        build(part) {
            const { nodes, links, ...opts } = optionsOf(part);
            return builder(nodes, links, opts);
        },
    };
}
