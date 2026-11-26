# PR #470 review (Opus, round 2)

Target: fix/wordart-slide-outline @ a26850d475bf9ab4107cbe8a69aab979a216a590

## Conclusion
All four round-1 findings are fixed in behaviour: a gradient WordArt now fades blue to dark across the letters on a slide, a stroke
drawn first is a separate pass under every fill, a dashed text stroke is a slide error again, and the `arc` hint is tested. What is
left is small: a stroke inherited from an ancestor `<g>` still reaches the fill pass as a hairline in font units, and the stroke width
of gradient (path-drawn) glyphs has no test. No Blocker or Major. converged: yes.

## Previous round
- M1 resolved: rasterised `wordart('GRADIENT TEXT', {style: 'gradient', size: 64})` on a slide with resvg; the ink goes row by row
  from `#1e5086` at the cap height to `#212d39` at the baseline (round 1: dark everywhere but the last row). The glyphs are `<path>`s in
  figure px (`placedPath`), no `<use>`. Test checks geometry, not colour, but the geometry is what decides the colour here.
- m1 resolved: `paint-order="stroke"` now emits `<g stroke… fill="none">` with every glyph of every run first, then the fills
  (lib/svg-outline.ts:146-150); probed with a two-run text (`A<tspan fill="red">B</tspan>`): both strokes precede both fills. No
  `paint-order` attribute is left in the slide.
- m2 resolved: `stroke-dasharray` on the text, or inherited from a stroked `<g>`, is in `unsupported`; a dash with no stroke is not
  (test/spec-edge.test.ts).
- n1 resolved: `arc: 60` test added and passes.

## Findings
### m1 (Minor): in the two-pass case the fill pass inherits a stroke set on an ancestor `<g>`, drawn in font units
- Evidence: `outlineText` on `<g stroke="#fff" stroke-width="8" paint-order="stroke"><text font-size="20">AB</text></g>` (fake font):
  the stroke pass sets its own width (400 font units, correct), but the fill-pass `<use>`s carry no `stroke`, so they inherit the
  ancestor's `stroke="#fff" stroke-width="8"` read in font units (0.16 px) and draw a white hairline over every fill. Same for a
  `<tspan stroke="none">` under a stroked ancestor (`B` gets the inherited hairline, where before this PR any computed stroke was a
  slide error). No emitter in lib/ puts a stroke on a `<g>` round text (emit-wordart.ts:22 puts it on the `<text>`), so only raw SVG
  reaches it.
- Fix: write `stroke="none"` on the fill pass (and on runs whose own stroke is `none`) whenever the text's computed stroke came from
  outside the `<text>`.

### m2 (Minor): the stroke width of path-drawn (gradient) glyphs is untested
- Evidence: mutated `strokeAttrs(run.style, baked ? 1 : k, twoPass)` to `strokeAttrs(run.style, k, twoPass)`;
  `node --test test/wordart-slide.test.ts test/spec-edge.test.ts` still 47/47. The behaviour is right today (ran `sticker` with
  `gradient: {from: 'accent', to: 'text'}` on a slide: the white rim is `stroke-width="8"` on the `<path>`s, no errors).
- Fix: add that case to `test/wordart-slide.test.ts` and assert the rim's stroke-width is in figure px (< 20).

### n1 (nit): ADR 0056 D2 says the stroke width is divided by the glyph scale; for gradient glyphs it is not, and the two-pass and dash rules are not written there
- Evidence: docs/adr/0056-deck-serve.md D2 diff; README mentions the gradient re-placement but not the dash error.
- Fix: one clause each in D2.

## Checked and fine
- `node --test test/wordart-slide.test.ts test/spec-edge.test.ts`: 47/47 pass. CI at review time: golden pass, test 1/3–3/3 pending.
- `placedPath` only handles absolute M/L/Q/C/Z; harfbuzz `glyphToPath` (lib/font-metrics.ts:230) only emits those, and the
  fallback-font rescale keeps them, so the `throw` is unreachable from real fonts.
- A gradient text with a solid-colour tspan draws the tspan with `<use>` and the rest as paths; the reverse also bakes the gradient run.
- An `objectBoundingBox` gradient is per glyph both before and after this PR (each `<use>` / `<path>` is its own box): not a regression.
- Open PRs: no other open PR touches lib/svg-outline.ts, lib/svg-dom.ts, the two tests, ADR 0056 or quadrant.md.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 2 / nit 1)
