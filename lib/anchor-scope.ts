// ADR 0012 D1: id scoping. A self-placing band built with {scope: 'plan'} registers its items as `plan.<id>`; a reference
// (connect() ends, spotlight ids, reveal) may be that qualified name (always exact) or the bare id, which passes when exactly one
// name answers to it and is an error when several do. This file is the one place that decides; layout.ts, reveal.ts and
// spotlight.ts all call resolveAnchor() on a table built by the same functions. Pure (test/core-purity.test.ts).
//
// A band's own output keeps the bare ids (`anchors[].id`): the qualified name is only the key of the registry, and a consumer
// that reads a band's output turns a qualified name back into the band's own bare name with bareNameIn().
import {itemIdsOf} from './band-ids.ts';
import {childrenOf} from './band-children.ts';
import {assertScope, qualify, scopeOf} from './scope-name.ts';
import type {Band} from './types/index.ts';

export {assertScope, qualify, scopeOf};

/** Every scoped name of a figure, by the bare id it answers to. Empty (the usual case) means nothing is scoped. */
export interface ScopeTable {readonly byBare: Map<string, string[]>}

export const emptyScopes = (): ScopeTable => ({byBare: new Map()});

/** Adds one scoped item (`bare` of the band `scope`) to the table. */
export function addScoped(table: ScopeTable, scope: string, bare: string): void {
  const name = qualify(scope, bare), list = table.byBare.get(bare);
  if (!list) table.byBare.set(bare, [name]);
  else if (!list.includes(name)) list.push(name);
}

/** The table of a band list, read before layout (and before reveal): every item of every scoped band, nested bands included. */
export function scopesOf(bands: readonly Band[], table: ScopeTable = emptyScopes()): ScopeTable {
  for (const b of bands) {
    const scope = scopeOf(b);
    if (scope) for (const id of itemIdsOf(b)) addScoped(table, scope, id);
    scopesOf(childrenOf(b), table);
  }
  return table;
}

/**
 * What `id` names. `has(name)` says whether a name is registered as it is written (an unscoped id, a column id, a qualified name).
 *  1. a registered name and no scoped item with that bare id  -> itself;
 *  2. not registered, and exactly one scoped item has that bare id -> that item's qualified name (it may not be placed yet);
 *  3. two or more names answer (counting the registered one) -> throws, naming them;
 *  4. none -> undefined (the caller says "unknown anchor id", with unknownHint()).
 */
export function resolveAnchor(table: ScopeTable, id: string, has: (name: string) => boolean): string | undefined {
  const hits = table.byBare.get(id);
  if (!hits || !hits.length) return has(id) ? id : undefined;
  const all = has(id) && !hits.includes(id) ? [id, ...hits] : hits;
  if (all.length > 1) throw new Error(`ambiguous anchor id "${id}": ${all.join(', ')} — write one of them`);
  return all[0];
}

/** ' (did you mean "plan.p0"?)' when a qualified-looking reference names no registered item but another scope has its last part. */
export function unknownHint(table: ScopeTable, id: string): string {
  const tail = id.includes('.') ? id.slice(id.lastIndexOf('.') + 1) : undefined;
  const hits = tail ? table.byBare.get(tail) : undefined;
  return hits?.length ? ` (did you mean ${hits.map(h => `"${h}"`).join(' or ')}?)` : '';
}

/** The band's own (bare) name of a name written for the whole figure: `plan.p0` -> `p0` in the band scoped `plan`; undefined when it is not this band's. */
export function bareNameIn(scope: string | undefined, name: string): string | undefined {
  if (!scope) return name;
  return name.startsWith(`${scope}.`) ? name.slice(scope.length + 1) : undefined;
}
