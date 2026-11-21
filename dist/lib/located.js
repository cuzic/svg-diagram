import { CHILD_BANDS, nestedBandsOf } from './band-children.js';
import { sourceCaptureEnabled } from './source-capture.js';
import { captureHere, sourceOf, withSource } from './source-ref.js';
function markPart(value, ref, seen) {
    if (typeof value !== 'object' || value === null || !('type' in value) || typeof value.type !== 'string' || seen.has(value))
        return;
    if (sourceOf(value) !== undefined)
        return;
    seen.add(value);
    withSource(value, ref);
    if (Object.hasOwn(CHILD_BANDS, value.type)) {
        for (const child of nestedBandsOf(value))
            markPart(child, ref, seen);
    }
}
/** Capture the call to a public builder while preserving its overloads and properties. */
export function located(fn) {
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
                        markPart(part, ref, seen);
                }
                else
                    markPart(result, ref, seen);
            }
            return result;
        },
    }.call;
    for (const key of Reflect.ownKeys(fn)) {
        const descriptor = Object.getOwnPropertyDescriptor(fn, key);
        if (!descriptor)
            continue;
        if (typeof descriptor.value === 'function')
            descriptor.value = located(descriptor.value);
        Object.defineProperty(wrapped, key, descriptor);
    }
    return wrapped;
}
