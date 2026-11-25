import { nestedBandsOf } from './band-children.js';
import { defOf } from './band-def.js';
import { sourceCaptureEnabled } from './source-capture.js';
import { captureHere, sourceOf, withSource } from './source-ref.js';
function markPart(value, ref, seen, definitionOf) {
    if (typeof value !== 'object' || value === null || !('type' in value) || typeof value.type !== 'string' || seen.has(value))
        return;
    if (sourceOf(value) !== undefined)
        return;
    seen.add(value);
    withSource(value, ref);
    if (definitionOf(value)) {
        for (const child of nestedBandsOf(value, definitionOf))
            markPart(child, ref, seen, definitionOf);
    }
}
/**
 * Capture the call to a public builder while preserving its overloads and properties. `definitionOf` (default: the definition a band carries) finds the definition of a part that
 * carries none yet (the all-in-one builders make plain data: located-full.ts), so the parts nested in it are marked too.
 */
export function located(fn, definitionOf = defOf) {
    if (typeof fn !== 'function')
        return fn;
    const wrapped = {
        call(...args) {
            if (!sourceCaptureEnabled())
                return Reflect.apply(fn, this, args);
            const ref = captureHere(wrapped);
            const result = Reflect.apply(fn, this, args);
            if (ref) {
                const seen = new Set();
                if (Array.isArray(result)) {
                    for (const part of result)
                        markPart(part, ref, seen, definitionOf);
                }
                else
                    markPart(result, ref, seen, definitionOf);
            }
            return result;
        },
    }.call;
    for (const key of Reflect.ownKeys(fn)) {
        const descriptor = Object.getOwnPropertyDescriptor(fn, key);
        if (!descriptor)
            continue;
        if (typeof descriptor.value === 'function')
            descriptor.value = located(descriptor.value, definitionOf);
        Object.defineProperty(wrapped, key, descriptor);
    }
    return wrapped;
}
/** For a composer that builds plain data (no definitions): a band that holds bands in `children` is walked through them. */
export const holdsChildren = band => Array.isArray(band.children) ? { type: band.type, children: (held) => held.children } : undefined;
