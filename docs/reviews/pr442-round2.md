# Round 2 (head e9dbf442)

CI green (golden, test 1/3, 2/3, 3/3). The 5 comic test files: 88 pass. `golden:pptx` for the three comic examples matches the manifest locally. Goldens: only comic files. Leak grep over the diff: nothing (only `example.com`).

## Fix verification
- **M1 (brows): fixed.** I re-rendered all 8 expressions in isolation (`r442/faces8.png`) and the three comic SVGs. `angry` now has the angry V, `worry` and `sad` have the worried slant, the same in `comic-faces` panels 3 and 4. Reverting the sign, or swapping only the `sad` one, now fails 2 tests each (the semantic test works).
- **m1 (licence): fixed.** `javascript:alert(1)`, `x` and `ftp://x` are refused; a blank `spdx` is refused; the author check stays. Mutations removing the url, spdx or author check each fail a test. Nit: `https://x\n<script>` still passes (the pattern only checks the prefix); the field is not drawn, so it is harmless today. Use `/^https?:\/\/\S+$/`.
- **m4 (`currentColor`): fixed**, including `stop-color`; test-covered (mutation caught).
- **m5 (head circle): half fixed.** The circle must lie in the box and `r` is at most half of the short side (both mutations caught). `r = 0.001` and a `1e9` box are still accepted (a scale of 36000 or a huge nested `<svg>`). Add a lower bound (for example `r >= min(bw, bh) / 50`) and a cap on the box size. Minor.
- **Hue nit: fixed.** `210 + 137 * i`: the first 6 are at least 35 degrees apart (51 for the first 5), as the ADR text says; later ones come within 16 degrees, which the ADR does not promise.
- **m3 (comic-faces): fixed.** The robot's `say` bubble and the `think` bubble now show tails that land on their speakers' heads; the think face (and all 8 expressions) are in the golden. Panel 2 puts three people across 360px, so the heads and shoulders overlap; legible, but it is the example's choice.
- **Re-run fuzz.** Built-in faces (3000 and 6000 random panels): the same clean result as in #436 (no tip inside a head, no tail behind a bubble in a problem-free layout, no speaker without a tail). With random artist boxes (2000 panels, `r442/fuzz3.ts`): 1591 tails, none inside the head, none more than 10 degrees off the mouth. But see M2.

## New finding

### M2 (Major, may be accepted as a documented limit). The new asset-top check uses the box, not the drawing, so it fails valid layouts, including the ADR sample with the PR's own example robot
- `lib/comic/layout.ts` (the `overhangs` block, about lines 83-86 and the `rectOverlap(rect, bounds, 0)` test): the area "above the head circle" is the placed box, full width, from the box top to the head top. Any empty margin above the artwork counts as occupied.
- Reproduced: the ADR sample (`SAMPLE`) with `me` drawn by the example robot (box 200x240, head circle top at 34, so 22px of empty margin at the default scale) at 6:5: `comic-bubble-zone` at `p2.d2`, while the built-in face passes with 0 problems and the same layout. The reported bubble also loses its face and tail checks (`skipChecks`).
- Scale of the effect: over 2000 random panels with random artist boxes, `comic-bubble-zone` is reported in 711 with assets against 54 with the built-in faces (my generator gives boxes random margins, which exaggerates it, but it shows that the problem rule is now dominated by the box margin).
- The contract is documented (ADR note and `skills/.../comic.md`: "the box above the head circle must not meet the bubbles"), so this is a known design choice, not a bug in the code. It is Major because the failing rule is a `problem` (it stops `check`), the remedy is cropping an artist's file, and the PR's own example and the ADR's own sample show the failure.
- Fix options: (a) an optional `anchors.top` (the highest drawn y, default: the head circle's top, so a manifest without it is not checked) and check against that; (b) keep the box rule but give it advice severity (a warning) rather than a problem; (c) accept, and tighten the example robot's box so the example and the ADR sample both pass, and say in the ADR that the box must hug the artwork. I prefer (a). Either way, the layout is unaffected, as ADR 0074 U2 requires.
- Related test gap (Nit): the mutation that stops the overhang from skipping the face and tail checks (`skipChecks`) survives, and so does measuring from the head centre instead of the head top (equivalent in practice, since bubbles never reach the circle).

## Mutations
12 new mutations: brow signs (2), licence url, spdx, `r` bound, containment, currentColor, overhang check removed, hue step, containment origin offset: all caught. Two survive (the overhang `skipChecks` and the overhang height from the centre), as above.

## Verdict (round 2)
All round-1 fixes verify and the brows read correctly. No Blocker. One Major remains (M2): decide between (a), (b) and (c). If the owner accepts the documented box contract, it drops to Minor and the PR can merge after the example robot's box is tightened (so the ADR sample passes with it). The m5 lower bound and the url pattern are optional. **Not yet converged: M2 needs a decision.**
