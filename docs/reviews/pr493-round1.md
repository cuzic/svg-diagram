# PR #493 review (Opus, round 1)

Target: feat/embed-id-prefix-inline @ 1efa6131c2243c514835e1536965e483f5efd87f

## Conclusion
The prefixing itself works. A sweep of all 203 examples (SVG and HTML forms) found no unrewritten reference and no shared id, and a two-figures-on-one-page check in Chromium found that every reference resolves inside its own figure. Default output is unchanged, and CI is green (test 1–3/3, golden).
converged: no. `idPrefix` accepts names with `.`, and with `html: true` such a prefix silently breaks every style of the HTML figure (M1). Two of the advertised API paths have no test, so mutations that drop the option survive (M2).

## Previous round
n/a (round 1).

## Findings

### M1 (Major): an `idPrefix` containing `.` is accepted, and it silently breaks every style of the HTML figure
- Evidence: `normalizeIdPrefix` allows `.` (`PREFIX_NAME = /^[A-Za-z_][\w.-]*$/`, lib/svg-ids.ts). `prepareHtmlForEmbedding` renames the root to `a.b` and rewrites the `<style>` selectors to `#a.b …`. CSS parses that as id `a` plus class `b`, so no rule matches. I ran `renderSource(examples/bars-bare.ts, {html: true})` and then `prepareHtmlForEmbedding(html, {idPrefix: 'a.b'})` in Chromium, and compared the result with `idPrefix: 'ab'`: all 13 of 13 elements under `.sd` had different computed styles (`position: relative/absolute` → `static`, background lost). The figure falls apart, and no error is raised. The SVG form is not affected, because its `<style>` has no `#id` selectors (sweep: 0 occurrences).
- Fix: drop `.` from `PREFIX_NAME`, keeping it the same as the `#([A-Za-z_][\w-]*)` that the selector rewriter already assumes, or CSS-escape the id in the selector rewrite. Add a test for an `html: true` render with that prefix. (`build --id-prefix a.b --html` has the same pre-existing problem through `idPrefixFor`, which keeps `.`.)

### M2 (Major): `renderDiagram({html: true, idPrefix})` and `spec/selective/node` `renderSpec({idPrefix})` are untested, and mutations survive
- Evidence: I ran test/embed-svg.test.ts, test/spec-selective.test.ts and test/svg-ids.test.ts with each mutation applied: 102 pass, 0 fail. (a) In lib/dsl/render.ts, replace `html: prepareHtmlForEmbedding(html, embed)` with `html`: the HTML returned by `renderDiagram` is no longer prefixed. (b) In lib/spec-selective-node.ts, drop the `{idPrefix, inline}` argument of `finishNodeSpec`. The HTML test calls `prepareHtmlForEmbedding` directly, and `renderSpec` is only tested through `spec-render`.
- Fix: add `renderDiagram(…, {html: true, idPrefix})`: the root becomes the prefix, and every id and `#id` selector is prefixed. Also add `spec/selective/node` `renderSpec(…, {parts, idPrefix, inline})`.

### m1 (Minor): the README names the wrong entry for the selective `renderSpec`
- Evidence: README.md (new section): "`renderSpec`（`svg-diagram/render`・`svg-diagram/spec/selective`）… が同じ 2 つのオプションを取る". But `./spec/selective` maps to lib/spec-selective.ts, the browser `renderSpec(spec, {parts, measure})`, which this PR does not change. The option is wired into `./spec/selective/node` (lib/spec-selective-node.ts). A JS caller of `spec/selective` gets no error and no prefix.
- Fix: say `svg-diagram/spec/selective/node`, or add the option to the browser selective `renderSpec` as well, since it is pure.

### m2 (Minor): `check --drift --rebuild` describes a `build --inline` SVG as a visual change
- Evidence: `build examples/bars-bare.ts --inline`, then `check --drift --rebuild` on it reports "キャンバスの大きさ:  → 940x361 / 見た目が変わる。再生成して、目で確かめる" and exits 1. The same check on an `--id-prefix` output says "見た目は変わらない". `check --drift` without `--rebuild` passes. This is the PR's own open question.
- Fix: make the drift explainer treat a root without width and height but with an equal viewBox as "見た目は変わらない", or document that inline output is not a drift target.

