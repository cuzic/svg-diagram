# Round 3 (head 0645a324)

CI green (golden, test 1/3, 2/3, 3/3). The 5 comic test files: 94 pass. Goldens: only comic files. Leak grep over the diff: nothing (only `example.com` and `e.example`).

## Fix verification
- **M2 (`anchors.top`): fixed.** `characterOverhang` uses `anchors.top`, defaulting to the head circle's top, so a manifest without it is not checked.
  - The ADR sample with the example robot as `me` at 6:5: `comic-bubble-zone` 0 (was 1). With `top: 0` it is reported again, with `top: 34` (the true top) it is not; the drawing is identical in all three cases, only the check differs (`r442/asset-default.png`).
  - Random-asset fuzz (2000 panels): `comic-bubble-zone` 54 with assets, 54 with the built-in faces (was 711 against 54). With an explicit `top: 0` on every box the rate goes back to 711, so the check still works when asked. Still 0 tails inside a head and 0 tails more than 10 degrees off the mouth over 2539 tails.
  - The layout is unchanged by the check; the 7:5 sample behaves the same as with the built-in face.
- **m5: fixed.** `r = 0.001` and `r = 1` in a 200x240 box are refused (below 1/50 of the short side); `r` at half of the short side is accepted; a `1e9` box is refused (cap 4096). Mutations removing the lower bound or the box cap are caught.
- **Licence url: fixed.** `https://x\n<script>` is now refused (`/^https?:\/\/\S+$/`); the mutation back to the prefix-only pattern is caught.
- **Hue: fixed.** Adjacent people in the cast are at least 137 degrees apart whatever the cast length (the test walks 361 people, including the wrap), and the first 6 are at least 35 degrees apart, which is what the ADR now says. Mutation to a step of 70 is caught.
- **Surviving mutations: now caught.** Dropping the overhang's skipping of the face and tail checks fails a test; measuring from the head centre instead of the head top fails a test. All 10 mutations I ran this round are caught: default top, top ignored, lower bound, box cap, url pattern, `top` number check, `top` kept in the loaded manifest (5 tests fail), skip, centre height, hue step.
- **Public type and docs: fine.** `lib/types/comic.ts` has `anchors.top?` in both `CharacterManifest` and `ComicCharacter`, with a comment; README, the skill and the ADR describe it (default, units, what is checked). The README row is the same list as before apart from the type.
- **Renders.** The three comic SVGs are as in round 2 (correct brows, tails on the heads, keylines clean); the asset sample with and without `anchors.top` draws identically.

## Findings (Nit only)
- `anchors.top` is only checked to be a finite number. Values above the box (`-50` in a box starting at 0) or below it (`500`) are accepted; an above-box top just widens the checked area upward, and a below-head top disables the check. Validating `box.y <= top <= head.cy - head.r` would catch a typo; optional.
- The width of the checked area is still the whole box width; an artwork narrower than its box can raise the zone problem from a bubble that is beside it, not above it. A manifest author can reduce it by cropping the box; not worth a new field now.

## Verdict (round 3)
All fixes verify, the random-asset `comic-bubble-zone` rate now equals the built-in faces' (54 and 54), and nothing new above Nit. No Blocker, no Major, no Minor. **Converged: OK to merge.**
