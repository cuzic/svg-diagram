import { BandError } from './band-error.js';
import { must } from './must.js';
export const DEF_API = '0.1';
const DEF_PREFIX = 'svg-diagram.def/';
export const DEF = Symbol.for(`${DEF_PREFIX}${DEF_API}`);
export const EXTERNAL = Symbol.for('svg-diagram.external');
export function assertTrustedBandFields(def) {
    const separator = def.type.indexOf(':');
    if (!def[EXTERNAL] && separator < 0)
        return;
    const field = def.internal === true ? 'internal'
        : def.nodeIds === 'self' ? 'nodeIds'
            : def.nameNodes !== undefined ? 'nameNodes'
                : def.locations !== undefined ? 'locations'
                    : def.rectsQualified === true ? 'rectsQualified' : undefined;
    if (field) {
        const plugin = separator < 0 ? def.type : def.type.slice(0, separator);
        const kind = separator < 0 ? def.type : def.type.slice(separator + 1);
        throw new BandError(plugin, kind, 'definition', `外部の帯の定義では ${field} を使えません。定義から削除してください`);
    }
}
export function band(def, data) {
    if (def.type !== data.type)
        throw new Error(`帯の定義の型 "${def.type}" とデータの型 "${data.type}" が一致しません。同じ型の定義とデータを渡してください`);
    assertTrustedBandFields(def);
    return Object.defineProperty(copyBand(data), DEF, { value: def, enumerable: true, writable: true, configurable: true });
}
export const isDefKey = (key) => typeof key === 'symbol' && key.description?.startsWith(DEF_PREFIX) === true;
export function defOf(b) {
    for (const key of Object.getOwnPropertySymbols(b)) {
        if (key !== DEF && isDefKey(key)) {
            throw new Error(`帯の定義の API の版が一致しません（${key.description} と ${DEF.description}）。同じ API 版の入口から帯を作ってください`);
        }
    }
    return b[DEF];
}
export function definedNestedBandsOf(band) {
    return band.type === 'swimlane' ? band.steps : defOf(band)?.children?.(band) ?? [];
}
/** Visit selected bands and their nested content in input order. */
export function walkDefinedBands(bands, out = []) {
    for (const band of bands) {
        out.push(band);
        walkDefinedBands(definedNestedBandsOf(band), out);
    }
    return out;
}
/** Copy a band with its prototype, definition and non-enumerable handles. */
export function copyBand(b) {
    return Object.create(Object.getPrototypeOf(b), Object.getOwnPropertyDescriptors(b));
}
/**
 * Recursively strip definition keys from arrays and plain objects for comparisons.
 * Other objects are returned by reference. Accessors are preserved without stripping their getter results.
 */
export function plain(v) {
    const seen = new WeakMap();
    const strip = (value) => {
        if (value === null || typeof value !== 'object')
            return value;
        const proto = Object.getPrototypeOf(value);
        const array = Array.isArray(value);
        if (!array && proto !== Object.prototype && proto !== null)
            return value;
        const previous = seen.get(value);
        if (previous)
            return previous;
        const out = array ? [] : Object.create(proto);
        seen.set(value, out);
        for (const key of Reflect.ownKeys(value)) {
            if (isDefKey(key))
                continue;
            const descriptor = must(Object.getOwnPropertyDescriptor(value, key));
            if ('value' in descriptor)
                descriptor.value = strip(descriptor.value);
            Object.defineProperty(out, key, descriptor);
        }
        return out;
    };
    return strip(v);
}
