import { ARROW, BOX_TONE, LINE, TEXT_TONE, id, items, list, mustExist, object, oneOf, text, uniqueIds, withoutType } from '../spec-kit.js';
export function defineSequencePart(builder) {
    return {
        type: 'sequence',
        description: 'A sequence diagram: messages between participants in time order. A step is a message (from, to, label), a self call (self, label), a note (note, over) or a divider (divider).',
        schema: object({
            type: { const: 'sequence' },
            actors: list(object({
                id: id('Referred to by steps.'),
                label: text('The name of the participant.', 60),
                tone: BOX_TONE,
            }, ['id', 'label']), 12, 1),
            steps: list({ oneOf: [
                    object({ from: id('An actor id.'), to: id('An actor id.'), label: text('The message.'), line: oneOf('solid', 'dashed', 'dotted'), arrow: ARROW, tone: TEXT_TONE }, ['from', 'to', 'label']),
                    object({ self: id('An actor id.'), label: text('The call.'), line: LINE, tone: TEXT_TONE }, ['self', 'label']),
                    object({ note: text('The note.'), over: list(id('An actor id.'), 12, 1), tone: BOX_TONE }, ['note', 'over']),
                    object({ divider: text('The name of the phase.', 60) }, ['divider']),
                ] }, 50, 1),
            numbered: { type: 'boolean', description: 'false: do not number the messages.' },
        }, ['type', 'actors', 'steps']),
        example: { type: 'sequence', actors: [{ id: 'u', label: '利用者' }, { id: 'api', label: 'API' }], steps: [{ from: 'u', to: 'api', label: 'ログインする' }, { from: 'api', to: 'u', label: 'トークンを返す', line: 'dashed' }] },
        check(part, at, issues) {
            const actors = uniqueIds(part, 'actors', at, issues);
            items(part, 'steps').forEach((s, i) => {
                for (const key of ['from', 'to', 'self'])
                    if (s[key] !== undefined)
                        mustExist(s[key], actors, `${at}.steps[${i}].${key}`, 'actor id', issues);
                if (s['from'] !== undefined && s['from'] === s['to'])
                    issues.push({ path: `${at}.steps[${i}].to`, message: "is the same actor as from: write a self call (self, label) instead" });
                (s['over'] ?? []).forEach((a, j) => mustExist(a, actors, `${at}.steps[${i}].over[${j}]`, 'actor id', issues));
            });
        },
        build(part) {
            const { actors, steps, ...opts } = withoutType(part);
            return builder(actors, steps, opts);
        },
    };
}