### m3 (Minor): `idPrefix: 'auto'` in the API is the literal prefix `auto`, unlike the CLI's `--id-prefix auto`
- Evidence: `normalizeIdPrefix('auto')` returns `auto`. So two figures rendered with `{idPrefix: 'auto'}` share every id, while the CLI hashes the content (`sd<8 hex>`). The README section for the CLI documents `<p|auto>` right next to the API.
- Fix: either implement `'auto'` the same way (a hash of the SVG text), or reject or document it in `EmbedOptions.idPrefix`.

### m4 (Minor): label text that contains `url(#<id>)` is rewritten
- Evidence: a `renderSpec` call with `title: 'see url(#svg-title) here'` and `idPrefix: 'f1'` draws "see url(#f1-svg-title) here". The `url(#…)` replacement in `prefixSvgIds` runs over the whole markup, including text nodes. This is pre-existing for the CLI and is now reachable from the API.
- Fix: only rewrite `url(#…)` inside attribute values and `<style>`.

### m5 (Minor): an invalid `idPrefix` is reported only after the whole layout and render, as a throw
- Evidence: `renderSpec(spec, {idPrefix: '-'})` lays out, verifies and lints, then throws from `finishNodeSpec`. Elsewhere `renderSpec` reports spec problems as `{ok: false, issues}`.
- Fix: validate the option at entry (before layout). Optionally, return it as an issue rather than throwing.

### m6 (Minor): `appearance: 'auto'` dark rules are global to the page and are not scoped by the prefix
- Evidence: lib/appearance-auto.ts emits `svg[data-appearance="auto"] [fill="#hex" i] { … }`, which matches every auto figure on the page. Built-in tokens map the same hex to the same dark colour, so this is harmless there. But two auto figures that use one light hex with different tone overrides recolour each other. The README says the prefix makes each figure "閉じる".
- Fix: when `idPrefix` is given, put the id on the root `<svg>` and scope the block to `#<prefix> …`, or note the limit in the README.

### n1 (nit): the README CLI line repeats "--stale とは併用しても毎回作り直す"
- Evidence: README.md line 264 states it inside the new `--inline` parenthesis and again right after.
- Fix: drop the copy inside the parenthesis.

## Other checks (no finding)
- Sweep, all 203 examples × {SVG, HTML}, prefixes p1 and p2:
  - No reference in the prefixed output still names an unprefixed id. I checked any attribute, `#id` and whitespace tokens, `<style>`, and text.
  - No shared ids, and every id carries the prefix.
  - No dangling `url(#)` or `href="#"`, and text is unchanged.
  - Reference kinds present: `aria-labelledby` (multiple), `marker-end`, `clip-path` (including comic and chat), gradient `fill`, and HTML `<style>` `#id`. `<use href>` and `xlink:href` are covered by the unit test and by `svg-outline` glyph `<use href="#…">`, which the `href` rule handles.
- Chromium, 5 example pairs (themes blue, amber and teal, comic, chat), both forms:
  - With p1 and p2 on one page: 0 duplicate ids and 0 references that resolve outside their own figure. The computed styles of figure 2 are identical alone and next to figure 1.
  - Negative control (both p1): duplicates detected.
  - Inline SVG scales to the container (600px wide, aspect kept).
- `build --inline --png`: PNG size identical (1880×722). `check --drift` (no rebuild) still reads the metadata.
- CI: test 1/3, 2/3 and 3/3 and golden pass on 1efa613. No other open PR touches these files.

## Recommendations
- Open question (Workers/edge): add `idPrefix` / `inline` to `renderSpecEdge` (`spec/edge`, `spec/selective/edge`) in this PR. The README's motivating case, a figure pasted into an Artifact or page, mostly goes through the MCP/Workers path, and `prepareForEmbedding` is pure. It also makes the outlined glyph defs (`<use href="#…">`) unique per figure.
- `renderSource` (the other function of `svg-diagram/render`) takes `html` but not `idPrefix` / `inline`. Thread the options through for parity.

## Verdict
converged: no (Blocker 0 / Major 2 / Minor 6 / nit 1)
