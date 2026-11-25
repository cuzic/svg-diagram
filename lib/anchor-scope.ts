// ADR 0012 D1: look up scoped ids while keeping the original names in a band's output.
import {assertScope, qualify, scopeOf} from './scope-name.ts';

export {assertScope, qualify, scopeOf};
export {addScoped, emptyScopes, bareNameIn, resolveAnchor, unknownHint} from './scope-table.ts';
export type {ScopeTable} from './scope-table.ts';
