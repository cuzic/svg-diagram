import { items, list, object, text } from '../spec-kit.js';
import { MAX_WHY_CHAINS, MAX_WHY_STEPS } from './r7-common.js';
export function defineWhyWhyTablePart(builder) {
    return {
        type: 'whyWhyTable',
        description: 'A why-why analysis as a table: the problem in the first column, then each chain of answers to "why?" across a row (why 1, why 2, ...), its root cause and what is done about it. Use it when the chains do not branch much; whyWhyTree draws the same analysis as a tree. A cause two chains share is written in each row.',
        schema: object({
            type: { const: 'whyWhyTable' },
            problem: text('The problem that happened.', 60),
            chains: list(object({
                whys: list(text('The answer to "why?" at this step: a fact, written as a statement.', 50), MAX_WHY_STEPS, 1),
                trueCause: text('The root cause this chain ends in.', 50),
                measure: text('What is done about the root cause.', 50),
            }, ['whys']), MAX_WHY_CHAINS, 1),
            title: text('A title bar over the table.', 40),
        }, ['type', 'problem', 'chains']),
        example: { type: 'whyWhyTable', problem: 'リリースが遅れた', chains: [{ whys: ['修正に時間がかかった', '影響範囲が広かった', '検証が最後に集中していた'], trueCause: '検証を早い段階でしていない', measure: '結合テストを毎週回す' }] },
        en: { labels: { problem: 'Problem', why: 'Why', trueCause: 'Root cause', measure: 'Measure' } },
        check(part, at, issues) {
            items(part, 'chains').forEach((c, i) => {
                if (c['measure'] !== undefined && c['trueCause'] === undefined)
                    issues.push({ path: `${at}.chains[${i}].measure`, message: 'needs a trueCause: a measure without a root cause treats the symptom' });
            });
        },
        build(part) {
            const { type: _t, problem, chains, ...opts } = part;
            return builder(problem, chains, opts);
        },
    };
}
