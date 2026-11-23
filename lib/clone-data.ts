import {isDefKey} from './band-def.ts';
import {must} from './must.ts';
import {DIAGRAM_SOURCE, sourceOf, withSource} from './source-ref.ts';

/**
 * A deep copy of plain data: arrays and plain objects (Object.prototype or null prototype) are copied; everything else is
 * shared — a function (a raw() band's draw), a string, a Map / Set / Date / RegExp, a class instance. (structuredClone throws
 * on raw()'s function; copying a class instance by hand breaks private fields and internal slots.) The same object met twice
 * is copied once, so a band placed in two spots stays one band in the copy, and a cycle ends.
 * Known gap: a class instance handed in as plan data (a point of plane({points})) is shared, so a reveal written into it by
 * prepareReveal can still show in another figure. Not copied: non-enumerable properties (the .left / .right / .at handles,
 * withAnchors' anchors) and symbol keys such as NUMBERING, GIVEN and RICH that add() has used up. Source marks and band definitions are copied by reference.
 */
export function cloneData<T>(v: T, seen = new WeakMap<object, unknown>()): T {
  if (!v || typeof v !== 'object') return v;
  if (seen.has(v)) return seen.get(v) as T;
  const array = Array.isArray(v);
  const proto = Object.getPrototypeOf(v);
  if (!array && proto !== Object.prototype && proto !== null) return v;
  const out = array ? [] : Object.create(proto);
  seen.set(v, out);
  if (array) {
    for (const x of v) out.push(cloneData(x, seen));
  } else {
    for (const [k, x] of Object.entries(v)) out[k] = cloneData(x, seen);
    withSource(out, sourceOf(v));
    withSource(out, sourceOf(v, DIAGRAM_SOURCE), DIAGRAM_SOURCE);
  }
  for (const key of Object.getOwnPropertySymbols(v)) {
    if (isDefKey(key)) Object.defineProperty(out, key, must(Object.getOwnPropertyDescriptor(v, key)));
  }
  return out;
}
