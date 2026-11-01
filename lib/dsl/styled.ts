// styled(ctor, defaults): a band constructor with some options fixed (ADR 0050 D1). Pure.

/**
 * `styled(box, {tone: 'muted'})` is `box` with `tone: 'muted'` unless the call gives its own. The result IS the constructor's type
 * (overloads, Declares and HandleOf stay), and the call goes to the real constructor, so its checks, derived fields and the
 * record of what the caller wrote are all unchanged. Stack them: `styled(styled(box, a), b)` = `styled(box, {...a, ...b})`.
 * Stacking: bind the inner one to a const first (`const card = styled(box, a); const warn = styled(card, b)`); nested inline, TypeScript
 * instantiates box's `Id` and the id handle's type is lost.
 * For constructors whose options are the FIRST argument (box, banner, node). `id` is no default (every band would share it).
 * An `undefined` in the call does not erase a default: `card({tone: props.tone})` keeps the card's tone when props has none.
 */
// biome-ignore lint/suspicious/noExplicitAny: the constructor's own parameter type is read back through Parameters<F>
export function styled<F extends (opts: any) => unknown>(ctor: F, defaults: Partial<Omit<Parameters<F>[0], 'id'>>): F {
  if ('id' in defaults) throw new Error('styled(): id cannot be a default — every band built from it would share the id');
  const base = Object.fromEntries(Object.entries(defaults).filter(([, v]) => v !== undefined));
  return ((...args: unknown[]) => {
    const given = args[0] ?? {};
    // a constructor whose first argument is not the options (group(children, opts), stat(value, label, opts)) is refused, not built wrong
    if (args.length > 1 || typeof given !== 'object' || Array.isArray(given) || typeof (given as {type?: unknown}).type === 'string') throw new Error('styled(): the constructor must take one options object (box, banner, node); for group / row / grid / stat / caption the options come last — write the options yourself');
    return ctor({...base, ...Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined))});
  }) as F;
}
