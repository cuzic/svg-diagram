import { id, items, list, mustExist, object, oneOf, text, uniqueIds } from '../spec-kit.js';
import { MAX_PERT_TASKS, withoutMarks, cycleOf } from './r3-common.js';
export function definePertPart(builder) {
    return {
        type: 'pert',
        anchors: 'tasks',
        description: 'A PERT network (activity on node): tasks with a duration and the tasks that must finish first. The earliest and latest start and finish, the slack and the critical path (zero slack, drawn in red) are worked out. No task may depend on itself, directly or round a circle.',
        schema: object({
            type: { const: 'pert' },
            tasks: list(object({
                id: id('Referred to by predecessors.'),
                label: text('The task.', 30),
                duration: { type: 'number', minimum: 0, maximum: 1e6, description: 'How long it takes, in `unit`.' },
                predecessors: list(id('A task id that must finish first.'), 8),
            }, ['id', 'label', 'duration']), MAX_PERT_TASKS, 1),
            unit: { type: 'string', maxLength: 6, description: "Written after every duration: '日', 'h', 'w'." },
            compact: { type: 'boolean', description: 'true: only the duration and the slack in each box, not ES / EF / LS / LF.' },
            direction: { ...oneOf('LR', 'TB'), description: 'LR: left to right (default); TB: top to bottom.' },
        }, ['type', 'tasks']),
        example: { type: 'pert', unit: '日', tasks: [{ id: 'a', label: '要件定義', duration: 5 }, { id: 'b', label: '設計', duration: 4, predecessors: ['a'] }, { id: 'c', label: '環境構築', duration: 2, predecessors: ['a'] }, { id: 'd', label: '実装', duration: 8, predecessors: ['b', 'c'] }] },
        check(part, at, issues) {
            const tasks = uniqueIds(part, 'tasks', at, issues);
            items(part, 'tasks').forEach((t, i) => {
                const ps = t['predecessors'] ?? [];
                ps.forEach((p, j) => {
                    mustExist(p, tasks, `${at}.tasks[${i}].predecessors[${j}]`, 'task id', issues);
                    if (ps.indexOf(p) !== j)
                        issues.push({ path: `${at}.tasks[${i}].predecessors[${j}]`, message: `"${String(p)}" is named twice` });
                });
            });
            const loop = cycleOf([...tasks], items(part, 'tasks').flatMap(t => (t['predecessors'] ?? []).map(p => [p, t['id']])));
            if (loop)
                issues.push({ path: `${at}.tasks`, message: `the predecessors go round in a circle: ${loop.join(' -> ')}` });
        },
        build(part) {
            const { tasks, ...opts } = withoutMarks(part);
            return builder(tasks, opts);
        },
        en: { durationLabel: 'Duration', slackLabel: 'Slack' },
    };
}
