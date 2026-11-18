import { must } from './must.js';
/** More sets than this at any step (counted before absorption, which is where they grow first) and the analysis stops. */
export const CUT_SET_LIMIT = 5000;
/** The variable a leaf stands for: a repeat shares the variable of the event it repeats. */
/** `id:` / `k:` keep a user's id apart from the internal key (an id like 'n2' must not meet the key of another event). */
export const ftaVar = (n) => n.copyOf !== undefined ? `id:${n.copyOf}` : n.id !== undefined ? `id:${n.id}` : `k:${n.key}`;
class TooMany extends Error {
}
const union = (a, b) => [...new Set([...a, ...b])].sort();
const subset = (a, b) => a.length <= b.length && a.every(v => b.includes(v));
/** Keeps the sets no other set is contained in (a set repeated counts once). */
function absorb(sets) {
    const sorted = [...new Map(sets.map(s => [s.join('\u0000'), s])).values()].sort((a, b) => a.length - b.length);
    const out = [];
    for (const s of sorted)
        if (!out.some(o => subset(o, s)))
            out.push(s);
    return out;
}
const guard = (n) => { if (n > CUT_SET_LIMIT)
    throw new TooMany(); };
function and(parts) {
    let acc = [[]];
    for (const p of parts) {
        guard(acc.length * p.length);
        acc = absorb(acc.flatMap(a => p.map(b => union(a, b))));
    }
    return acc;
}
function choose(items, k) {
    const out = [];
    const go = (from, picked) => {
        if (picked.length === k) {
            out.push(picked);
            return;
        }
        for (const [i, item] of items.entries()) {
            if (i < from)
                continue;
            go(i + 1, [...picked, item]);
            guard(out.length);
        }
    };
    go(0, []);
    return out;
}
/** The sets of one event: [] = never happens, [[]] = always happens. */
function setsOf(n) {
    if (n.gate === undefined) {
        if (n.kind === 'house')
            return n.state ? [[]] : [];
        return [[ftaVar(n)]];
    }
    const kids = n.children.map(setsOf);
    if (n.gate === 'or') {
        guard(kids.reduce((s, k) => s + k.length, 0));
        return absorb(kids.flat());
    }
    if (n.gate === 'and')
        return and(kids);
    if (n.gate === 'inhibit')
        return and([...kids, setsOf(must(n.cond))]);
    const combos = choose(kids, must(n.k)); // vote(k, n): an AND for each way to pick k of the n inputs
    guard(combos.length);
    const all = [];
    for (const c of combos) {
        all.push(...and(c));
        guard(all.length);
    } // counted as they come: the total, not only each AND, stays under the limit
    return absorb(all);
}
/** The minimal cut sets of the tree. `truncated` when a step passed CUT_SET_LIMIT (then `sets` is empty: nothing is guessed). */
export function minimalCutSets(root) {
    try {
        const raw = setsOf(root);
        guard(raw.length);
        const sets = absorb(raw).sort((a, b) => a.length - b.length || a.join().localeCompare(b.join(), 'en'));
        return { sets, truncated: false };
    }
    catch (e) {
        if (e instanceof TooMany)
            return { sets: [], truncated: true };
        throw e;
    }
}
/** The variables that alone bring the top event about (the cut sets of size 1). */
export function singlePoints(cuts) {
    return new Set(cuts.sets.flatMap(s => { const [v] = s; return s.length === 1 && v !== undefined ? [v] : []; }));
}
// ---- probability (ADR 0025 D4, U4) ----
// `p` is a probability over one period (0 to 1, no unit). The basic events are taken as independent; coherent tree.
/** Shared variables above this are not enumerated: the answer is then the min-cut upper bound. */
export const SHARED_LIMIT = 12;
const leafP = (n) => n.kind === 'house' ? (n.state ? 1 : 0) : (n.p ?? NaN);
/** P(at least k of the inputs happen), the inputs independent with different probabilities (dynamic programming over the count). */
function atLeast(ps, k) {
    let dp = [1];
    for (const p of ps) {
        const next = new Array(dp.length + 1).fill(0);
        dp.forEach((q, j) => { next[j] = must(next[j]) + q * (1 - p); next[j + 1] = must(next[j + 1]) + q * p; });
        dp = next;
    }
    return dp.slice(k).reduce((a, b) => a + b, 0);
}
/** The probability of the top event. Every leaf that is not a house event needs `p` (the caller checks, naming the events). */
export function topProbability(root) {
    const count = new Map(), pOf = new Map();
    const scan = (n) => {
        if (n.gate === undefined) {
            const v = ftaVar(n);
            count.set(v, (count.get(v) ?? 0) + 1);
            pOf.set(v, leafP(n));
        }
        for (const c of n.children)
            scan(c);
        if (n.cond)
            scan(n.cond);
    };
    scan(root);
    const shared = [...count].filter(([v, c]) => c > 1 && (pOf.get(v) ?? NaN) > 0 && (pOf.get(v) ?? NaN) < 1).map(([v]) => v);
    if (shared.length > SHARED_LIMIT) {
        const cuts = minimalCutSets(root);
        if (cuts.truncated)
            throw new Error('faultTree({quant: true}): the tree has too many cut sets to bound the probability; simplify the tree');
        return { p: 1 - cuts.sets.reduce((acc, s) => acc * (1 - s.reduce((a, v) => a * must(pOf.get(v)), 1)), 1), bound: true };
    }
    const evalAt = (n, fixed) => {
        if (n.gate === undefined)
            return fixed.get(ftaVar(n)) ?? leafP(n);
        const kids = n.children.map(c => evalAt(c, fixed));
        if (n.gate === 'and')
            return kids.reduce((a, b) => a * b, 1);
        if (n.gate === 'or')
            return 1 - kids.reduce((a, b) => a * (1 - b), 1);
        if (n.gate === 'inhibit')
            return must(kids[0]) * evalAt(must(n.cond), fixed);
        return atLeast(kids, must(n.k));
    };
    // Shannon expansion over the shared events: each is either happening or not; the rest are independent
    let total = 0;
    for (let mask = 0; mask < 1 << shared.length; mask++) {
        const fixed = new Map();
        let weight = 1;
        shared.forEach((v, i) => { const on = (mask >> i) & 1, p = must(pOf.get(v)); fixed.set(v, on); weight *= on ? p : 1 - p; });
        total += weight * evalAt(root, fixed);
    }
    return { p: total, bound: false };
}
