import { sourceCaptureEnabled } from './source-capture.js';
export { captureSourceLocations } from './source-capture.js';
export const SOURCE = Symbol.for('svg-diagram.source');
export const DIAGRAM_SOURCE = Symbol.for('svg-diagram.diagram-source');
/** A lazy V8 stack, or the path of a spec part. Copies of a part share this reference. */
export class SourceRef {
    stackHolder;
    specPath;
    constructor(stackHolder, specPath) {
        this.stackHolder = stackHolder;
        this.specPath = specPath;
    }
}
export function captureHere(skip = captureHere) {
    if (!sourceCaptureEnabled())
        return undefined;
    const holder = {};
    Error.captureStackTrace(holder, skip);
    return new SourceRef(holder);
}
export function sourceOf(target, key = SOURCE) {
    return target[key];
}
/** Associate every band from a spec part with its path, preserving distinct builder call sites. */
export function markSpecPart(bands, path) {
    const refs = new Map();
    for (const band of bands) {
        const target = band;
        const stack = target[SOURCE]?.stackHolder;
        let ref = refs.get(stack);
        if (!ref) {
            ref = new SourceRef(stack, path);
            refs.set(stack, ref);
        }
        target[SOURCE] = ref;
    }
}
/** Preserve a more specific source already assigned by an inner operation. */
export function withSource(target, ref, key = SOURCE) {
    if (ref !== undefined && sourceOf(target, key) === undefined && Object.isExtensible(target))
        target[key] = ref;
    return target;
}
function asError(e) {
    return e instanceof Error ? e : new Error(String(e), { cause: e });
}
export function atBand(band, fn) {
    try {
        return fn();
    }
    catch (e) {
        throw withSource(asError(e), sourceOf(band));
    }
}
export function throwAtDiagram(e, diagram) {
    const error = asError(e);
    if (sourceOf(error) === undefined)
        withSource(error, sourceOf(diagram), DIAGRAM_SOURCE);
    throw error;
}
