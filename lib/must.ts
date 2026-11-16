// The value, which the caller knows is there: `must(map.get(k))` instead of `map.get(k)!`. Where the
// invariant is broken it throws at once with a message, instead of passing `undefined` on to fail later.
/** `what` names the value for the message ("lane \"x\""): give it where the invariant can be broken by a source file, not only by a bug here. */
export function must<T>(v: T | null | undefined, what?: string): T {
  if (v === undefined || v === null) throw new Error(`svg-diagram: expected ${what ?? 'a value'}, got ${v}`);
  return v;
}
