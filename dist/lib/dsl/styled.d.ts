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
export declare function styled<F extends (...args: any[]) => unknown, N extends number = 0>(ctor: F, defaults: Partial<Omit<NonNullable<Parameters<F>[N]>, 'id'>>, where?: {
    at?: N;
}): F;
