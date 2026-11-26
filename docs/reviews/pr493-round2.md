# PR #493 review (Opus, round 2)

Target: feat/embed-id-prefix-inline @ 7a7177f436fcf91de4ee2a7eae965d98f2b83d96

## Conclusion
The fixes work. M1 and M2 and m1–m5 are resolved, and all nine mutations I applied are caught by the tests. The prefixing holds on every path I swept, including the `spec/edge` path that the MCP plugin uses: 203 examples through `renderSource`, and 66 parts × 3 variants through `renderSpecEdge`, `renderSpec` and the selective Node `renderSpec`. The pptx and present output is byte-identical after the switch to `prefixTagIds`.
converged: no. CI is red: test (1/3) fails the bundle budget of the selective Node spec by 16 bytes, which comes from this round's change (M1). One Minor remains: on the edge path the m4 fix does not hold, because outlined text becomes an `aria-label` attribute.

## Previous round
- M1 resolved. `build --id-prefix a.b` exits 2. `renderSpecEdge(…, {idPrefix: 'a.b'})` returns `ok: false` with an issue. The mutation that puts `.` back in `PREFIX_NAME` is caught (4 tests fail).
- M2 resolved. Mutations (a) `renderDiagram` HTML not prefixed and (b) the selective Node `renderSpec` dropping the options each fail a test. So do the new paths: `renderSource` options dropped, `spec/edge` without `prepareForEmbedding`, `spec/edge` without the bad-prefix check, `<style>` rewrite removed, `url()` rewrite in attributes removed, and `'auto'` treated as literal. Baseline: 22 pass, 0 fail.
- m1 resolved. The README now names `spec/selective/node`, and says that the browser `spec/selective` does not take the options.
- m2 resolved. `build --inline`, then `check --drift --rebuild`, now says "見た目は変わらない". It still exits 1, the same as an `--id-prefix` output.
- m3 resolved. `idPrefix: 'auto'` gives `autoIdPrefix(svg)` on all 203 examples and all 198 edge renders.
- m4 partly resolved. On the Node paths, label text stays as written. On the edge path it is still rewritten (m1 below).
- m5 resolved. `renderSpec`, the selective `renderSpec` and `renderSpecEdge` return an issue before the layout, and `renderDiagram` / `renderInBrowser` throw before it.
- m6: the limit is documented in the README, which is accepted as the fix.
- n1 resolved.

## Findings

### M1 (Major): CI test (1/3) fails, because the selective Node spec bundle is 16 bytes over its budget
- Evidence: run 45813303651 has test (1/3) failing with `esbuild (Node): Selected table spec: 119516 bytes exceeds 119500` (scripts/check-package-bundles.ts:1525). This round added an `idPrefixProblem` import to lib/spec-selective-node.ts, and that pulled the bundle over the budget. On the round-1 head 1efa613 the same job was green. Golden, test (2/3) and test (3/3) pass.
- Fix: raise that budget a little and give the reason in the commit, or keep the check out of that entry (for example, let `finishNodeSpec` validate the prefix before it emits). Then get CI green.

### m1 (Minor): on `spec/edge`, label text that reads `url(#<id>)` is still rewritten (the m4 fix does not reach the outlined form)
- Evidence: I ran `renderSpecEdge({…table example, title: 'see url(#svg-title) here', showTitle: true}, realEngine(), {idPrefix: 'f1'})`. The outlined title's accessible name comes out as `aria-label="see url(#f1-svg-title) here"`. `renderSpec` (Node) keeps both copies as written. The cause is that lib/spec-edge.ts:32 prefixes after `outlineText`, which has already moved the text into an attribute, and `prefixTagIds` runs `urls()` over every attribute.
- Fix: restrict the `url(#…)` rewrite to the attributes that take a reference (`fill`, `stroke`, `clip-path`, `mask`, `filter`, `marker-*`, `style`), or skip `aria-label`. Add the edge case to the m4 test.

