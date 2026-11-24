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
import {addScoped, emptyScopes} from './scope-table.ts';
import type {ScopeTable} from './scope-table.ts';
import type {Band} from './types/index.ts';

export {assertScope, qualify, scopeOf};
export {addScoped, emptyScopes, bareNameIn, resolveAnchor, unknownHint} from './scope-table.ts';
export type {ScopeTable} from './scope-table.ts';

/** The table of a band list, read before layout (and before reveal): every item of every scoped band, nested bands included. */
export function scopesOf(bands: readonly Band[], table: ScopeTable = emptyScopes()): ScopeTable {
  for (const b of bands) {
    const scope = scopeOf(b);
    if (scope) for (const id of itemIdsOf(b)) addScoped(table, scope, id);
    scopesOf(childrenOf(b), table);
  }
  return table;
}
