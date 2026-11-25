export const FTA_KINDS = ['event', 'basic', 'undeveloped', 'house', 'condition'];
export const FTA_GATES = ['and', 'or', 'vote', 'inhibit'];
const LEAVES = ['basic', 'undeveloped', 'house', 'condition'];
/** Validates the tree (every error throws, naming the event) and resolves the repeats. */
export function ftaResolve(top) {
    if (!top || typeof top !== 'object')
        throw new Error('faultTree(top) needs the top event: {label: "...", gate: "or", children: [...]}');
    const defs = new Map();
    const collect = (e, slot) => {
        if (!e || typeof e !== 'object')
            throw new Error('faultTree(): every event must be an object');
        if (e.ref !== undefined)
            return;
        if (e.id !== undefined) {
            if (typeof e.id !== 'string' || !e.id)
                throw new Error(`faultTree(): the id of "${e.label}" must be a non-empty string`);
            if (defs.has(e.id))
                throw new Error(`faultTree(): duplicate event id "${e.id}"`);
            defs.set(e.id, { ev: e, slot });
        }
        if (e.children !== undefined && !Array.isArray(e.children))
            throw new Error(`faultTree(): "${e.label}": children must be an array`);
        for (const c of e.children ?? [])
            collect(c, 'child');
        if (e.condition !== undefined)
            collect(e.condition, 'condition');
    };
    collect(top, 'top');
    const kindOf = (e, slot) => {
        const k = e.kind ?? (slot === 'condition' ? 'condition' : 'event');
        if (!FTA_KINDS.includes(k))
            throw new Error(`faultTree(): "${e.label}" has kind ${String(k)} (use ${FTA_KINDS.join(' | ')})`);
        return k;
    };
    const check = (e, slot) => {
        const name = `"${e.label}"`, kind = kindOf(e, slot);
        if (typeof e.label !== 'string' || !e.label.trim())
            throw new Error('faultTree(): every event needs a label');
        if (e.p !== undefined && !(typeof e.p === 'number' && e.p >= 0 && e.p <= 1))
            throw new Error(`faultTree(): ${name}: p is a probability, a number from 0 to 1 (got ${String(e.p)})`);
        if (slot === 'condition' && kind !== 'condition')
            throw new Error(`faultTree(): the condition of an inhibit gate ${name} must be a condition event (kind: 'condition', or leave kind out)`);
        if (slot !== 'condition' && kind === 'condition')
            throw new Error(`faultTree(): ${name} is a condition event: it only goes in the \`condition\` of an inhibit gate`);
        if (slot === 'top' && kind !== 'event' && kind !== 'basic' && kind !== 'undeveloped')
            throw new Error(`faultTree(): the top event ${name} cannot be a ${kind} event`);
        if (kind === 'event') {
            if (e.gate === undefined || !e.children?.length)
                throw new Error(`faultTree(): ${name} needs a gate and children (an event that goes no further is kind: 'undeveloped' or 'basic')`);
            if (!FTA_GATES.includes(e.gate))
                throw new Error(`faultTree(): ${name} has gate ${String(e.gate)} (use ${FTA_GATES.join(' | ')})`);
            if (e.state !== undefined)
                throw new Error(`faultTree(): ${name}: state is for a house event`);
            if (e.p !== undefined)
                throw new Error(`faultTree(): ${name} has a gate: its probability is worked out from its inputs, p goes on the basic events`);
            if (e.gate === 'vote') {
                const n = e.children.length;
                if (!(typeof e.k === 'number' && Number.isInteger(e.k) && e.k >= 1 && e.k <= n))
                    throw new Error(`faultTree(): ${name}: a vote gate needs k, a whole number from 1 to the number of inputs (${n}); got ${String(e.k)}`);
            }
            else if (e.k !== undefined)
                throw new Error(`faultTree(): ${name}: k is for a vote gate`);
            if (e.gate === 'inhibit') {
                if (e.children.length !== 1)
                    throw new Error(`faultTree(): ${name}: an inhibit gate has one input in children (got ${e.children.length}) and one condition`);
                if (e.condition === undefined)
                    throw new Error(`faultTree(): ${name}: an inhibit gate needs a condition`);
            }
            else if (e.condition !== undefined)
                throw new Error(`faultTree(): ${name}: condition is for an inhibit gate`);
        }
        else {
            for (const f of ['gate', 'children', 'condition', 'k'])
                if (e[f] !== undefined)
                    throw new Error(`faultTree(): ${name} is a ${kind} event: it takes no ${f}`);
            if (kind === 'house') {
                if (typeof e.state !== 'boolean')
                    throw new Error(`faultTree(): the house event ${name} needs state: true (it always happens) or false (it never does)`);
                if (e.p !== undefined)
                    throw new Error(`faultTree(): the house event ${name} takes no p (its state says whether it happens)`);
            }
            else if (e.state !== undefined)
                throw new Error(`faultTree(): ${name}: state is for a house event`);
        }
        return kind;
    };
    let counter = 0;
    const nodes = [];
    const build = (e, slot) => {
        let src = e, srcSlot = slot, copyOf;
        if (e.ref !== undefined) {
            const extra = Object.keys(e).filter(k => k !== 'ref');
            if (extra.length)
                throw new Error(`faultTree(): {ref: "${e.ref}"} takes no other field (${extra.join(', ')}): write them on the event it repeats`);
            const def = defs.get(e.ref);
            if (!def)
                throw new Error(`faultTree(): {ref: "${e.ref}"} names no event (ids: ${[...defs.keys()].join(', ') || 'none'})`);
            const k = kindOf(def.ev, def.slot);
            if (!LEAVES.includes(k))
                throw new Error(`faultTree(): {ref: "${e.ref}"} repeats an event with a gate under it; only a basic, undeveloped, house or condition event can be repeated`);
            if ((k === 'condition') !== (slot === 'condition'))
                throw new Error(`faultTree(): {ref: "${e.ref}"} is ${k === 'condition' ? 'a condition event: it only goes in the `condition` of an inhibit gate' : 'not a condition event: the condition of an inhibit gate must be one'}`);
            src = def.ev;
            srcSlot = def.slot;
            copyOf = e.ref;
        }
        const kind = check(src, srcSlot);
        const node = {
            key: `n${counter++}`, label: src.label, kind, children: [],
            ...(src.sub === undefined ? {} : { sub: src.sub }), ...(copyOf !== undefined ? { copyOf } : src.id !== undefined ? { id: src.id } : {}),
            ...(src.gate === undefined ? {} : { gate: src.gate }), ...(src.k === undefined ? {} : { k: src.k }), ...(src.state === undefined ? {} : { state: src.state }), ...(src.p === undefined ? {} : { p: src.p }),
        };
        nodes.push(node);
        if (copyOf === undefined) {
            node.children = (src.children ?? []).map(c => build(c, 'child'));
            if (src.condition !== undefined)
                node.cond = build(src.condition, 'condition');
        }
        return node;
    };
    const root = build(top, 'top');
    return { root, nodes };
}
