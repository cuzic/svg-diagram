# svg-diagram PR #442 (ADR 0074 U2, faces and artist assets) — round 1 review

Head 3af0b91e. CI at review time: golden pass, test 3/3 pass, test 1/3 and 2/3 still running (check that they finish green before merging).
Local `pnpm test`: 3342 tests, 8 fail, the same 8 font failures as on main. The 5 comic test files: 82 pass.
`check --strict` is clean on `comic-faces` and `comic-column`. `golden:pptx` for the three comic examples: "3 slides match the manifest".
Goldens: only comic files change (`comic-column.svg`, `comic-grid.svg`, new `comic-faces.svg`, and the pptx-golden comic rows, with the usual trailing-comma line). The `toc-*` rows are untouched.
Leak grep over the diff: nothing. The only URLs are `example.com` in the example and tests, and the artist name is "An Example Artist" / "この例のための作り話".

Verdict: **not converged. 1 Major (the angry / worry / sad brows are inverted), a few Minor.** The asset loader, id prefixing, dark theme and purity are sound.

## Major

### M1. The brows of `angry`, `worry` and `sad` are inverted: "angry" reads as sad, "sad" and "worry" read as angry
- `lib/comic/face.ts:115`: `const tilt = kind === 'angry' ? s * 5 : kind === 'worry' || kind === 'sad' ? -s * 5 : ...`, with the line `M(x-6) (y - tilt/2) L(x+6) (y + tilt/2)`.
- For the left eye (s = -1) the inner end is the right end. `angry` gives tilt -5, so the inner end is higher: `/ \`, the shape of a worried or sad brow. `worry` and `sad` give tilt +5, so the inner end is lower: `\ /`, the shape of an angry brow.
- I rendered all 8 expressions in isolation (`r442/faces8.png`): the face labelled `angry` has worried brows and a frown, `sad` has an angry V with a frown, `worry` has an angry V with a wavy mouth. The same shows in `examples/out/comic-faces.svg` panels 3 and 4, and in the `comic-column` panel-3 face (`worry` looks irritated).
- The tests do not catch it: "8 expressions are drawn, each different" passes when two are swapped, and the golden test pins the wrong strings. (When I fix the sign, exactly one test fails: that pinned golden. So the golden just needs regenerating.)
- Fix: swap the signs (`angry`: `-s * 5`, `worry` / `sad`: `s * 5`). Regenerate the pinned strings in `test/comic-face.test.ts`, `examples/out/comic-faces.svg`, `comic-column.svg`, `comic-grid.svg` (docker golden) and the pptx-golden comic rows. Add a semantic test so a swap fails: for `angry` the inner brow end is lower than the outer end; for `worry` / `sad` it is higher.

## Minor

### m1. The licence is only checked for presence, not for shape
- `lib/comic/character.ts:25`: `text(lic.url)` accepts `javascript:alert(1)` and `x` (verified). The field is not drawn today, but ADR 0074 makes the licence the reason a character may travel with a comic, and a later credit line or `<a href>` would inherit it.
- Fix: require `spdx` to be a non-empty single-line string and `url` to match `^https?://`. Say in the ADR whether the licence is meant to be carried into the output (CC-BY needs credit): a `data-license` / `<metadata>` entry would be the natural place. Not required for U2.

### m2. Asset geometry above the stage head is not part of any check
- `lib/comic/layout.ts` places bubbles against the stage head circle (r 36); `comic-bubble-covers-face` reads only that circle. The box is scaled so that `anchors.head` matches it, but an artist's hair, hat or antenna that rises above the head circle (the 200x240 example has 90 units above the head centre, which is 58px at the default scale, 22px above the head top) can run into the bubble band (the bubbles keep 4px from the circle). I did not build such a figure, so this is by reading, not by render.
- Fix: either document that `anchors.head` must be the circle that covers everything above the face, or let a manifest give a `top` anchor and widen `HEAD_KEEP` by it. Fine as a note for U4 (where `bubbleSides` is used).

### m3. The new golden does not show what the ADR's U2 wants shown
- `examples/comic-faces.ts` has no dialogue at all, so the tails of the bubbles to an asset's mouth are not in a golden (the layout test covers it: the heads, bubbles and stacking are the same with an asset as with the built-in face, and my own check with five assets, including a low, a far-off and a negative-origin mouth, gave tail angles of 0.002 to 0.09 rad, all under the 0.17 limit). The `think` expression is not in the picture either (7 of 8 shown), and the robot has only 2 expressions.
- Fix: add one bubble to the asset's panel and one `think` face; regenerate.

