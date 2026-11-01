// styled(ctor, defaults, {at}): a band constructor with some options fixed (ADR 0050 D1). Pure.

/**
 * `styled(box, {tone: 'muted'})` is `box` with `tone: 'muted'` unless the call gives its own. The result IS the constructor's type
 * (overloads, Declares and HandleOf stay), and the call goes to the real constructor, so its checks, derived fields and the
 * record of what the caller wrote are all unchanged. Stack them: `styled(styled(box, a), b)` = `styled(box, {...a, ...b})`.
 * Stacking: bind the inner one to a const first (`const card = styled(box, a); const warn = styled(card, b)`); nested inline, TypeScript
 * instantiates box's `Id` and the id handle's type is lost.
 * `id` is no default (every band would share it). An `undefined` in the call does not erase a default:
 * `card({tone: props.tone})` keeps the card's tone when props has none.
 *
 * Where the options are: `at` is how many arguments come before them (default 0: box, banner, node). `styled(group, {tone: 'accent'}, {at: 1})`
 * is group(children, opts); row / grid / table the same, stat(value, label, opts) is `{at: 2}`. The leading arguments pass through as they are.
 * The constructor is not asked what it takes, so `at` is the caller's word; a call whose options spot holds an array, a band or a
 * string is refused (it is not an options object), not built wrong.
 */
// biome-ignore lint/suspicious/noExplicitAny: the constructor's own parameter types are read back through Parameters<F>
export function styled<F extends (...args: any[]) => unknown, N extends number = 0>(ctor: F, defaults: Partial<Omit<NonNullable<Parameters<F>[N]>, 'id'>>, where?: {at?: N}): F {
  if ('id' in defaults) throw new Error('styled(): id cannot be a default — every band built from it would share the id');
  const at = where?.at ?? 0;
  if (!Number.isInteger(at) || at < 0) throw new Error(`styled(): at is how many arguments come before the options, a whole number from 0 (got ${JSON.stringify(at)})`);
  const base = Object.fromEntries(Object.entries(defaults).filter(([, v]) => v !== undefined));
  return ((...args: unknown[]) => {
    if (args.length < at) throw new Error(`styled(): this one takes ${at} argument${at === 1 ? '' : 's'} before the options (styled(..., {at: ${at}})), got ${args.length}`);
    const given = args[at] ?? {}; // only this one: [..].map(card) passes the index and the array too
    if (typeof given !== 'object' || Array.isArray(given) || typeof (given as {type?: unknown}).type === 'string') throw new Error(`styled(): argument ${at} must be the options object — if the options are not argument ${at} of this constructor, say where with styled(ctor, defaults, {at: n})`);
    return ctor(...args.slice(0, at), {...base, ...Object.fromEntries(Object.entries(given).filter(([, v]) => v !== undefined))});
  }) as F;
}
