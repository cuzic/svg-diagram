# PR #409 review (Opus, round 1)

Target: `feat/source-locations-u2a` @ `6409b1a52d0bdf401c647329aef45d0919385969`

## Conclusion

The carrying is right. Every path the spec names copies or fills `SOURCE`. Fills never overwrite a more precise inner mark, and errors are tagged with the innermost band. `DIAGRAM_SOURCE` is only a last resort and is never written to `SOURCE`. With capture off (the default), no `SourceRef` is created and nothing changes. A probe over all 191 examples found no laid-out band or `row` / `grid` child whose mark was less precise than an input band with the same type and title/text/id. The only container-owned marks are generated captions (title lines, group titles), the legend, and the wrapper rows of box cells in `areas` / `grouprow` (their inner box keeps its own mark). Error tagging probes (a stamp too wide in a nested group, a duplicate anchor id, a stamp in a group stretched inside a row) all name the right band. `checkDiagram` timing over all examples is the same as on `main` (about 0.9 to 1.0 s per pass on both, 4 passes each).

One Major: the `atBand` around the handler dispatch in `ctx.stack` is the main layout-time error path of D4 (round 1 M4), and no test reaches it. Removing it leaves all 15 tests green. The rest are test-strength gaps and a trivial conflict with #407.

## Previous round

None.

## Findings

### M1 (Major): the `ctx.stack` error tagging, D4's main layout-time path, is untested
- `lib/layout.ts:359` (`for (const band of bands) atBand(band, () => { … })` in `ctx.stack`).
- Evidence: I replaced that `atBand` with a plain call (`((_b, f) => f())(band, () => {…})`), and `node --test test/source-ref.test.ts` still passed 15/15. The error tests in `band errors carry the source of the part that failed` all throw somewhere else. The unknown anchor goes to the deferred loop, the image to `resolveImages`, `until` to `prepareReveal`, `today` to `fillAutoToday`, and the bad `areas` to the first walk. None of them throws inside a layout handler. By hand the behaviour is right. `group([group([box], {stamp: <too long>})])` at `width: 300` gives `SOURCE` = the inner group. Two `box({id: 'x'})` give `SOURCE` = the second box. A stamp too wide in a group inside `row([box, group])` gives `SOURCE` = that group.
- Fix: add cases to that test that throw inside a handler, below a nested `ctx.stack`. For example, the too-wide `stamp` on an inner group inside a marked outer group (expect the inner group's ref), and a duplicate anchor id (expect the second box's ref). Then check that the mutation above fails them.

### m1 (Minor): the all-examples test checks the exact ref only for bands with a unique id
- `test/source-ref.test.ts`, `sourceProblems`: when a laid-out band has no unique `id` match (and a `row` / `grid` child has no row/grid owner and no unique box match), `check` only asks that the ref belongs to *some* input band (`inputByRef.has(ref)`).
- Evidence: a mutation in `markLayoutRange` that lets the parent overwrite every laid-out band except `box` / `group` / `row` / `grid` (so captions, tables, charts and banners inside a group get the group's ref) passes `checkDiagram carries source references in every example`. Only the hand-written stretched-group test fails, and only because of its group title. A mutation that overwrites boxes too is caught, but only through examples whose boxes have ids (areas-memo, immunity-map, service-blueprint, …).
- Fix: make "wrong" stricter without an id. For example, fail when a laid-out band's ref belongs to a container input (`group` / `row` / `grid` / `grouprow` / `areas` / `tree` …) unless the laid-out band is that container's own frame, its title caption or its wrapper row. Or match by type plus title/text when that is unique, as with boxes.

### m2 (Minor): the connect fills in `ctx.stack` and in the deferred loop are never exercised, and they disagree
- `lib/layout.ts:363-364` (the fill is l.364) (`for (let i = firstConnect; …) withSource(connects[i], ref)`) and `lib/layout.ts:375` (`connects.push(withSource(resolved, sourceOf(band)))`).
- Evidence: removing either one leaves all tests green. `resolveConnect` already returns `{...band, …}` (`lib/layout-connect.ts:164, 315`), so the connect band's own mark always comes through. The two fills also differ. An immediate connect without its own mark gets the enclosing stacked band's ref (for example, its group). A deferred one gets only its own band's ref, so without one it stays unmarked. This can't happen today, because `add()` marks every band when capture is on. It would matter once a handler or a pre-layout pass makes a connect band without a mark.
- Fix: either drop the two fills and say in a comment that `resolveConnect`'s spread carries the mark, or keep them, give a deferred connect the ref of the band whose `ctx.stack` deferred it (record it next to `ctx.deferred`), and add a test with an unmarked connect inside a marked group, immediate and deferred.

### m3 (Minor): conflict with PR #407 on the ADR status line
- `docs/adr/0072-source-locations.md` line 3. #407 rewrites it to `決定・U1 実装済み(…`, and this PR appends `U2a 実装済み`. `git merge-tree HEAD origin/feat/source-locations-u1` reports a content conflict there. `test/helpers/shell.ts` merges cleanly. No other file overlaps (#407 touches `lib/source-location*.ts`, `lib/error-format.ts`, the CLIs and `test/cli.test.ts`).
- Fix: whichever PR merges second writes one line, `決定・U1・U2a 実装済み(…)`.

### n1 (nit): a non-`Error` throw now rejects as an `Error`, even with capture off
- `lib/source-ref.ts` `asError`, used by `atBand` and `throwAtDiagram`. A library caller of `renderDiagram` / `checkDiagram` that threw a string from `raw({draw})` used to get the string back, and now gets an `Error` with the string as `cause`. The CLI and MCP read `.message` / `String(e)`, so they print the same text. ADR D4 and the spec ask for this. Worth one line in the CHANGELOG when U2b ships.

### n2 (nit): wrapper rows of box cells carry the container's mark
- In `areas` / `grouprow`, a box cell becomes `{type: 'row', children: [box]}`. `carryLayoutSources` gives the wrapper the `areas` / `grouprow` ref, while the inner box keeps its own (the probe found 7 `row<-areas` and 1 `row<-grouprow`). That is fine for U2a. When U3's `collectRects` reports on rows, it should read the single child's mark (D4 already says so for row/grid children). A short note in `carryLayoutSources` would help.

## Verdict

converged: no (Blocker 0 / Major 1 / Minor 3 / nit 2)
