# PR #493 review (Opus, round 3)

Target: feat/embed-id-prefix-inline @ eb9a2de9d0e89908c1804cf2c3d3180ca86b4737 (scope: commits after 6e747694)

## Conclusion
All four round-2 findings are fixed, and I checked each one by running it. CI is green on all 4 jobs. The selective Node bundle is 119,604 bytes, under the new budget of 119,700. When `url(#…)` is rewritten only in reference attributes, nothing regresses. The 203-example sweep, the spec/edge sweep and the two-figure check in Chromium are all clean, and `marker-end`, `clip-path`, `fill` and glyph `href` are still prefixed.
converged: yes. One Minor test gap and one nit remain.

## Previous round
- M1 resolved. The prefix check moved to `finishNodeSpec`, and the budget went from 119500 to 119700, with the reason given in a comment.
  - In CI, test (1/3) passes with `esbuild (Node): Selected table spec: 119604 bytes`.
  - `renderSpec` from `spec-selective-node` with `idPrefix` `'a.b'`, `5`, `'9z'` or `null` returns `{ok:false, svg:null}` with the idPrefix issue. `'fig1-'` gives `id="fig1-svg-title"`.
  - Because the check now runs after the layout, a spec that is invalid and also has a bad prefix reports only the spec issues. That is acceptable.
- m1 resolved.
  - `renderSpecEdge` with the title `see url(#svg-title) here` and `{idPrefix:'f1'}` now gives `aria-label="see url(#svg-title) here"`, untouched. The Node `renderSpec` keeps the title as written.
  - A synthetic SVG still gets `marker-start/mid/end`, `clip-path`, `fill`, `stroke`, `mask`, `filter`, `style`, `href` and `xlink:href` prefixed. `aria-label`, `data-*` and text are left alone.
- n1 resolved. On the edge entry, `idPrefix` values of `5`, `null`, `{}`, `''`, `'-'`, `'1x'` and `'a.b'` each return `ok:false` with an issue, and none throws. The full Node `renderSpec` with `5` returns an issue too.
- n2 resolved. `idPrefixFor('fig1-', null)` is `fig1`, and `('fig1--','a')` is `fig1-a`. The new CLI test shows that `fig1-` and `fig1` give byte-identical output.

## Findings

### m1 (Minor): no test fails when an entry of the reference-attribute list is dropped
- Evidence: I removed `clip-path` from the list in lib/svg-ids.ts:41. All of these still pass: test/embed-svg, spec-edge, svg-ids, the `id-prefix|inline` tests in cli, band-type-literals, deck-cover, pptx-groups, pptx and present-slide (52 + 4 + 62 tests). Yet `clip-path="url(#…)"` occurs in 143 of the swept SVG/HTML outputs, so this mutation would leave dangling clip references. Removing `marker-\w+` is caught (2 failures), and so is widening the list to every attribute (1 failure).
- Fix: add one assertion to the m4/m1 test (or to svg-ids.test.ts) that a figure with a clip path, for example a table or a bars part, keeps no unprefixed `url(#…)` after prefixing. Better, check every entry of the list against a synthetic SVG.

### n1 (nit): `url(#…)` in single-quoted attribute values is no longer rewritten
- Evidence: `prefixTagIds("<svg><clipPath id=\"c\"/><g clip-path='url(#c)'/></svg>", 'p')` renames the id to `p-c`, but `clip-path='url(#c)'` stays as written, so the reference dangles. Before this round, the rewrite ran over all of `attrs`, quote style included. No library output uses single quotes: there are 0 in the 203 + 198 swept renders. `href` was already limited to `"` before this PR.
- Fix: none needed. If you want it, accept `'` in the attribute regex as well.

## Other checks (no finding)
- 203-example sweep through `renderSource`: 0 bad. 200 examples ran from scratch, plus the 3 icon examples run from the repo cwd. Options were `{html}`, `{html, idPrefix}`, `{idPrefix, inline}` and `'auto'`. The checks were no duplicate or unprefixed ids, no dangling `url(#)`, `href` or `aria-*` reference, no `<style>` `#id` without its target, and exact equivalence once the prefix is removed. `prefixTagIds` still gives the same bytes as the round-1 `prefixSvgIds` on all SVGs, so pptx and present are unchanged.
- spec/edge sweep: 66 parts × 3 variants, 198 renders, 0 bad. The renders have 11,066 glyph `<use href="#…">` and 41 `url(#`. The Node `renderSpec` and the selective Node `renderSpec` also gave 0 bad. The attributes that carry `url(#)` in the swept outputs are `clip-path` (143), `marker-end` (135) and `fill` (7), and all are in the list.
- Chromium, two figures on one page: 4 spec/edge pairs and 2 `renderSource` SVG/HTML pairs. Each has 0 duplicate ids, 0 references that resolve outside their own figure and 0 dangling references. Figure 2 is pixel-identical alone and next to figure 1. The negative control without a prefix still collides: 2–18 duplicates.
- CI run 45816815090: golden, test (1/3), test (2/3) and test (3/3) all pass.
- Interference: open #497 edits only another budget line of scripts/check-package-bundles.ts, so there is no textual overlap. The selective Node entry now has 96 bytes of headroom, so whichever of the two PRs merges second may need to rebalance.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 1 / nit 1)
