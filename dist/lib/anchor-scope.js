// ADR 0012 D1: look up scoped ids while keeping the original names in a band's output.
import { assertScope, qualify, scopeOf } from './scope-name.js';
export { assertScope, qualify, scopeOf };
export { addScoped, emptyScopes, bareNameIn, resolveAnchor, unknownHint } from './scope-table.js';
