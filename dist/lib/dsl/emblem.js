import { emblemBand } from '../flow-emblem.js';
import { withHandle } from './shared.js';
export function emblem(first, opts = undefined) {
    if (typeof first !== 'string')
        return withHandle(emblemBand(first, opts), opts?.id);
    const { sub, shape, tone, id, ...band } = opts ?? {};
    const built = emblemBand([{ label: first, ...(sub !== undefined ? { sub } : {}), ...(shape ? { shape } : {}), ...(tone ? { tone } : {}), ...(id ? { id } : {}) }], band);
    return withHandle(built, id && built.scope ? `${built.scope}.${id}` : id); // a scoped item is registered as <scope>.<id> (ADR 0012)
}
