# Review round 4: ADR 0072 (source locations for findings and parts)

**Scope / Baseline.** I reviewed `docs/adr/0072-source-locations.md` at 07c88df (branch `docs/adr-source-locations`, draft PR #400) against the core code at that commit. First I checked each round-3 finding (`0072-opus-review-round3.md`) against the revised text. Then I re-read the whole ADR for Blockers and Majors and for internal consistency. I focused on the text added this round:
- the D3 reading order and the caret-column conversion;
- the `ERR_MODULE_NOT_FOUND` search;
- `module.findSourceMap`;
- `DIAGRAM_SOURCE`;
- the per-child `out`;
- `build()`'s error carrying `issues` and `laidOut`;
- `--locations` as a directory;
- D7 narrowing.

**Spikes, run on Node 26.13.0 and on the official 22.23.5 tarball from round 3.** The files are in `/tmp/claude-1002/-home-cuzic/0926059a-61aa-4814-bcfe-b2e2d373d9e0/scratchpad/review-0072-r4/`:
- `probe4.mjs`: the round-3 hook probe with the ADR's `^(.+):(\d+)$` header regex;
- `caret.mjs` and `caret2.mjs`: caret position versus source line, for the type-stripping (swc) frames and for V8's own frames;
- `mnf.mjs`: the `ERR_MODULE_NOT_FOUND` messages, run with an in-thread `registerHooks` resolve hook;
- `fsm.mjs`: `findSourceMap` called on the CallSites that the hook stashes.

No worktree was created. "Ran" means a spike showed it; "read" means I checked it in the code.

**Headline:** no Blocker and no Major. The round-3 Major is resolved, and the design hangs together. What remains are details of the new D3 text-parsing rules, which two spikes contradict, and one gap in the `--locations` plumbing.

## Round-3 findings: status

- **M1** (D7 makes spec paths coarser): **resolved** (l.105). The stamp now narrows `linkOf`/`locateIn` to the stamped part and falls back to bare `parts[i]`. Without a stamp, the global search runs as today. Both tests are named.
  - Read: `locateIn(v, at, msg)` already takes a sub-tree and a prefix (`lib/spec.ts:828-845`), so `locateIn(parts[i], 'parts[i]', msg)` yields `parts[i].nodes[k].label` unchanged.
  - Read: board connectors are elements of the array that the part's `build` returns (`lib/spec-parts/board.ts:295-307`), and `assemble` passes that array to `d.add` (`lib/spec.ts:785`). So the connectors receive the `parts[i]` stamp, and `linkOf` restricted to that part works.
- **m1** (fallback gated on "no CallSites"): **resolved** (l.55, order (1) header, (2) CallSite user frames, (3) text frames). The new rule (1) matches too much; see m1 below.
- **m2** (caret is a display column): **resolved in intent** (l.55). The conversion rule is right only for one of the two frame formats; see m2 below.
- **m3** (row/grid children get the row's loc): **resolved** (l.72, per-child `out`, `childRects` uses the child's `SOURCE`).
- **m4** (diagram-level fallback outranks a user frame): **resolved** (l.66, l.71: `DIAGRAM_SOURCE` is a separate key and the last step).
  - Read: `raw({draw})` is the only user callback that runs after `define()` (`lib/emit-boxes.ts:282`), and the ADR now says it resolves to its user frame.
- **m5** (`--locations` on a failed build): **resolved for the failure path** (l.72, l.92-93). The success path has the same gap, and the meaning of the flag switches with the number of sources; see m4 below.
- **n1** (header regex must allow spaces): resolved (l.55, `^(.+):(\d+)$`). This regex is what over-matches in m1.
- **n2** (`ERR_MODULE_NOT_FOUND`): addressed with the specifier search (l.55). It does not work as written; see m3 below.
- **n3** (prepareStackTrace disables `--enable-source-maps`): resolved (l.54).
  - Ran (`fsm.mjs`, 22.23.5 and 26.13.0): under `--enable-source-maps` with the hook installed, `findSourceMap(callsite.getFileName())` returns the map. That works with the `file://` URL and with the plain path. `findOrigin(line, col)` maps `comp.mjs:1:29` to `orig.ts:4`, and the result's `fileName` is a `file://` URL, which l.56's `fileURLToPath` already handles. Without the flag it returns `undefined`, which is the intended no-op.
- **n4** (test note ignores D7): resolved (l.119).
- **n5** (`--drift --rebuild` positions): resolved (l.72, "今のとおり位置なし").
- **n6** (`prepareReveal`'s two throw sites): resolved (l.70, l.114).

## Blocker

None.

## Major

None.

## Minor

### m1. D3 rule (1) accepts any first stack line that ends in `:<digits>`, so ordinary error messages are read as a file header
- **Location:** l.55 ("(1) 先頭の行が `パス:行` なら … `^(.+):(\d+)$` で読む"), together with the order that puts (1) before the CallSite user frames.
- **What happens (ran, `probe4.mjs`, `d4/colon.ts`, 22.23.5 and 26.13.0):** `throw new Error('aspect must be 16:9')` inside `define()` has the stack first line `Error: aspect must be 16:9`. The regex matches it as path `Error: aspect must be 16` and line `9`. Rule (1) runs first, so it wins over the correct CallSite frame `colon.ts:1:42`. At best the resolver finds no file and drops the location. At worst it emits a `location` in a "file" called `Error: aspect must be 16`. That breaks l.75 ("誤った位置は出さない"), and it does so for user-thrown errors, the main U1 case.
- **Only decorated errors have a real header (ran).** Node prepends the header only to load-time errors. The header line is always followed by the source line and a `^` line: swc's `ERR_INVALID_TYPESCRIPT_SYNTAX`/`ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`, and V8's `SyntaxError` for a missing export. Runtime throws, including top-level throws in an ESM source (`d4/esmtop.ts`), get no header.
- **Fix:** take (1) only when line 3 (or the line after the source line) is a caret line `^\s*\^+\s*$`. Alternatively, take it only when `err` is a `SyntaxError`, or when the parsed path, after `fileURLToPath`, exists. Add a U1 case that throws a message ending in `:<digits>`.

### m2. The caret conversion holds only for the type-stripping frames, and their tabs go to tab stops, not 4 columns
- **Location:** l.55 ("`^` の桁は表示の幅(タブは 4、全角は 2)なので … UTF-16 の桁に直す").
- **What happens (ran, `caret.mjs`/`caret2.mjs`, 22.23.5 and 26.13.0):** two different printers make the code frame.
  - **swc (type stripping: `return a +;`, `enum`):** the frame is in display width. Full-width characters count 2 and half-width kana count 1 (`d4/hwkana.ts`). An emoji counts 2, the same as its UTF-16 length. But a tab advances to the next multiple of 4, not by 4:
    - `" const s = 1;\treturn s +;"` renders the tab as 3 spaces (`d4/tab1.ts`);
    - `"  const s = \"ab\";\t…"` renders it as 3 spaces (`d4/midtab.ts`);
    - a fixed width of 4 puts the caret one character left, on `+` instead of `;`.
  - **V8 (the missing named import, which l.55 and U1 list):** the frame keeps the tab in the caret line, and `indexOf('^')` is already the UTF-16 offset. In `const s = "日本語"; import {nope}` the caret is at index 25, which is the character index of `nope` (`d4/v8imp2.ts`). The same holds with a tab (`d4/v8imp.ts`). Converting this one as display width moves it 3 or more columns left on any line with Japanese text, which is the case the ADR wants to fix.
- **Fix:**
  - Convert only when `err.code` is `ERR_INVALID_TYPESCRIPT_SYNTAX` or `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`, using a tab stop of 4 and East Asian Wide/Fullwidth = 2.
  - Otherwise, take the caret index as the UTF-16 column.
  - Extend the U1 Japanese-text case to the missing-import error and to a mid-line tab.

### m3. `ERR_MODULE_NOT_FOUND` quotes the resolved absolute path, not the specifier the user wrote
- **Location:** l.55 ("引用された指定子をそのファイルで探して位置にする").
- **What happens (ran, `mnf.mjs`, with an in-thread resolve hook, 22.23.5 and 26.13.0):**
  - `import {x} from './nope-typo.ts'` gives `Cannot find module '<abs dir>/nope-typo.ts' imported from <abs dir>/badspec.ts`.
  - `'./sub/nope'` gives `Cannot find module '<abs dir>/sub/nope' …`.
  - Only a bare package keeps the written form: `Cannot find package 'nopkg-typo' …`.

  So for the case the ADR names, a typo in a relative import path, the quoted text never occurs in the source, and the search finds nothing.
- **Fix:**
  - For `Cannot find module '<abs>'`, scan the source's import specifiers (static `from '…'` and `import('…')` literals), resolve each against the source URL, and pick the one whose resolved path equals `<abs>`.
  - For `Cannot find package '<name>'`, search for `<name>` itself, as now.
  - Put a relative-path typo in the U1 test, not only a package one.

### m4. `--locations`: the success path has no `laidOut`, and the meaning of one flag depends on how many sources there are
- **Location:** l.85 (`build --locations FILE`), l.92 (written "from the `laidOut` on `build()`'s error"), l.93 (several sources: a directory of `<名前>.locations.json`, "SVG の `--out` の名前の付け方と同じ").
- **What happens (read):**
  - **The success path.** `build()` returns `BuildResult` (`lib/types/verdicts.ts:50`, built at `lib/dsl/io.ts:134`). It has no `laidOut` and no rects. `build-diagram.ts:148` sees only that result. The ADR specifies how the map is written when `build` fails, but not in the normal case where it succeeds. Adding `laidOut` (or the map) to `BuildResult` is easy, but U4 should say so.
  - **The flag's meaning.** `--locations` names a file with one source and a directory with several, so a shell glob that happens to match one file writes a file where a directory was meant. The SVG side does not work this way: it has two flags, `--out` (single, `build-diagram.ts:94`) and `--out-dir`. The sentence "`--out` の名前の付け方と同じ" really describes `--out-dir`'s naming (`path.parse(modPath).name`, `build-diagram.ts:111`).
  - **`--stale`.** `--stale` skips up-to-date sources (`build-diagram.ts:125-131`), so those get no map. If the previous build ran without `--locations`, no map exists for them.
- **Fix:**
  - Say that `BuildResult` (or a `build()` option) carries `laidOut` or the map.
  - Either always take a directory, or split the flag into `--locations FILE` (exactly one source) and `--locations-dir DIR`.
  - Say that `--locations` disables the `--stale` skip, or that a skip still writes the map when it is missing.

## Nit

- **n1 (l.50 vs l.106):** l.50 says library users (MCP, `renderSpecEdge`, the browser) see "手間も、振る舞いの変化もない". D7 stamps every spec-built band, "いつも付ける(ライブラリの道でも)", with an enumerable symbol key. `Object.getOwnPropertySymbols` and `assert.deepStrictEqual` in a downstream library user's tests will see it. l.119 covers this repo's tests only. Narrow l.50 to "スタックの捕捉は".
- **n2 (l.55, l.113):** "26.13 と 25.9 で確かめた" and "試しは 25 と 26 でしかしていない" are stale. Round 3 ran 22.23.5 (and round 4 did again). Keeping the CI job is still right; drop the parenthetical or update it.
- **n3 (l.54):** V8 calls `Error.prepareStackTrace` lazily, on the first `.stack` read. So the CallSite symbol is absent until something reads `.stack` (ran, `fsm.mjs`: `e[CS]` was `undefined` before `void e.stack`). The resolver must read `err.stack` before the symbol. That is one line, but it is easy to miss, and the failure is silent: the location just falls back to (3).
- **n4 (D7 l.105):** the narrowing is stated for `locateMessage`/`locateVerdict`. Thrown layout errors in the spec path go through `layoutIssue(spec, err.message)` (`lib/spec.ts:896-899`, `lib/spec-edge.ts`, `lib/spec-render.ts`), which gets only the message. Under U2a those errors carry `err[SOURCE]`, with the spec stamp. Say whether `layoutIssue` takes it too. Ambiguous labels in thrown layout errors (for example an unknown anchor in one of two same-text parts) are where the stamp helps most.

Counts: Blocker 0 / Major 0 / Minor 4 / Nit 4
