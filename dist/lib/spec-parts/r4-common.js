import { id, items, list, object, oneOf, text, withoutType } from '../spec-kit.js';
/** Events of a fault tree, `ref`s included, and how deep it goes below the top event. */
export const MAX_FTA_EVENTS = 30;
export const MAX_FTA_DEPTH = 5;
/** Factors and arrows of a relations diagram: its layout untangles crossings like a cause tree's. */
export const MAX_RELATION_NODES = 20;
export const MAX_RELATION_LINKS = 40;
/** Variables and links of a causal loop diagram, and the loops it may hold: every simple loop is found, named and drawn. Left to right,
 *  9 variables already leave their labels no room at the figure's width. */
export const MAX_CAUSAL_NODES = 8;
export const MAX_CAUSAL_LINKS = 14;
export const MAX_CAUSAL_LOOPS = 8;
/** Cards of an affinity diagram, in all its groups. */
export const MAX_AFFINITY_CARDS = 40;
/** Taken off a part before its options reach a builder: `lang` is what `en` adds, never the caller. */
export const english = (part) => part['lang'] === 'en';
export const optionsOf = (part) => { const { lang: _lang, ...rest } = withoutType(part); return rest; };
// ---- fault tree ---------------------------------------------------------------------------------------------------------------
export const FTA_KIND = { ...oneOf('event', 'basic', 'undeveloped', 'house', 'condition'), description: 'event (default when it has a gate): a rectangle with a gate under it. basic: a basic event (circle). undeveloped: not broken down further (diamond). house: a condition that is on or off (state). condition: the condition of an inhibit gate.' };
export const ftaEvent = (levels) => object({
    id: id('Needed for `ref` to draw this event again.'),
    label: text('The event, written as a statement.', 60),
    sub: text('A second, muted line.', 60),
    kind: FTA_KIND,
    gate: { ...oneOf('and', 'or', 'vote', 'inhibit'), description: 'The gate under this event: and (all inputs), or (any input), vote (k of the inputs), inhibit (the one input, while `condition` holds).' },
    k: { type: 'integer', minimum: 1, maximum: 8, description: 'vote: how many inputs make the event happen.' },
    ...(levels > 0 ? { children: list(ftaEvent(levels - 1), 8), condition: ftaEvent(0) } : {}),
    p: { type: 'number', minimum: 0, maximum: 1, description: 'The probability of a basic, undeveloped or condition event (for quant).' },
    state: { type: 'boolean', description: 'A house event: true = it always happens, false = it never does.' },
    ref: id('Draw the event with this id again (a basic, undeveloped, house or condition event); nothing else may be written with it.'),
}, []);
export function checkFta(e, at, ids, refs, count, depth, issues) {
    count.n++;
    if (depth > MAX_FTA_DEPTH) {
        issues.push({ path: at, message: `is ${depth} levels below the top event; the limit is ${MAX_FTA_DEPTH}` });
        return;
    }
    if (e['ref'] !== undefined) {
        const extra = Object.keys(e).filter(k => k !== 'ref');
        if (extra.length)
            issues.push({ path: `${at}.${extra[0]}`, message: 'a {ref} draws another event again: write nothing else with it' });
        refs.push([e['ref'], `${at}.ref`]);
        return;
    }
    if (e['label'] === undefined)
        issues.push({ path: at, message: 'needs a label (or a ref to another event)' });
    if (typeof e['id'] === 'string') {
        if (ids.has(e['id']))
            issues.push({ path: `${at}.id`, message: `"${e['id']}" is used twice (ids must be unique)` });
        else
            ids.set(e['id'], e['kind'] ?? 'event');
    }
    const children = items(e, 'children'), gate = e['gate'], kind = e['kind'];
    if (gate !== undefined && kind !== undefined && kind !== 'event')
        issues.push({ path: `${at}.kind`, message: `a ${kind} event has no gate under it: leave out kind (or gate)` });
    if (gate !== undefined && children.length === 0)
        issues.push({ path: `${at}.children`, message: `the ${gate} gate needs its inputs here` });
    if (gate === undefined && children.length)
        issues.push({ path: `${at}.gate`, message: 'is needed: the children are the inputs of a gate (and, or, vote or inhibit)' });
    if (gate === undefined && kind === undefined && depth > 0)
        issues.push({ path: `${at}.kind`, message: "is needed for an event with no gate: basic, undeveloped, house or condition" });
    if (gate === 'vote' && (typeof e['k'] !== 'number' || e['k'] > children.length))
        issues.push({ path: `${at}.k`, message: `a vote gate needs k from 1 to the number of inputs (${children.length})` });
    if (gate !== 'vote' && e['k'] !== undefined)
        issues.push({ path: `${at}.k`, message: 'goes only with gate: vote' });
    if (gate === 'inhibit' && (children.length !== 1 || e['condition'] === undefined))
        issues.push({ path: `${at}.${children.length !== 1 ? 'children' : 'condition'}`, message: 'an inhibit gate takes exactly one input in children and one condition' });
    if (gate !== 'inhibit' && e['condition'] !== undefined)
        issues.push({ path: `${at}.condition`, message: 'goes only with gate: inhibit' });
    if (e['state'] !== undefined && kind !== 'house')
        issues.push({ path: `${at}.state`, message: 'goes only with kind: house' });
    children.forEach((c, i) => checkFta(c, `${at}.children[${i}]`, ids, refs, count, depth + 1, issues));
    if (e['condition'] !== undefined) {
        const c = e['condition'];
        if (c['ref'] === undefined && c['kind'] !== 'condition')
            issues.push({ path: `${at}.condition.kind`, message: "must be 'condition'" });
        checkFta(c, `${at}.condition`, ids, refs, count, depth + 1, issues);
    }
}
/** The words a fault tree writes by itself, in English. */
export const FTA_EN = {
    singlePoint: 'Single point of failure', undevelopedAlone: 'Undeveloped, alone to the top', houseTrue: 'Assumed to always happen', houseFalse: 'Assumed never to happen',
    period: 'Period: {period}. ', topP: 'Probability of the top event: {p}', topBound: 'Probability of the top event ≤ {p} (an upper bound: more than {n} shared basic events)', assumption: '. Basic events are assumed independent.',
};
// ---- causal loop: count the simple loops with a budget, so a dense graph is refused before the builder enumerates them ------------
export function loopCount(nodes, links, limit) {
    const out = new Map(nodes.map(n => [n, []]));
    for (const l of links)
        out.get(l['from'])?.push(l['to']);
    let found = 0, steps = 0;
    const index = new Map(nodes.map((n, i) => [n, i]));
    for (const [si, start] of nodes.entries()) {
        const seen = new Set([start]);
        const visit = (at) => {
            for (const to of out.get(at) ?? []) {
                if (found > limit || ++steps > 200_000) {
                    found = limit + 1;
                    return;
                }
                if (to === start)
                    found++;
                else if (!seen.has(to) && (index.get(to) ?? -1) >= si) {
                    seen.add(to);
                    visit(to);
                    seen.delete(to);
                }
            }
        };
        visit(start);
    }
    return found;
}
export const POLARITY = { ...oneOf('+', '-'), description: "+: more of from makes more of to. -: more of from makes less of to." };
// ---- affinity --------------------------------------------------------------------------------------------------------------
export const affinityGroup = (levels) => object({
    title: text('The name of the group: what its cards have in common, as a short sentence.', 40),
    cards: list(text('One idea or fact.', 40), 10),
    ...(levels > 0 ? { groups: list(affinityGroup(levels - 1), 4) } : {}),
}, ['title']);
export const cardsIn = (g) => items(g, 'cards').length + items(g, 'groups').reduce((n, c) => n + cardsIn(c), 0);
export function checkAffinity(g, at, issues) {
    if (!items(g, 'cards').length && !items(g, 'groups').length)
        issues.push({ path: `${at}.cards`, message: 'a group needs cards or smaller groups' });
    items(g, 'groups').forEach((c, i) => checkAffinity(c, `${at}.groups[${i}]`, issues));
}
// ---- English words the table builders write by themselves --------------------------------------------------------------------
export const FMEA_EN = { item: 'Item', mode: 'Failure\nmode', effect: 'Effect', cause: 'Cause', action: 'Action', s: 'S\nSev.', o: 'O\nOcc.', d: 'D\nDet.', rpn: 'RPN', afterS: 'After\nS', afterO: 'After\nO', afterD: 'After\nD', afterRpn: 'After\nRPN' };
export const IS_IS_NOT_EN = { dim: 'Dimension', is: 'IS', isNot: 'IS NOT (could be, but is absent)', distinct: 'Distinction', change: 'Change' };
export const DIM_EN = { what: 'What (object, defect)', where: 'Where', when: 'When', extent: 'Extent (size, number)' };
export const MATRIX_EN = { '評価点': 'Score', '合計': 'Total', '重み': 'Weight' };