### n1 (nit): a non-string `idPrefix` throws a raw `TypeError` from the edge entry
- Evidence: `idPrefixProblem` calls `prefix.replace`. So `renderSpecEdge(spec, engine, {idPrefix: 5})` from JS throws `prefix.replace is not a function`, although the entry says that only engine failures throw.
- Fix: `typeof prefix !== 'string'` → the same issue.

### n2 (nit): the CLI keeps a trailing `-` of the prefix, and the API drops it (pre-existing)
- Evidence: `build --id-prefix fig1-` writes `id="fig1--svg-title"`, while `renderSpec(…, {idPrefix: 'fig1-'})` writes `fig1-svg-title`. The README says that `fig1` and `fig1-` are the same.
- Fix: strip trailing `-` in `idPrefixFor` as well, or say that this applies to the API only.

## Other checks (no finding)
- Sweep, all 203 examples through `renderSource`, with `{html: true}`, `{html: true, idPrefix: 'qZ1'}`, `{idPrefix: 'qZ2-', inline: true}` and `{html: true, idPrefix: 'auto'}`:
  - 0 bad. There are no duplicate or unprefixed ids, no dangling `url(#)` / `href` / `aria-*` reference, and no `<style>` `#id` selector without its target.
  - Removing the prefix gives back the unprefixed output byte for byte, in both the SVG and the HTML form (the HTML root is mapped back to `sd-<hash>`).
  - Reference kinds present: `aria-labelledby`, `url(#)` (187 SVG, 76 HTML) and `<style>` (all).
- Sweep, 66 spec parts × {default, legend/caption/showTitle, en+dark} through `renderSpecEdge`, with `{idPrefix}`, `{idPrefix, inline}` and `'auto'`: 198 renders, 0 bad, with 11,066 glyph `<use href="#…">` checked. The result fields other than `svg` are unchanged. The Node `renderSpec` and the selective Node `renderSpec` (`{parts, idPrefix, inline}`) also have 0 bad for every part.
- Split of `prefixSvgIds`: for all 203 SVGs, the round-1 `prefixSvgIds(svg, 'c1')` and the new `prefixTagIds(svg, 'c1')` give identical bytes, so the output of `pptx/image-band-core` and `present/slide-svg` is unchanged. The column figures of `slideSvg` are always drawn by the library, never user SVG. On HTML, the old and new `prefixSvgIds` give identical bytes too.
- Chromium:
  - `spec/edge` pairs (table+flowchart, bars+bars, gantt+sankey with theme amber, mindmap+radar), both `inline`, `p1`/`p2` on one page: 0 duplicate ids and 0 references that resolve outside their own figure. Figure 2 is pixel-identical alone and next to figure 1, and it scales to 600px.
  - Negative control, same pairs without a prefix: 2–18 duplicates, and 2–40 references that resolve into the other figure.
  - `renderSource` SVG and HTML pairs (bars+comic, chat+bars-range): 0 / 0.
- `idPrefix: 'auto'` hash change (SHA-256 → FNV-1a): not a compatibility problem.
  - An SVG built by the round-1 code with `--id-prefix auto` (`sd83015c5f-…`) passes `check --drift` with the new code.
  - `check --drift --rebuild` already reported any prefixed output as a mismatch ("見た目は変わらない") with the old code, so the result is the same.
  - `build --stale` with `--id-prefix` always rebuilds (documented).
  - The ids of an auto prefix were never stable across a content change, so nothing could rely on them.
- `spec/selective/edge` without the options: the judgement is sound. The plugin imports `renderSpecEdge` from `svg-diagram/spec/edge` (src/tools.ts, src/deck.ts), which has the options. The "Selected table spec on Edge" bundle is 121,955 of 122,000 bytes, and svg-ids.ts adds about 2 KB minified, so including it would break that budget. The limit is in the README. `prepareForEmbedding` is not exported from any entry, so a `spec/selective/edge` caller has no way to prefix. If that is needed later, a tiny pure export would do it.
- Interference: open #497 edits another budget line of scripts/check-package-bundles.ts (timeline). There is no textual overlap.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 1 / nit 2)