### m4. `currentColor` is accepted in an asset fragment and then follows whatever colour the document inherits
- `sanitizeBody` allows `fill="currentColor"`; `characterSvg` only rewrites 6-digit hex. A character drawn with it takes the colour of the surrounding SVG (not the paper / ink of the comic), so it is not "kept whatever the appearance". Fixed paint was the stated intent.
- Fix: reject `currentColor` for characters (it is an icon notion), or rewrite it to the ink `rgb()`. Add it to the sanitising test.

### m5. `loadCharacter` accepts any positive `head.r` and any box size
- `character.ts:29,32`: `r = 0.001` gives a scale of 36000 (a nested `<svg>` of that size); a box of 1e9 is accepted. Not a security problem (the output is only large), but a broken manifest then produces a huge SVG instead of an error.
- Fix: require the head circle to lie inside the box, and bound `r` relative to the box (for example `r >= box width / 50`).

## Nits
- `lib/comic/layout.ts` `defaultHue`: `(210 + 70 * i) mod 360` gives 200 for the sixth person, 10 degrees from the first. The ADR note says "the first five differ", which is true; golden-angle spacing (137.5 degrees) would keep any number apart.
- The short hair's hairline keyline reads as a white headband in the render (`faces8.png`, top row). It follows ADR 0076 A2 literally, so this is a taste call for the owner, not a defect.
- `emit.ts` `pc-<ns><panel>` clip-path ids can in principle meet another band's ids; unscoped comics cannot meet each other (anchor registration refuses the duplicate), so it is theoretical.
- `character.ts:44` finds duplicate ids with `\sid="…"` after the sanitizer has already dropped ids nothing refers to; it works, but a comment would save the next reader a minute.

## Checks against your list
1. **Conformance.** ADR 0074 U2: 8 expressions, 2 hair styles, hue, `CharacterManifest` with a non-square box kept as it is, anchors mapped by the head circle, `comic(sheet, {characters})`, `comic-asset-missing` (missing asset, missing expression; both fall back to the built-in face), a licence-less manifest throws, per-person id prefixes (plus a scope part), tests for each. ADR 0076 A2 (three layers at hair/face, face/clothes, hair/shoulder via the clipped key+ink+key; the outer edge is ink only; glasses are U4): implemented, with a test that checks the layers and the paper/ink contrast. M1 above is the one defect. Your open questions: (1) passing characters through `comic()` is right and the ADR note says so. (2) Hue from the cast position is fine now that the ADR note records it (see the nit). (3) One JSON manifest: the ADR D3 text was edited in the PR to say so, which resolves the mismatch. (4) The hair-lock and shoulder shapes read well in the render; they are taste, not a spec point.
2. **Renders.** `comic-column` is good: faces read, and the tails land on the mouths. `comic-grid` unchanged apart from the faces. `comic-faces`: the figures and the robot read; keylines look right (a clean white line on both sides of every inner boundary, none on the outer edge); the overlap of three people in panel 4 is the example's choice. The expression bug is M1.
3. **Asset loading safety: sound.** I ran 26 hostile fragments through `loadCharacter`: `<script>`, `<SCRIPT>`, `<foreignObject>` (upper and lower case), `onload` / `onclick` (double and single quote), `style=`, external `href`, `<a href=javascript:>`, nested `<svg>`, `</svg>` break-outs, CDATA, comments, `url(http…)` in fill and clip-path, a `filter` attribute, named colours, `<image>`, `<animate>`, an entity in a value, `>` in an attribute: all rejected (the sanitizer is a tag and attribute whitelist with re-serialisation). `__proto__` and unknown expression keys are rejected; `Object.hasOwn` guards the asset lookup (a mutation to `in` is caught). Ids: rewritten per panel, person and scope; two cast entries with the same asset in one panel cannot collide. The licence check is as in m1. One real gap: m4.
4. **Determinism and purity.** `character.ts`, `face.ts`, `emit.ts` import only `icon-store`, `constants`, `template` and `scope-name` (no `node:*`); no randomness, clock or locale use; the drawing is a pure function of the data and the characters (same input, same SVG, tested). Dark theme: I drew a character with 3-digit, 6-digit upper-case and 8-digit hex plus `currentColor` under `appearance: 'dark'`: the band is identical to the light one.
5. **Mutations.** 14 of mine, all caught: hairline keyline removed, body clip removed, lock keylines removed, silhouette clip changed, id prefixing removed, paint rewrite removed, licence url check removed, scale forced to 1, `in` instead of `hasOwn`, hue index fixed, duplicate-id check removed, panel clip removed, scope namespace removed, and the brow-sign fix (which fails the pinned golden, which is how I know M1 is not tested).
6. **Goldens.** Only comic files, as above; the pptx rows match locally.
