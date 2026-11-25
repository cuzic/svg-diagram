# PR #465 review (Opus, round 1)

Target: feat/tree-tags @ 80caf784de22237058056568e31012e13fd91af7

## Conclusion
The tag layout, colour table, draw order, PPTX shape and D8 byte-identity all behave as ADR 0081 D4–D6/D8 describe. I could not
break them with fit retries, `dir: 'auto'`, keepWords/bunsetsu, `canvas: 'slide'`, emoji, focus, tones overrides, band nodes, dark
appearance or any of the 10 layouts. But CI is red because of this PR: the `mindmap` spec-catalog bundle goes over its Vite budget,
and shard 1 never ran its tests. converged: no (1 Major).

## Previous round
n/a (round 1)

## Findings
### M1 (Major): CI `test (1/3)` fails on the bundle budget the PR breaks; shard 1's tests never ran
- Evidence: `gh pr checks 465`: `test (1/3)` fails at step `pnpm build && node scripts/check-package-bundles.ts`, so
  `node --test --test-shard=1/3` and "examples pass the rule check" are skipped. Locally on this head:
  `AssertionError: Vite: Spec catalog: mindmap が 122000 バイトを超えています (122009)` (budget at
  `scripts/check-package-bundles.ts:161`). The base a5557971 (main, CI green) measures `Vite: Spec catalog: mindmap: 118571`, so
  the PR adds about 3.4 KB to that entry (`emit-tree.ts` now pulls `pillSvg`/`badge.ts` and `resolveBoxStyle`; `tree.ts` adds tag
  metrics). The PR body's claim that the only failures match main does not hold for CI. These are not the missing `jsqr`/`ajv` or font
  failures, which shards 2/3 and 3/3 pass in CI.
- Fix: keep the entry under budget (for example, take the colour/pill code off the catalog's path) or raise the `mindmap` budget (and
  check `tree`) in the same PR with the measured delta stated, per ADR 0080. Then make sure shard 1's tests and the example rule check
  run green. PR #464 also grows this entry, so leave headroom for both.

### m1 (Minor): The SVG pill geometry is quantised to 4 px, so gaps are uneven and the text is off-centre by up to 2 px
- Evidence: `lib/emit-tree.ts:38-40` snaps `x` and `w` separately with `snap4` but centres the text on the unsnapped `t.x + t.w / 2`.
  Ran `mindmap({... tags: ['<a&b>"', 'WWWWWWWW', '👍🇯🇵']})`: rects at 416+68, 488+120, 616+44, so the gaps are 4 and 8 instead of
  `round(6s)` = 6. Text x is 449/549/636 against rect centres 450/548/638. The worst case lets two pills touch (gap 0). The tests
  check only the laid-out values, not the SVG.
- Fix: snap the ends (`snap4(x + w) - snap4(x)`, as `emit-fta.ts:26` does) and centre the text on the snapped rect, or don't snap tag
  pills; add an SVG-level assertion for the gap and centring.

### m2 (Minor): A figure that fails only because of a wide tag row gets a fix hint that never mentions tags
- Evidence: 8 children each with 3 eight-character tags, `tree(..., {dir: 'down'})` → "does not fit 900px … fix: dir: 'auto', or widen
  the figure (diagram({width: 3600}))". A radial mindmap with 12 such nodes → "write fewer branches". In the "tried" list, narrower
  `maxNodeW` gives the same width, because tags only widen. D4 accepts the existing error path, so this is not a violation, but the
  message doesn't tell the user what to change (shorter or fewer tags).
- Fix: when a node's tag row sets its width above `maxW`, add "or shorten / drop the tags of "<label>"" to the fix line.

### m3 (Minor): The PPTX golden manifest lacks `mindmap-tags`, so `pptx-golden.yml -f update=false` will report it as new
- Evidence: `node test/helpers/pptx/golden.ts --update examples/*.ts` on base and head: every existing hash is identical (D8 PPTX holds).
  The only difference is the added `mindmap-tags` entry. `examples/out/pptx-golden.json` is not in the diff, and the compare mode exits
  1 on a new key (`golden.ts:46-49`). The PR body acknowledges this.
- Fix: run `pptx-golden.yml` with update=true and commit the manifest before merging.

### m4 (Minor): This PR will conflict with PR #464 (U1)
- Evidence: a trial merge of `origin/feat/tree-edge-style` into this head gives conflicts in `lib/emit-tree.ts` and
  `lib/types/diagrams.ts`. `lib/dsl/tree.ts`, `lib/tree.ts` and `lib/pptx/tree.ts` auto-merge. Both PRs also grow the same bundle
  entry (M1).
- Fix: merge one, then merge origin/main into the other (no rebase/force) and re-run bundles, golden and pptx-golden.

### n1 (nit): Answers to the Open questions
- Rejecting a whitespace-only tag is fine: it is the safe-side reading, and it matches the label check (`!n.label.trim()`). U3's
  `check()` must use the same rule, or a spec could pass that the DSL rejects (D7 says "spec を通ったのに描くと失敗する入力を作らない").
- Width `ceil(text) + 2·padX`: fine in layout. The visible rounding problem is the SVG snapping (m1), not the ceil.
- Extra `size` / `baseline` on `LaidOutTreeTag`: fine and needed because emit has no `roles`. Update D4's
  `{text, tone, x, y, w, h}` in the ADR so the public type and the decision agree.
- Plain box never inverts: correct per the table. One edge case: `tones: {accent: {ink: '#ffffff'}}` makes the tag white on white
  in both rows, but that is a user-chosen invisible colour, not this PR's bug.

### Checked and fine (no finding)
- D3/D4 validation in the DSL only: errors for empty, 9 code points (emoji counted by code point), 4 tags, bad tone, band node, and
  for non-array `tags`. Fit retries never throw on tags.
- Size scaling on `canvas: 'slide'`. The box only widens (`maxNodeW: 120` gives a wider box, no error). keepWords and `wrap:
  'bunsetsu'` widen independently of the tag row, and no label overlaps the row in any probe.
- All 10 layouts, including brace/fishbone/timeline (a box is drawn under each tag there). The root and `focus` keep tags (`focusTree`
  copies `rest`). The colour precedence dim → muted node → resolved-colour inversion → normal holds, including tones overrides. In
  dark appearance the colours are recoloured consistently.
- Draw order box → tag → label. No `data-node` and no `stroke` on the tag rect. Tags are not in `texts`, so `ink()`, `nodeRunsOf` and
  `treeRects` are unchanged. `nodeRuns` without `tagRowH` is unchanged. `measureNode` callers outside the tree pass no `tags`.
- PPTX: the tag is a `roundRect` with adj 50000, `anchor="ctr"`, 14 px → `sz="1050"`, placed after the box in the same branch group.
  The node's own paragraph starts below the row (`topInset` comes from the first `lineY`). Glue and connector hit-tests use the box
  rect only. XML-special characters are escaped in the SVG text and the PPTX name.
- D5: no change to `<desc>` or the legend. D6: only the listed `rect`/`text` attributes appear.
- D8: SVG golden is green in CI. The PPTX slide XML of all 13 tree/mindmap examples is identical to the base, and so are all manifest
  hashes.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 4 / nit 1)
