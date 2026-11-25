import { qualify } from './scope-name.js';
export const emptyScopes = () => ({ byBare: new Map() });
/** Adds one scoped item (`bare` of the band `scope`) to the table. */
export function addScoped(table, scope, bare) {
    const name = qualify(scope, bare), list = table.byBare.get(bare);
    if (!list)
        table.byBare.set(bare, [name]);
    else if (!list.includes(name))
        list.push(name);
}
/**
 * What `id` names. `has(name)` says whether a name is registered as it is written (an unscoped id, a column id, a qualified name).
 *  1. a registered name and no scoped item with that bare id  -> itself;
 *  2. not registered, and exactly one scoped item has that bare id -> that item's qualified name (it may not be placed yet);
 *  3. two or more names answer (counting the registered one) -> throws, naming them;
 *  4. none -> undefined (the caller says "unknown anchor id", with unknownHint()).
 */
export function resolveAnchor(table, id, has) {
    const hits = table.byBare.get(id);
    if (!hits || !hits.length)
        return has(id) ? id : undefined;
    const all = has(id) && !hits.includes(id) ? [id, ...hits] : hits;
    if (all.length > 1)
        throw new Error(`ambiguous anchor id "${id}": ${all.join(', ')} — write one of them`);
    return all[0];
}
/** ' (did you mean "plan.p0"?)' when a qualified-looking reference names no registered item but another scope has its last part. */
export function unknownHint(table, id) {
    const tail = id.includes('.') ? id.slice(id.lastIndexOf('.') + 1) : undefined;
    const hits = tail ? table.byBare.get(tail) : undefined;
    return hits?.length ? ` (did you mean ${hits.map(h => `"${h}"`).join(' or ')}?)` : '';
}
/** The band's own (bare) name of a name written for the whole figure: `plan.p0` -> `p0` in the band scoped `plan`; undefined when it is not this band's. */
export function bareNameIn(scope, name) {
    if (!scope)
        return name;
    return name.startsWith(`${scope}.`) ? name.slice(scope.length + 1) : undefined;
}
