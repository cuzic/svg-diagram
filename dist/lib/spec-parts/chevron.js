import { flowSteps, items, object, oneOf, withoutType } from '../spec-kit.js';
export function defineChevronPart(builder) {
    return {
        type: 'chevron',
        description: 'Process steps as arrow shapes in a row (or a column): a sequence with no branches, such as the phases of a project. `current` marks the step in progress.',
        schema: object({
            type: { const: 'chevron' },
            steps: flowSteps(2, 8),
            direction: oneOf('horizontal', 'vertical'),
            current: { type: 'integer', minimum: 1, maximum: 8, description: 'The step in progress, from 1.' },
        }, ['type', 'steps']),
        example: { type: 'chevron', steps: [{ label: '計画', sub: '要件を確認' }, { label: '実装', sub: '小さく作る' }, { label: '検証', sub: '品質を確認' }, { label: '公開', sub: '利用を開始' }], current: 3 },
        check(part, at, issues) {
            const n = items(part, 'steps').length, c = part['current'];
            if (typeof c === 'number' && c > n)
                issues.push({ path: `${at}.current`, message: `is ${c}, but there are ${n} steps` });
        },
        build(part) {
            // the spec counts steps from 1 (as `steps` and loopBack do); chevron() takes a zero-based index
            const { steps, current, ...opts } = withoutType(part);
            return builder(steps, { ...opts, ...(typeof current === 'number' ? { current: current - 1 } : {}) });
        },
    };
}
