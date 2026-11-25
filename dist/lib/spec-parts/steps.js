import { BOX_TONE, LINE, count, items, list, object, oneOf, text, withoutType } from '../spec-kit.js';
export function defineStepsPart(builder) {
    return {
        type: 'steps',
        description: 'Things done in order, with no dates: a row of boxes (title, body, tag) joined by arrows, numbered if wanted, one of them emphasised, and arrows back to earlier steps (loopBack) for rework.',
        schema: object({
            type: { const: 'steps' },
            items: list(object({ title: text('The step.', 30), body: text('A second, smaller line.', 80), tag: text('A short tag on the corner.', 12), tone: BOX_TONE }, ['title']), 6, 2),
            numbered: { type: 'boolean', description: 'true: number the steps 1, 2, 3.' },
            highlight: count('The step to emphasise, from 1.', 6),
            highlightTone: oneOf('danger', 'accent'),
            loopBack: list(object({ from: count('The later step the arrow leaves, from 1.', 6), to: count('The earlier step it returns to, from 1.', 6), label: text('The text on the arrow.', 20), line: LINE }, ['from', 'to']), 3),
        }, ['type', 'items']),
        example: { type: 'steps', numbered: true, items: [{ title: '申請' }, { title: '審査' }, { title: '承認' }, { title: '実行' }], loopBack: [{ from: 3, to: 1, label: '差し戻し' }] },
        check(part, at, issues) {
            const n = items(part, 'items').length;
            if (typeof part['highlight'] === 'number' && part['highlight'] > n)
                issues.push({ path: `${at}.highlight`, message: `is step ${part['highlight']}, but there are ${n} steps` });
            items(part, 'loopBack').forEach((l, i) => {
                for (const k of ['from', 'to'])
                    if (l[k] > n)
                        issues.push({ path: `${at}.loopBack[${i}].${k}`, message: `is step ${String(l[k])}, but there are ${n} steps` });
                if (l['from'] <= l['to'])
                    issues.push({ path: `${at}.loopBack[${i}]`, message: 'goes back: from must be a later step than to' });
            });
        },
        build(part) {
            const { items: list, ...opts } = withoutType(part);
            return builder(list, opts);
        },
        en: { stepWord: 'Step' },
    };
}
