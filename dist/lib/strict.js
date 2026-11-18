// Compile-time checks for the DSL. TYPES ONLY: nothing in this file exists at runtime, and every check
// here has a runtime twin (a `throw` in dsl.ts / layout.ts, or a rule of `svg-diagram check`) that still
// fires for JS callers and `.mjs` diagram sources.
//
// How the pieces fit:
//   * Constructors return their band intersected with a PHANTOM carrier: `Declares<'id'>` (the anchor ids the
//     band introduces) or `Refers<'id:side'>` (the connect() refs it uses). The carriers are optional
//     properties that never exist at runtime.
//   * `diagram().add(...bands)` gathers the ids carried by the diagram so far plus those of THIS call, and
//     rejects a band whose refs name an id that is not among them (ValidateBands).
//   * Option bags that have mutually dependent fields (box step/title, connect route/bend/dip/label, ...)
//     are discriminated unions, so the wrong combination is an ordinary "not assignable" error.
//   * Where a plain "not assignable" message would be cryptic, the offending value is mapped to a string
//     literal type that IS the message (`Ok<T, Problem>`), or to a required property whose NAME is the
//     message (`Err<M>`), which TypeScript prints verbatim.
//
// A non-literal `string` (an id or ref computed at run time) can never be proven wrong, so it is accepted
// everywhere: every check below degrades to "ok" for `string` and for template-literal patterns.
export {};
