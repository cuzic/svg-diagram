# PR #471 review (Opus, round 1)

Target: feat/comic-row-layouts @ be43111f50c7ef6c86c7b23b6a0b96cb28557c35

## Conclusion
converged: no. The default (18px, column/2x2) path is unchanged and the new code threads `fontSize` consistently, but the layouts do not deliver what they are for: `4x1` cannot be placed on the slide canvas (or any diagram narrower than 1320px) and the error does not say how to fix it, the ordinary two-speaker exchange in one row panel fails `comic-tail-crosses-bubble` at almost any size, and `fontSize: 28` (accepted by validation) fails every bubble of a row layout with a fix that cannot work. Several of the new `fontSize` paths survive mutation.

## Previous round
None (round 1).

## Findings

### M1 (Major): the row layouts do not fit the slide canvas or the default diagram width, and the failure does not say what to do
- Evidence (ran, probe outside the PR): `diagram({canvas: 'slide'}).add(comic(<4x1>, {fontSize: 24}))` → `✗ "comic panel p4" at (998,52) 300x400 exceeds the 1280x720 canvas`. With `slide: true`: p3 and p4 exceed the 940x472 canvas. With a plain `diagram()`, `3x1` also fails (`"comic panel p3" at (668,36) 300x400 exceeds the 940x472 canvas`; the band is 964px). `layoutComic` centres with `Math.max(0, w - W) / 2` (lib/comic/layout.ts:58), so a band wider than the content width silently starts at the left edge and only the generic canvas-overflow check stops it. The 1280px band width in the ADR note ("4×1 の帯は 1280px = スライドの幅") ignores the diagram/canvas padding: the example has to use `width: 1320` plus `accept: {'doc-width'}`, and a deck then scales it by 1280/1320, so `fontSize: 24` is drawn at about 23.3px. README / comic.md / the ADR say "スライド向け" but never say a wider `width` is required.
- Fix: size the row panels from the width actually available (the slide canvas content width, or `w` passed to `layoutComic`) so that `4x1` fits `canvas: 'slide'`, and when a band is wider than `w`, emit a comic finding that names the needed `diagram({width})`; document the width requirement.

### M2 (Major): two speakers in one row panel cross their tails for ordinary input
- Evidence (ran, `layoutComic` with `widthOf = len*9`, panel p1, speakers at left/right, two `say` bubbles in either order): `4x1` reports `comic-tail-crosses-bubble` for one-line `はい。` at fontSize 22, 24, 26 and for a two-line line at 18; the same sheets in `1x4` report nothing up to 22. Cause: a bubble is never narrower than 9 em (`reserveAtoms`, `base = Math.max(innerMax, widest)`), i.e. ≥186px at 18 and ≥248px at 24 in a 300px panel, so two bubbles always stack and the upper one's tail must pass the lower one. The PR's own example only works because every panel has a single bubble; the A-says/B-replies panel, the normal unit of a comic, is unusable in the new layouts at the font sizes the PR adds for slides. The comic.md advice "1 人 1 ふきだしにする" is a restriction the ADR does not record. Also seen: `1x4` with `fontSize` 24 and a two-line bubble reports `comic-tail-off-speaker`.
- Fix: let a bubble shrink to its text when it has no blank (or cap the inner width in row panels so two bubbles fit side by side over their speakers), and add a test with a two-speaker row panel at 18 and 24 that has no findings; if left as is, record the limitation in the ADR as a decision.

### M3 (Major): at `fontSize: 28` every bubble in a row layout is an error, and the message gives a fix that cannot work
- Evidence (ran): `2x1`, a three-character line `うん。`, `fontSize: 28` → `p1.d1: the bubble is 292px wide, wider than the panel allows (284px): shorten the blank or the text, or use a smaller fontSize [comic-bubble-zone]` for every bubble; 26 and 27 pass. The minimum bubble is `ceil4(9*28 + 2*19) = 292 > 300 - 2*SIDE_KEEP`, so shortening the text never helps. `comic()` accepts 28 (lib/dsl/comic.ts:88).
- Fix: either reject/limit `fontSize` by layout (e.g. 14–27 for row layouts) in `comic()` with a message, or make the minimum bubble width fit the panel (see M2); and when the bubble is wide only because of the 9-em minimum, the message should say "use fontSize ≤ 27" rather than "shorten the text".

