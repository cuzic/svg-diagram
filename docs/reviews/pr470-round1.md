# PR #470 review (Opus, round 1)

Target: fix/wordart-slide-outline @ afab5bd3f4134f0c71dd162c871d41c830874a59

## Conclusion
The stroke / paint-order / clip-path carry-over in `outlineText` is correct for the cases it targets: outline, sticker, glow, emboss and
reflect now pass on slides, `stroke-width` is scaled into glyph units, the reflection's clip-path lands in the same user space, and
`spacing` / `arc` still fail with the new hint. But the PR now documents (README, quadrant.md, ADR 0056 D2) and tests that **all 10
presets** work on slides, and the `gradient` preset still draws a different figure on a slide without any error. converged: no.

## Previous round
n/a (round 1)

## Findings
### M1 (Major): the `gradient` preset (and any `gradient:` WordArt) is drawn almost solid dark on a slide, and the PR now says it works
- Evidence: ran `renderDeck` on `wordart('GRADIENT TEXT', {style: 'gradient', size: 64})` and rasterised the slide SVG with resvg.
  The fill is `url(#…-g…)`, a `gradientUnits="userSpaceOnUse"` gradient with `y1="20" y2="100"` in figure px, but it is now referenced
  from glyph paths inside `<use transform="… scale(0.064 -0.064)">`, so the coordinates are read in flipped font units. Sampled rows of
  the ink: every row from the cap height down to just above the baseline is `#22201b` (the `to` colour); only the bottom row is blue
  (`#1e4e82`). The intended look is blue at the top fading to dark at the bottom. `renderDeck` returns no error, and
  `test/wordart-slide.test.ts` ("wordart 'gradient' can be a slide's figure") asserts this as passing. main produces the same glyph
  markup (checked), so the drawing bug is older, but this PR adds the claim "10 種の `style` はどれも使える" to README.md:691,
  skills/svg-diagram/references/quadrant.md:9 and ADR 0056 D2, and locks it in with a test that only checks `errors`. A stroke given as a
  `url(#…)` paint now goes the same way through `strokeAttrs`.
- Fix: in `outlineText`, a run whose fill or stroke is a `url(#…)` paint server should draw its glyphs in the text's user space (path
  data scaled and translated into place, or a per-run copy of the gradient with a compensating `gradientTransform`). Failing that, report
  it as `unsupported` and drop `gradient` from the "all 10" wording. Either way, add a test that checks the colour at the top and bottom
  of the outlined letters, not only `errors`.

### m1 (Minor): paint-order is applied per glyph, so a glyph's rim overlaps the fill of the glyph before it
- Evidence: `strokeAttrs` puts `paint-order="stroke"` on a `<g>` of separate `<use>` glyphs (lib/svg-outline.ts:101-109). Each `<use>`
  paints its own stroke and then its fill, so glyph n+1's rim (half of `2 × inner.width`, about 3.8 px for a 64 px sticker) is painted
  over glyph n's fill where they come that close. On a `<text>` with no per-glyph positions, one text chunk paints all of its strokes
  before any fill. I rasterised the slide (resvg, 1600 px wide) against a variant that draws the run's strokes first (`fill="none"`)
  and its fills after: 'AVATAR WAVY' sticker 51 px differ, outline 53, glow 32, emboss 19, 'Typography' sticker 11, a Japanese kana
  line 0. Small, but a silent visual difference on tight Latin pairs.
- Fix: for a run with `paint-order` that puts stroke first, write the run twice: the uses with `fill="none"` and the stroke, then the
  uses with the fill and no stroke (or paint-order normal), instead of `paint-order` on the group.

### m2 (Minor): a dashed text stroke is now drawn solid (or with dashes in font units) where it used to be a slide error
- Evidence: before this PR any computed stroke on text added `stroke` to `unsupported`. Now `stroke-dasharray` / `stroke-dashoffset`
  are neither carried over nor in `NOT_REPRODUCED`. An own dash is dropped (solid rim). A dash inherited from an ancestor `<g>` stays
  inherited by the glyph paths and is read in font units (a `6,4` dash becomes about 0.4 px). No current emitter puts a dash on text
  (grepped lib/), so nothing reaches it today. The PR's open question names it but leaves it silent rather than an error.
- Fix: when the run's stroke is not `none`, report `stroke-dasharray` / `stroke-dashoffset` (own or computed) as unsupported, or carry
  them over divided by `k` like the width.

### n1 (nit): the `arc` hint is not tested
- Evidence: only `spacing` is checked in `test/wordart-slide.test.ts`. I ran `arc: 60` by hand: the error carries the `arc` hint correctly.
- Fix: add the `arc` case to the same test.

## Checked and fine
- Ran `node --test test/wordart-slide.test.ts test/spec-edge.test.ts`: 44/44 pass. CI: golden, test 2/3 and 3/3 pass (1/3 still running
  when this was written).
- Mutation: removed the `OWN_ON_TEXT` move from `groupOpen`. The reflect test fails, so the clip-path move is covered. The `/ k` mutation
  is in the PR body.
- clip-path / mask / filter only skip `unsupported` when they are on the `<text>` itself. On a `<tspan>` or in CSS they are still reported.
- The `Style` additions are optional fields. The other `computeStyles` users (lint, pptx shapes, raster, covers) only read the old fields.
- Open PRs: only #374 touches README.md, in the gantt section, so no overlap.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 2 / nit 1)
