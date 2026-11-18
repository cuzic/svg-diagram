import { assertScope, qualify, scopeOf } from './scope-name.ts';
import type { Band } from './types/index.ts';
export { assertScope, qualify, scopeOf };
/** Every scoped name of a figure, by the bare id it answers to. Empty (the usual case) means nothing is scoped. */
export interface ScopeTable {
    readonly byBare: Map<string, string[]>;
}
export declare const emptyScopes: () => ScopeTable;
/** Adds one scoped item (`bare` of the band `scope`) to the table. */
export declare function addScoped(table: ScopeTable, scope: string, bare: string): void;
/** The table of a band list, read before layout (and before reveal): every item of every scoped band, nested bands included. */
export declare function scopesOf(bands: readonly Band[], table?: ScopeTable): ScopeTable;
/**
 * What `id` names. `has(name)` says whether a name is registered as it is written (an unscoped id, a column id, a qualified name).
 *  1. a registered name and no scoped item with that bare id  -> itself;
 *  2. not registered, and exactly one scoped item has that bare id -> that item's qualified name (it may not be placed yet);
 *  3. two or more names answer (counting the registered one) -> throws, naming them;
 *  4. none -> undefined (the caller says "unknown anchor id", with unknownHint()).
 */
export declare function resolveAnchor(table: ScopeTable, id: string, has: (name: string) => boolean): string | undefined;
/** ' (did you mean "plan.p0"?)' when a qualified-looking reference names no registered item but another scope has its last part. */
export declare function unknownHint(table: ScopeTable, id: string): string;
/** The band's own (bare) name of a name written for the whole figure: `plan.p0` -> `p0` in the band scoped `plan`; undefined when it is not this band's. */
export declare function bareNameIn(scope: string | undefined, name: string): string | undefined;