### M4 (Major): the new `fontSize` paths are not covered by tests (mutations survive)
- Evidence (ran each mutation against comic-row-layout, comic-layout, comic-wrap, comic-values, comic-render, comic-band: all 92 pass):
  - remove the new width check `if (bw > PW - 2 * SIDE_KEEP) add('comic-bubble-zone', …)` (layout.ts:114);
  - `comicMeasure` measures Latin atoms at `FONT` instead of `band.fontSize` (measure.ts:13; the browser `renderComic` path would then lay out with unmeasured widths at the real size);
  - `glued`: `unitW + font <= 9 * font` → `<= 162` (reserve.ts:10);
  - `valueAtoms` requests `FONT` instead of `laid.fontSize` (slot-values.ts:46).
  `STAGE_X_ROW` → `STAGE_X` and the prompt size → `SLOT_FONT` also survive these tests and are caught only by the `comic-row.svg` golden.
- Fix: add direct tests for the width finding (fires at 28 in a row, not at 27 / not in a column), for `comicMeasure(band)` returning the band's `fontSize`, for the glued-hiragana threshold at 24, and for `valueAtoms` sizes with `fontSize` set.

### m1 (Minor): the slide-oriented example and docs cannot meet the slide text floor
- Evidence: on `canvas: 'slide'` (3x1, `fontSize: 24`) the check reports `slide-min-text` 14px (the panel number badge). The blank prompt is `round(14 * k)` = 19px at 24 and 22px at 28, so a comic with blanks can never reach 24px even at the maximum `fontSize`. The example sidesteps this by not using a canvas.
- Fix: see the answer to open question 2 below; state in comic.md that comic on a slide canvas needs `accept: {'slide-min-text'}` until then.

### nit1: "3 人が並んでも頭の円が重ならない" is exact contact
- Evidence: in a 300px panel heads are at 76 / 148 / 224 with r=36, so left and centre touch (76+36 = 148-36 = 112); the test only checks two people (`b.cx - a.cx >= 2r`). Asset characters wider than the head circle will overlap.
- Fix: say "touch" in the ADR, or move the centre person / use 72.

## Open questions (reviewer's recommendation)
1. **3x1 panel width**: do not keep a single 300px. Derive the row panel width from the target band width (the slide canvas content width, M1) divided by the column count, capped at 420: `4x1` ≈ 284, `3x1` ≈ 380, `2x1` = 420. A wider 3x1 gives room for two side-by-side bubbles, three people and `fontSize` up to 28, which is exactly where 300 fails (M2, M3).
2. **Badge vs `fontSize` / slide-min-text**: scale the badge with `fontSize` (box `round(24k)`, text `round(14k)`, keeping `BADGE_OVERHANG`, `ZONE_TOP` and `NARRATION_LEFT` clear of it), so the badge never becomes the smallest text. That alone will not satisfy slide-min-text because the blank prompt is 14k; either make the prompt `max(14k, …)` follow the slide floor when on a canvas, or exempt blank prompts (hint text that is replaced when filled) from `slide-min-text` explicitly. Decide in the ADR rather than relying on `accept`.
3. **Crossing tails**: do not leave it as a check-only outcome; it is the common case in row panels (M2). Minimum: shrink-wrap bubbles without blanks and place two speakers' bubbles side by side when both fit; otherwise record the one-bubble-per-panel limit in the ADR and have the finding's message say so.

## Verdict
converged: no (Blocker 0 / Major 4 / Minor 1 / nit 1)

CI at review time: golden pass, test (2/3) pass, test (1/3) and (3/3) pending. Targeted local runs: 73/73 comic tests pass on the head.
