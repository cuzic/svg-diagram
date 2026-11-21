# Review round 2: ADR 0072 (source locations for findings and parts)

**Scope / Baseline.** Reviewed `docs/adr/0072-source-locations.md` at fad0143 (branch `docs/adr-source-locations`, draft PR #400), against the core code at that commit and the consumer `~/svg-diagram-vscode` at 82c1eec (`src/check.ts`, `src/preview.ts`). First I checked each round-1 finding (`0072-opus-review-round1.md`) against the revised text. Then I reviewed the design again. I built the D2 plan **as written** in a detached scratch worktree (now removed) and ran it on Node 26.13 (some probes also on 25.9). Node 22 is not installed here, but CI runs on 22 (`.github/workflows/test.yml:20,65`). The spike had these parts:
- a `SourceRef` holder;
- `located()` over every runtime export of `lib/dsl-pure.ts`, with string-`type`-only tagging, never-overwrite, and nested tagging through `nestedBandsOf`;
- `cloneData` copying `SOURCE` by reference;
- a `ctx.stack` fill of new `ctx.laidOut` entries since `n0`, plus a catch-tag-rethrow, with the same done for `deferred`;
- `Diagram.add`/`Diagram.connect` capture;
- `applyConnectDefaults` and `expandLoopBacks` copying `SOURCE`.

Scripts: `runner.ts` checks all 193 `examples/*.ts` through `loadDiagram` + `checkDiagram` and counts which owners of check rects carry a `SOURCE` that resolves into the checked file. `lines.ts` prints the resolved `loc<via` per part. `errs.ts` covers build errors thrown in different phases. `d3/probe*.mjs` covers CallSite availability. They are in `/tmp/claude-1002/-home-cuzic/0926059a-61aa-4814-bcfe-b2e2d373d9e0/scratchpad/review-0072-r2/`. "Read" means I checked it by reading the code. "Ran" means a spike showed it.

**Headline:** the propagation plan (D2) works. Ran: every laid-out band, row child and connect in all examples carries a `SOURCE` that resolves into the checked file. The only exceptions are the bands that `diagram()` options add, and the auto legend. The remaining problems are at the edges: build errors that carry no CallSites, throws outside `ctx.stack`, and D7's collision with the spec path mechanism that already exists.

## Round-1 findings: status

- **B1** (`cloneData` drops symbols): **resolved.** D2 copies `SOURCE` by reference and holds it in a `SourceRef` class. U2a tests through `checkDiagram()`/`renderDiagram()`. Ran: it holds after detach.
- **M1** (layout rebuilds bands): **resolved.** Central fill in `ctx.stack` plus `deferred`. Ran: 0 untagged among group/row/cycle/table/tree/…; of 840 rect owners (laid-out bands, row children, connects) across the 192 examples that load here (`math-formula.ts` needs mathjax-full), the only untagged ones are 86 `sourceLine` captions and 15 auto legends.
- **M2** (`d.connect`, defaults, composites, loop-back): **resolved** for the paths it named. Ran: 64/64 connects tagged. Gap: `image()`/`math()` are not in `dsl-pure` (m1).
- **M3** (same-file helper): **resolved** by `loc` + `via`. Ran: `examples/areas-trace.ts` gives `caption@6:34<13:11`, `<13:29`, `<13:45`, `<13:63`.
- **M4** (layout-time throws): **partly resolved.** Ran: `connect('a','nope')` is tagged. Throws in detach, pre-layout and post-layout are not (M2 below).
- **M5** (parallel string/struct channels): **resolved in direction.** How the per-band producers get a `loc` is still open (m4).
- **m1–m10, n1–n7:** resolved in the text. One exception: n5 (CallSites) holds only when the stack has not been formatted yet (M1).

## Blocker

None.

## Major

### M1. Syntax and module-load errors carry no CallSites, so U1 leaves the most frequent edit-loop `build-error` on line 1
- **Location:** ADR l.53 (D3: "CallSite で読む", no regex), l.64 (D4 build-error "誤りの `stack` から D3 で取る"), l.99 (U1 "これだけで拡張の後退の大半が直る"), l.119 (結果).
- **What happens (ran, `d3/probe2.mjs`, Node 26.13 and 25.9):** I imported three sources: a half-typed expression (`return a +;`), a TS `enum` (`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` under strip-only mode), and a missing named import. In all three, `e.stack` comes back as a **string**, even with `Error.prepareStackTrace = (_, cs) => cs` installed before the first read. Node has already formatted and decorated the stack. The only position is the header line: `…/syn.ts:3`, `…/enum.ts:1`, and `file:///…/badimport.ts:1` (one is a plain path, one is a URL), followed by the code line and a caret line. Today, `check --format json syn.ts enum.ts` gives `"message": "Expression expected"` with no `line` (ran). Extension 0.5.0 got these right from stderr (`src/check.ts:124`, "or the header Node prints"). On save, a half-typed file is the common case in an editor. So the 0.8.0 regression stays for exactly the errors users hit most.
- **Same fragility in general (ran, `d3/probe.mjs`):** once anything reads `.stack` (`SVG_DIAGRAM_DEBUG` in `lib/error-format.ts:11`, a user's `catch (e) { console.error(e); throw e; }`, a wrapper), a later CallSite read gets `STRING: Error: in define / at helper (file:///…/def.ts:5:34)`.
- **Fix:** In D3:
  - (a) Install one CLI-wide `Error.prepareStackTrace` at startup in `check`/`build`, next to `stackTraceLimit = 50`. It stashes the CallSites on the error under a symbol and returns the usual text (`String(err)` + `cs.map(c => '    at ' + c)`). Then the CallSites survive an earlier `.stack` read.
  - (b) Add a text fallback for errors with no stashed CallSites: the header `^(file://\S+|/\S+|[A-Za-z]:\\\S+):(\d+)$` on the first stack line, with the column taken from the caret line, and the usual `at …:(\d+):(\d+)` frames after that. Match through `fileURLToPath` + `realpath` as for CallSites.
  - Add U1 tests for syntax errors, `enum`, and a missing named import. Change "no regex" to "CallSites first, the header/frame text as fallback".

### M2. D4 catches layout-time throws only; throws in detach, pre-layout and post-layout keep no location, and 結果 claims more than that
- **Location:** ADR l.66 (`ctx.stack` + `deferred` only), l.119 ("`build-error` は投げた行(レイアウトの誤りなら、その部品の行)に戻る").
- **What happens (ran, `errs.ts` with the D2 spike in place):**

  | source | message | tagged | user frame |
  |---|---|---|---|
  | `connect('a','nope')` | unknown anchor id | **yes** | none |
  | `image('./missing.png', …)` | `image(): cannot read …` (`lib/image-file.ts:21`, run from `detach()` in `lib/dsl/render.ts:17-21`) | no | none |
  | `box({reveal: 2, until: 1})` | `box(): until 1 must be later than its reveal 2` (`lib/reveal.ts:22`, pre-layout `prepareReveal`) | no | none |
  | `diagram({spotlight: 'zz'})` | unknown anchor id (`lib/spotlight.ts:161`, post-layout) | no | none |

  Read: other throws outside `ctx.stack` are `lib/today-auto.ts:6,14` (`fillAutoToday` in `detachData`), `lib/reveal.ts:50,63`, `lib/layout-measure.ts:163` (measurement, before `layoutWith`), and the pass-1 walk at the start of `layoutBands` (`lib/layout.ts:58-250`). A missing image path or a wrong `until` is an ordinary author mistake, and all of these still land on line 1.
- **Also:** a non-Error throw (`throw 'x'`; ran, `d3/thrower.ts`) cannot take a property. `err[SOURCE] = ref` silently does nothing.
- **Fix:**
  - Add a small helper `atBand(band, fn)` (tag the error unless it is already tagged, then rethrow) and use it in each per-band pass: the `resolveImages` walk, `prepareReveal`'s per-band visit, `fillAutoToday`'s gantt loop, and the pass-1 walk.
  - Add a diagram-level fallback: in `renderDiagram`/`checkDiagram`, catch and set `err[SOURCE] ??= d[SOURCE]` (diagram()'s location, see m3), so option errors (`spotlight`, `fill` without `slide`) land on `diagram(...)`.
  - Wrap non-Error throws once: `new Error(String(e), {cause: e})`.
  - Reword 結果 so it covers only what is actually handled, and list these cases in U2a's test.

### M3. D7 collides with the spec location mechanism that already exists: field name, path syntax, deck prefix, and which key carries the stamp
- **Location:** ADR l.94 (D7: `specToDiagram` stamps `/parts/3`, findings get `path: "/parts/3"`, decks `/slides/4/diagram/parts/3`, "行と桁は、エディタが JSON を読んで出す").
- **What happens (read):**
  - The spec path already returns located messages with a **`path` field in a different syntax**: `LocatedMessage {path: string | null; …}` (`lib/spec.ts:845-852`) is filled by `locateMessage`/`locateVerdict` (`lib/spec.ts:855-919`). They find the part from the quoted text of the message (`parts[3]`, `parts[2].links[1]`) and are used by `lib/spec-edge.ts:79-87`, `lib/spec-render.ts:87-94`, `lib/pptx-edge.ts:63` and `assemble()`'s build-error catch (`lib/spec.ts:788`). `SpecIssue.path` uses the same syntax (`parts[${i}]`, l.784). Decks prefix it as `slides[i].figure.…` and `slides[i].columns[j].figure.…` (`lib/deck-spec.ts:68-72`). The deck key is `figure`, not `diagram`.
  - So D7 as written would (a) change the syntax of a field the MCP tools (`check_diagram`, `render_diagram`; the ChatGPT/Copilot plugin) already return, (b) not say that it replaces the text heuristics, and (c) use a deck prefix that does not exist.
  - "Survives the same copies": D2 copies **only** `SOURCE` in `cloneData`, and `applyConnectDefaults`/`expandLoopBacks` copy only `SOURCE`. A stamp on any other symbol is dropped before layout. If the stamp rides on `SOURCE`, D2's "never overwrite" blocks it whenever capture is on, because `lib/spec-parts/*.ts` and `lib/spec.ts:7` import the **wrapped** `dsl-pure` exports, so their bands are tagged first.
  - "エディタが JSON を読んで出す": `check` takes only `.ts` sources (`check-diagram.ts` has no `.json` path), so the VS Code extension is not a D7 consumer today.
- **Fix:**
  - Keep the existing `path` syntax (`parts[3].links[1]`, and `slides[4].figure.parts[3]` for decks), or add a new `pointer` field and leave `path` as it is.
  - Say that D7 makes `locateMessage`/`locateVerdict` use the stamp first and fall back to the text search.
  - Carry the stamp in `SOURCE` as a `SourceRef` variant (`{specPath}`) that takes precedence over a stack-based ref. Either the overwrite rule says "a spec stamp replaces a stack ref", or `assemble()` stamps after `partDef.build(part, at)` with nested tagging and overwrite allowed.
  - Since D7 needs structured problems to flow out, list it as depending on U3.
  - Name the real consumers (MCP, `spec-edge`, deck validation), not the editor.

## Minor

### m1. `image()` and `math()` are not wrapped, and the U2b table misses them
- **Location:** ADR l.36, l.101. Code: `lib/dsl/io.ts:24-25, 128-129` (exported from `lib/dsl.ts:15` only, not from `dsl-pure`).
- **What happens (ran, `lines.ts examples/image-spotlight.ts`):** the image band resolves to `add@5:76` (the `.add(` call). Its own call is `image(…)` at l.7. The U2b check "`Object.entries(dslPure)` with no table entry fails" cannot catch this.
- **Fix:** also wrap the band-returning exports of `lib/dsl/io.ts`, and enumerate `lib/dsl.ts`'s runtime exports in U2b (with `build`, `renderDiagram`, `checkDiagram`, `closeMeasurer` listed as non-band).

### m2. `located<F>(fn: F): F` drops a function's own properties: `quadrant.preset` breaks
- **Location:** ADR l.27, l.36.
- **What happens (ran):** with a plain wrapper, 9 examples (`quadrant-ansoff.ts`, `-bcg`, `-ge`, …) fail with `quadrant.preset is not a function`. The identity type hides this from `tsc`. `quadrant` is the only export with an own property (enumerated at runtime). `preset` returns a band, so it needs wrapping too.
- **Fix:** in D2, say that `located` copies the function's own properties and wraps any that are functions (`quadrant.preset`). Add `quadrant.preset` to the U2b table.

### m3. `diagram()` cannot be tagged under the stated rule, so diagram-level locations and the bands that options add have no source
- **Location:** ADR l.37 (tag only objects with a string `type`), l.68 and l.86 ("図全体は `diagram()` の位置").
- **What happens:** `DiagramData` has no `type` (read, `lib/types/core.ts:203`), so `located(diagram)` tags nothing. Ran: 86 laid-out captions are untagged, all of them the `sourceLine` caption (`出典: …`) added by `withSourceLine` (`lib/layout-util.ts:214-216`, inside `layoutBands`, l.58). The `withTitleLine` and `withStatus` bands are the same. The auto legend (15) is untagged by design.
- **Fix:** special-case `diagram()`: put `SOURCE` on the returned Diagram (the `detachData` spread keeps it). Have `withTitleLine`/`withSourceLine`/`withStatus`/the auto legend take `d[SOURCE]`. D4's "diagram() の位置" then has something to read, and M2's fallback too.

### m4. Structured problems: the ADR does not say where they live or how the per-band producers get a `loc`
- **Location:** ADR l.67.
- **What happens (read):** "Derive the strings at the end" leaves open which `Verdict` field holds the structured list. Today's consumers read `verdict.problems` as `string[]` (`check-diagram.ts:411`, `lib/spec.ts:916`, `lib/dsl/io.ts:89`, `show-diagram.ts`, `serve-diagram.ts`, `lib/present/*`, `worker/src/*`), so `Verdict` will have to expose both. There are 99 `problems.push` sites, 53 of them in `lib/verify-handlers.ts` behind `out.problems`. `build()` flattens problems into an Error message (`lib/dsl/io.ts:88-89`), so `build`, the drift `drift-rebuild-failed` (`check-diagram.ts:364-368`) and the preview lose any location. A `SourceRef` in a string-keyed field also arrives as junk after `structuredClone`/`postMessage` (`lib/render-sync-worker.ts`).
- **Fix:**
  - Make `Verdict.issues: Problem[]` the single source and compute `problems = issues.map(p => p.message)` in `verifyDiagram` only.
  - Give each handler a per-band `out` in `runCheckPhase`/`contrastProblems`. It wraps the strings pushed there into `{message, loc: band[SOURCE]}`, so the 53 sites stay as they are.
  - Keep `loc` as the opaque `SourceRef` in process, and resolve it in the CLI.
  - Carry the structured problems on the error that `build()` throws (`err.issues`).

### m5. D6's map is missing exactly when the preview needs it
- **Location:** ADR l.80-91. Code: `lib/dsl/io.ts:88` (`build` throws before writing when verification fails). The extension's preview runs `build` (`~/svg-diagram-vscode/src/preview.ts:115`).
- **What happens (read):** when the figure has overlaps or out-of-bounds problems, no SVG and no `--locations` map are written. The preview shows the error text, so "click to source" is not there when there is something to fix.
- **Fix:** write the map, or let the preview call `check --format json` for problem locations, even when verification fails. Or say plainly that the map exists only for figures that pass.

## Nit

- **n1 (D2 l.35):** if `SourceRef` is written the way the round-1 fix text sketched it (`constructor(readonly holder)`), it fails to load. Ran: `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX: TypeScript parameter property is not supported in strip-only mode`. Note that it needs plain fields, because the repo runs `.ts` through type stripping.
- **n2 (D3 l.56):** a `location` in another user file comes from a stack path, which is a realpath. In a workspace opened through a symlink, `path.relative(cwd, realpath)` gives a path the extension does not match to the open document. Map it back through the logical path, or document this.
- **n3 (D2 l.49):** capture is on for `check --drift --rebuild` (the golden CI, all `examples/*.ts`), which never reports a figure finding. It is cheap, but turning it on only when figure findings are reported would cut it.
- **n4 (D2 l.35):** use `Symbol.for('svg-diagram.source')`. The resolve hook redirects only the bare `svg-diagram` specifier (`lib/resolve-hook.ts:32`). `svg-diagram/spec` and the other subpaths load a second copy from `node_modules`, whose `Symbol()` would differ.
- **n5 (D2/D3):** `located` is reachable from the browser entry (`lib/web.ts` → `dsl-pure`, `test/web-entry.test.ts` forbids `node:*`). Say that the D3 resolver (`fileURLToPath`, `realpath`) lives in a separate, CLI-only module, and that "the directory of the module defining `located`" comes from its `import.meta.url`.
- **n6 (U1 l.99):** U1 does stand on its own. Define-time errors get `line`, and the current extension already uses `f.line` (`src/check.ts:66`). It does need the M1 fallback to deliver what it claims. The M1/M3 tests should also run on the Node 22 CI job (`.github/workflows/test.yml:20`), since I could only run 25/26 here.

Counts: Blocker 0 / Major 3 / Minor 5 / Nit 6
