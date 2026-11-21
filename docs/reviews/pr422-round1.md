# PR #422 review (Opus, round 1)

Target: feat/source-locations-u4b @ f8e65d441e4b864f368d0c32957de3e010504dc7

## Conclusion

The spec side of U4b does what ADR 0072 D7 and Issue #421 ask. Spec paths returned to MCP, `spec-edge`, `pptx-edge` and the deck prefixes are never coarser than on main. In every case I ran, they changed only where main returned `null`. Marks are on everywhere, cost nothing I could measure, and change no output.

One Major remains, on the CLI side. Overwriting the stack mark, plus the new early return in `locateError`, removes the `file:line:col` that `check` gave on main. This hits any `.ts` figure that builds through the public `svg-diagram/spec` entry (`specToDiagram`). It affects both thrown errors and layout problems. ADR D7 assumed `check` never sees spec marks, and that assumption is wrong.

## Previous round

None.

## What I ran

- Full `node --test "test/*.test.ts"` on the branch with `locateMessage` wrapped so that every call also computed the main result (the same function without `loc`): 599 calls, 56 carried a spec mark, and only 7 differed, all in the PR's own new tests, all `null`/`''` on main → a part or field on the branch. The suite's other failures are the same 8 environment failures the PR body lists (Chromium atoms, emoji font, lint/budget of examples); CI is green on all four jobs.
- Fuzz with the same instrumentation: every `partCatalog()` example alone and in pairs, under `canvas: {width: 1280, height: 360}` and `width: 320` to force problems. That was 1398 valid specs, 3150 locate calls (914 with a spec mark) and 416 differences. All 416 are `main: null → parts[i]`. None was coarser, none moved to another field, and none moved to another part.
- Every catalog example through `renderSpec`, `renderSpecEdge` and `planFigureEdge` on main and on the branch: the JSON of all three results is byte-identical (65/65). `specToDiagram` ×200 per example: 1125–1172 ms (main) vs 1149–1172 ms (branch), noise.
- Marks: every band in every catalog example (163 bands) carries `parts[0]` or the right `parts[i]`, and no band object is shared between two `specToDiagram` calls. So stamping never writes to a module constant or a frozen object. `structuredClone`/`postMessage` paths (`lib/present/render-thread.ts`, `lib/render-sync-worker.ts`) send only strings and SVGs. Symbol keys are dropped by both anyway.
- Hand mutations, all caught by `test/spec-source-locations.test.ts`: `linkOf` ignoring `firstIndex`; stamping only the top band (no `walkBands`); `pptx-edge`, `spec-edge` and `spec-render` each passing `e.message` instead of `e` to `layoutIssue`. The PR's own two mutations are also covered.

## Findings

### Blocker

None.

### Major

#### M1. `check` loses `file:line:col` for `.ts` figures built with `svg-diagram/spec`
- **Location:** `lib/spec.ts:788-792` (the stamp overwrites `SOURCE`, so the stack holder is dropped), `lib/source-location-io.ts:62-63` (`if (part?.specPath !== undefined && !part.stackHolder) return {via: []};`), `test/spec-source-locations.test.ts` (asserts `ref?.stackHolder === undefined` with capture on), `test/source-location.test.ts:24-30`.
- **What happens (ran):** a `.ts` figure whose `define()` returns `specToDiagram({...})`. `svg-diagram/spec` is a public, documented entry (README l.90).
  - Thrown layout error (`parts: [lane('a', 2), lane('b', 8, 96)]` from the PR's own test):
    - main: `✗ zz-probe/specfig.ts:9:10: swimlane(): 8 columns leave only 9px each …`
    - branch: `✗ zz-probe/specfig.ts: swimlane(): 8 columns leave only 9px each …`
  - Layout problem (`lane('b', 1)`):
    - main: `zz-probe/specfig.ts:9:10: "共有" overlaps "確認" by 744x41px`
    - branch: `"共有" overlaps "確認" by 744x41px`

    `--json` loses `line`/`column` in the same way.
  - Two causes:
    1. With capture on, the DSL wrappers had already put a stack mark on these bands, and main resolved it to the user's `specToDiagram` call. The spec stamp replaces that ref with one that has no stack.
    2. `locateError` now returns early on a specPath-only ref. That skips the error-stack and `DIAGRAM_SOURCE` fallbacks of D4 entirely, so even the error's own stack, which still holds the user frame, is ignored.
  - The same root cause reaches #423 (`build --locations` map entries from spec-built bands) and #419 (rule findings with `loc`, resolved by `locateSource` in `check-diagram.ts`).
- **Why Major:** the path is coarser for specific inputs (a line in the source becomes no location at all), on a public entry, and it changes the fallback order of D4. ADR D7's premise that "`check` は `.ts` しか受け取らないので … これを使わない" is wrong, because a `.ts` source can build its parts through `specToDiagram`.
- **Fix:**
  - Carry both marks instead of choosing one. Stamp `new SourceRef(sourceOf(band)?.stackHolder, at)`, one ref per distinct existing holder, or the top band's holder for the whole part. `specPath` still wins in `locateMessage`, and the CLI keeps its line.
  - In `locateError`, delete the early return. A ref without `stackHolder` simply yields no part location and falls through to the error stack, then to the diagram mark.
  - Change the two tests: with capture on, `stackHolder` is kept. A specPath-only ref yields no line from the part, but the error stack still resolves.
  - Add a CLI test: `check` on a `.ts` that calls `specToDiagram`, with a thrown layout error and with an overlap, both keeping `file:line:col`.
  - Amend the D7 sentence in the ADR. The spec mark takes precedence for `path`, and the stack is kept for the CLI.

### Minor

#### m1. Findings are not narrowed; after #419 they will carry `loc`
- **Location:** `lib/spec.ts:933` (`findings: verdict.findings.map(f => ({path: locateMessage(spec, f.message), …}))`).
- Issue #421 allowed going ahead with `issues` only while U3b is unmerged, so this is in scope as written. But once #419 lands, rule findings carry a spec-marked `loc` and still get the global text search. Duplicate-text findings (for example a contrast or density finding on one of two same-label boxes) will stay `null`.
- **Fix:** pass `f.loc` once #419 is merged, in whichever PR merges second, with a duplicate-label finding test. Note it in the ADR status line or as a follow-up.

#### m2. The board-link test does not exercise narrowing
- **Location:** `test/spec-source-locations.test.ts` "a stamped board connector problem still points to the link".
- On main this test also returns `parts[1].links[0]`, because the global `linkOf` finds the one `a → c` link. The test catches the `firstIndex` mutation, which is what it is for. It does not show a case where the mark changes the board-link answer, and because ids are unique in a figure, no such case can exist across boards. Rename it, or say so in the comment, so that no one reads it as coverage of a narrowing improvement.

### nit

- **n1.** The unknown-anchor `layoutIssue` test edits the built connector by hand (`connector.to = '共有:left'`), because spec validation rejects dangling anchors. That is fine, but a one-line note in the PR body would help: the D7 example "知らない anchor" cannot come from a valid spec today, and only thrown errors such as the swimlane column error reach `layoutIssue` naturally.

## Conflicts with open PRs

- #419 (U3b) and #423 (U4a): both conflict with this PR only in the status line of `docs/adr/0072-source-locations.md` (`git merge-tree`). Trivial, but whichever merges second must keep all the "実装済み" entries. M1 also touches their behaviour (see above).
- #374 (gantt, touches `lib/spec.ts`): merges cleanly.

## Verdict

converged: no (Blocker 0 / Major 1 / Minor 2 / nit 1)
