# Review round 3: ADR 0072 (source locations for findings and parts)

**Scope / Baseline.** I reviewed `docs/adr/0072-source-locations.md` at 0e82782 (branch `docs/adr-source-locations`, draft PR #400) against the core code at that commit. First I checked each round-2 finding (`0072-opus-review-round2.md`) against the revised text. Then I re-read the whole ADR, focusing on the new parts:
- the CLI-wide `Error.prepareStackTrace` and the text-stack fallback (D3);
- `atBand` and the diagram-level catch (D4);
- `Verdict.issues` and the per-band `out` (D4);
- the `diagram()` `SOURCE` and what inherits it (D2);
- D7 stamps;
- `--locations` writing the map before it fails (D6).

**Spikes, run on Node 22.23.5, 25.9.0 and 26.13.0.** 22.23.5 is the official tarball, sha256-checked, so the 22 gap from round 2 is closed.
- `probe3.mjs`: installs the hook exactly as D3 describes it (it stashes the CallSites under a symbol and returns the usual text), imports broken sources, and parses the header and caret.
- `hook.mjs`: the same hook as an `--import`, run through the real `check-diagram.ts`. That run includes the in-thread resolve hook and `SVG_DIAGRAM_DEBUG=1`. It ran in a detached scratch worktree, now removed.
- `sm/`: `--enable-source-maps` with and without the hook.

Files are in `/tmp/claude-1002/-home-cuzic/0926059a-61aa-4814-bcfe-b2e2d373d9e0/scratchpad/review-0072-r3/`. "Ran" means a spike showed it. "Read" means I checked it in the code.

**Headline:** the new mechanisms work as designed.
- **The hook (ran).** On 22, 25 and 26, a CLI-wide hook does not disturb Node's decoration of syntax errors. The `path:line` header, the code frame and the `SyntaxError [ERR_…]` line all come through unchanged, both standalone and under the real CLI with the resolve hook. The header and caret are present for `return a +;`, `enum`, `namespace`, parameter properties, and a missing named import, including one that sits in a helper file.
- **Throws outside layout (read).** `atBand` fits every per-band loop it names: `resolveImages` (`lib/image-file.ts:32-39`), `prepareReveal`'s `walk` (`lib/reveal.ts:31-47`), `fillAutoToday` (`lib/today-auto.ts:12-16`). The diagram-level catch fits `renderDiagram` and `checkDiagram` (`lib/dsl/render.ts:27-89, 92-99`).
- **Per-band `out` (read).** It is a local change to `runCheckPhase`/`contrastProblems` (`lib/verify-handlers.ts:393-403`), and nothing downstream mutates `verdict.problems` after `verifyDiagram`.
- **Bands that `diagram()` options add (read).** `withTitleLine`/`withSourceLine`/`withStatus` and `applyAutoLegend` all receive `d`, so inheriting `d[SOURCE]` is straightforward (`lib/layout-util.ts:211-216`, `lib/layout.ts:56`, `lib/rules.ts:269-299`).

The one design-level problem is in D7. The rule "stamp first, then the text guess" makes the existing spec paths coarser.

## Round-2 findings: status

- **M1** (syntax and module-load errors carry no CallSites): **resolved in the text** (l.54-55, U1 l.112). Ran: the hook plus the header/caret parse works on 22, 25 and 26. Two details remain. The fallback's trigger condition is wrong once the hook is installed (m1). The caret gives a display column, not a character column (m2).
- **M2** (throws outside `ctx.stack`): **resolved** (l.67, l.70-71, U2a l.113, 結果 l.132). The non-Error wrap and the reworded 結果 are both in. See m4 for the diagram-level fallback taking precedence over a user frame.
- **M3** (D7 vs the existing spec `path`): **resolved** for syntax, field name, deck prefix, carrier, overwrite precedence, U3→U4 dependency and consumers (l.100-107). New issue in how the stamp is used: M1 below.
- **m1** (`image`/`math`, U2b over `lib/dsl.ts`): resolved (l.36, l.114). mathjax-full is installed as a dev dependency, so the U2b table can call `math()`.
- **m2** (`quadrant.preset`): resolved (l.41, l.114).
- **m3** (`diagram()` tagging, option bands): resolved (l.42).
- **m4** (where structured problems live): resolved (l.72). Partial loss for row/grid children: m3.
- **m5** (map missing on failure): resolved in intent (l.92). Plumbing unspecified: m5.
- **n1–n6:** resolved (l.35, l.58, l.50, l.35, l.35 + l.57, l.112). One knock-on from n3 is noted in n5.

## Blocker

None.

## Major

### M1. D7's "stamp first, else the text guess" makes every stamped spec path coarser than today
- **Location:** ADR l.103 (`{specPath: 'parts[3]'}` on the returned part **and the parts inside it**), l.104 (`locateMessage`/`locateVerdict` use the stamp when present, else fall back to the text search), l.105 (stamps always on).
- **What happens (read):**
  - Today the text search returns **field-level** paths. `leaves()` records a path for every text field (`lib/spec.ts:807-813`), and `locateIn` returns the matching one (`lib/spec.ts:828-845`), for example `parts[0].nodes[0].label`. That exact shape is pinned in `test/spec.test.ts:481-482` (`locateVerdict`), and similar paths in `test/spec.test.ts:243-311` and `test/spec-board.test.ts:128-137`.
  - Board connectors are located per link by `linkOf` (`lib/spec.ts:868-875`): `parts[i].links[j]`.
  - Under D7 the stamps are always on, and every band nested in a part gets the part's own `parts[i]`. So the stamp wins for practically every message, and the MCP `check_diagram`/`render_diagram` paths, `spec-edge` and `pptx-edge` lose precision:
    - `parts[0].nodes[0].label` becomes `parts[0]`;
    - `parts[2].links[1]` becomes `parts[2]`.
  - The models that consume these paths edit the spec by path, so the result is a regression in the field D7 promises not to change (l.100 "この形と欄の名前は変えない").
  - The stamp is better in exactly one case: the same text in two parts, where `commonPlace` gives up (l.818-823).
  - The existing tests feed a synthetic `Verdict` with no `issues`, so they would not catch this.
- **Fix:** use the stamp to **scope** the text search, not to replace it:
  - when `loc` carries `specPath`, try `linkOf` restricted to that part, then `locateIn(partAt(specPath), specPath, message)`, and fall back to the bare `specPath`;
  - use the global text search only when there is no stamp.
  - Add a test in which a label that appears in two parts lands in the stamped part, and a label that appears once keeps its `.label` path.

## Minor

### m1. The text fallback is gated on "no CallSites", but with the hook installed every error has CallSites
- **Location:** ADR l.55 ("文字のスタックも読む(CallSite がないとき)").
- **What happens (ran, `probe3.mjs`, 22.23.5/25.9.0/26.13.0):** once the CLI-wide hook is installed, `return a +;`, `enum`, `namespace`, a parameter property and a missing named import all **do** get a CallSite stash. It holds only `node:internal/modules/typescript` / `module_job` frames, so after D3 filtering it is `[]`. Implemented literally, the header parse never runs, and these errors land on no line. The U1 tests would catch this, but the rule as written is wrong.
- **Fix:** order D3 as follows:
  1. the header, if the first stack line is `path:line` (the error is about that file even when user frames follow, for example a dynamic `import()` of a broken file inside `define()`);
  2. user frames from the CallSites;
  3. `at …:line:col` frames from the text.

  In other words, fall back when no **user** frame resolves.

### m2. The caret gives a display column; tabs and CJK text shift it
- **Location:** ADR l.55 (column "from the `^` line"), 結果 l.132 ("構文の誤りはその行と桁").
- **What happens (ran, 22.23.5 and 26.13.0):** Node's code frame expands a tab to 4 spaces and counts East Asian wide characters as 2. Two cases:
  - `\treturn a +;`: the caret is at column 15; the `;` is at character column 12.
  - `  const s = "日本語"; return s +;`: the caret is at column 33; the real column is 30.

  Labels in this tool are mostly Japanese, so a syntax error on a line with a label gets its squiggle shifted right. The line is always correct.
- **Fix:** read that source line and map the caret's display offset back to a UTF-16 column (tab = 4, East Asian Wide/Fullwidth = 2), or emit only `line` for header-parsed errors. Add a U1 case with Japanese text before the error on the same line.

### m3. The per-band `out` gives row/grid children the row's location
- **Location:** ADR l.72 (`runCheckPhase`/`contrastProblems` pass a per-band `out`; "四角(CheckRect)は元の部品の loc を持ち").
- **What happens (read):** row and grid children are not entries of `d.laidOut`. Their handler walks them:
  - `nowrap`: `for (const c of band.children) checkNoWrap(c, out)`;
  - `contrast`: `band.children.flatMap(c => contrastFor(c, …))`;
  - `rects`: `childRects` (`lib/verify-handlers.ts:53, 320-321`).

  The child boxes carry their own `SOURCE` (round 2 ran this), but a per-band `out` and a per-band rect `loc` both resolve to the `row(…)` call. Rows of boxes (`steps`, `row([box…])`) are the most common construction. The extension then has to search the label inside the whole row call, which is the D1 fallback, so this is a precision loss, not a wrong location.
- **Fix:** let `childRects` set `loc: c[SOURCE] ?? band[SOURCE]`, and have the row/grid handlers push through a per-child `out` (for example `outFor(c)`). Say in D4 that "元の部品" means the child when the rect is a child's.

### m4. The diagram-level fallback outranks a precise user frame
- **Location:** ADR l.66 (`SOURCE` first, then the stack), l.71 (`renderDiagram`/`checkDiagram` put `diagram()`'s `SOURCE` on anything uncaught).
- **What happens (read):** `raw({draw})` runs the user's `draw` callback at emit time (`lib/emit-boxes.ts:282`), inside `renderDiagram` (`lib/dsl/render.ts:88`), outside `ctx.stack` and every `atBand`. If it throws, the stack has the exact user frame, but the diagram-level catch writes `diagram()`'s `SOURCE` onto the error, and D4 reads `SOURCE` first. The `build-error` therefore lands on `diagram(...)`, not on the line in `draw` that threw. Tool bugs (a `TypeError` inside `lib/`) are pinned to `diagram(...)` the same way, which l.75 ("誤った位置は出さない") argues against. `check` never emits, so this affects `build` (and the preview path) only.
- **Fix:** do not write the fallback into `err[SOURCE]`. Keep it as the **last** step of the D3/D4 resolution, used only when neither a band `SOURCE` nor a user frame resolves (for example `err[DIAGRAM_SOURCE]`).

### m5. `--locations` on a failed build: the plumbing and the multi-source case are unspecified
- **Location:** ADR l.85, l.92.
- **What happens (read):** `build` throws inside `finishBuild` (`lib/dsl/io.ts:86-89`), which is not exported. `build-diagram.ts:148` calls only `build()`, so on a verification failure the CLI has neither `laidOut` nor the rects to write a map from. `build` also takes `<source.ts>...` (`build-diagram.ts:106-108`), and `--locations FILE` names a single file.
- **Fix:** say that `build()`'s verification error carries `laidOut` (or the map itself) next to `issues`, or that `build-diagram` calls `renderDiagram` and then a public `finishBuild`. Define `--locations` with several sources: reject it, take a directory, or write one JSON keyed by source.

## Nit

- **n1 (D3 l.55):** the header regex must allow spaces. The round-2 sketch `(file://\S+|/\S+|…):(\d+)$` fails on `…/日本 語/syn.ts:3` (ran: no header match). The plain-path form keeps the raw space, and only the `file://` form percent-encodes it. Use `^(.+):(\d+)$` on the first line. Add the space/Japanese path test (l.112) for a syntax error too, not only for helper throws.
- **n2 (結果 l.132):** `ERR_MODULE_NOT_FOUND` (a typo in an import path) and `ERR_IMPORT_ATTRIBUTE_MISSING` have neither a header nor a user frame (ran, all three Node versions), so they stay unlocated. This is not a regression, since 0.5.0 had none either. Either say so, or add a cheap fallback: when the message says `imported from <the checked source>`, find the quoted specifier in that file.
- **n3 (D3 l.54):** a user-set `Error.prepareStackTrace` turns off `--enable-source-maps` rewriting (ran on 22 and 26: `orig.ts:4:3` without the hook, `comp.mjs:1:29` with it). This only matters for users who import compiled JS helpers with maps or set `NODE_OPTIONS=--enable-source-maps`, and for the `SVG_DIAGRAM_DEBUG` output. Note it, or have the resolver map CallSites with `module.findSourceMap` when `process.sourceMapsEnabled`.
- **n4 (テストの注意 l.118):** "捕捉は既定で切ってあるので、今のテストは変わらない" does not hold for D7, whose stamps are always on. Every test file uses `node:assert/strict`, whose `deepEqual` compares enumerable symbols. I found no test that deep-compares spec-built band trees (read), but the note should mention D7.
- **n5 (D2 l.50 vs D4 l.72):** capture is off for `--drift`, yet D4 says `build()`'s error `issues` let `drift-rebuild-failed` report positions. Without capture they have no `loc`. Drop that claim, or turn capture on for `--drift --rebuild`.
- **n6 (D4 l.70):** `prepareReveal` throws in two places: in the per-band `walk`, and in the connector loop after it (`lib/reveal.ts:51-67`: the `until` check at l.63 and `resolveAnchor`'s ambiguity throw). Name both places for `atBand`, and add a connector `until` case to U2a's tests next to the box one.

Counts: Blocker 0 / Major 1 / Minor 5 / Nit 6
