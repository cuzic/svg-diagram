// The value, which the caller knows is there: `must(map.get(k))` instead of `map.get(k)!`. Where the
// invariant is broken it throws at once with a message, instead of passing `undefined` on to fail later.
export function must<T>(v: T | null | undefined): T {
  if (v === undefined || v === null) throw new Error(`svg-diagram: expected a value, got ${v}`);
  return v;
}
