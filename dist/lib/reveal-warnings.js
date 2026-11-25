import { resolveAnchor } from './scope-table.js';
export function warnEarlyReveal(warnings, what, explicit, endpoint) {
    if (explicit !== undefined && explicit < endpoint)
        warnings.push(`${what} reveal ${explicit} is earlier than an endpoint (reveal ${endpoint})`);
}
export function resolveRevealId(scopes, ref, known) {
    const id = ref.split(':')[0] ?? ref;
    return resolveAnchor(scopes, id, known) ?? id;
}
export function warnConnectorReveal(warnings, { from, to, reveal, until }, endpoints) {
    const what = `connect(${from} -> ${to})`;
    warnEarlyReveal(warnings, what, reveal, endpoints.start);
    const end = endpoints.end ?? Infinity;
    if (until !== undefined && until > end) {
        warnings.push(`${what} until ${until} is later than an endpoint's (vanishes at ${end})`);
    }
}
