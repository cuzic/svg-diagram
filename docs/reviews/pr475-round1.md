# PR #475 review (Opus, round 1)

Target: fix/comic-row-deck-bugs @ 313d5b83315d5964c53df05667e2d27fb4fdc65b

## Conclusion
The row-layout retry and the shoulder clip are correct: a 3 x 4000-case fuzz of 2x1/3x1/4x1 panels (aspect 3:4/1:1/7:5/default, fontSize 18-28, width 800-1400, 0-1 narration + 1-4 lines of 2-20 full-width characters, two speakers) found no panel without a `problem` that has a bubble outside the panel/band, overlapping bubbles, a tail behind another speaker's bubble, or a later bubble above an earlier one; the PR draws ~8% more panels cleanly than main and never adds a problem main did not have. The clip is emitted with consistent ids in the slide SVG and in the `.pptx` picture (resvg honours it). But the deck fix covers only `renderDeck` (`serve` / `site`): `pptx-deck` still drops `verdict.problems` silently, and both repro decks still write a `.pptx` with no message. converged: no.

## Previous round
n/a (round 1)

## Findings
### M1 (Major): `pptx-deck` (and the edge `renderDeckPptxEdgeWith`) still drop figure `problems`, so bug 2 (and bug 1) stay silent on the `.pptx` path
- Evidence (ran): with the PR head, `node pptx-deck-diagram.ts deck2.json` on the reporter's repro (one slide, a 4x1 comic, aspect 1:1, fontSize 22, `diagram({width: 800})`) prints only `wrote … (1 slides)`; `renderDeck` on the same deck now gives `slides[0].figure` warnings `comic-band-narrow`, `comic-tail-off-speaker` and the generic "`comic panel p4` at (684,36) 200x268 exceeds the 800x340 canvas". Same for `deck.json` (slide 0: 12 `comic-bubble-zone` / `comic-text-budget`, slide 1: `comic-tail-off-speaker`): `pptx-deck` prints only `comic-orphan-line` advice. Cause: `pptx-deck-diagram.ts:64` and `:81` print `r.result.verdict.warnings` only; `lib/pptx-deck-edge-core.ts` uses `f.findings` (warnings + problems, `lib/pptx-edge.ts:38`) only as fit flags. ADR 0056 D2 / the `smallText` comment in `render-deck.ts` require serve and `.pptx` to say the same thing.
- Fix: surface `verdict.problems` the same way (same severity as decided for (a) below) in `pptx-deck-diagram.ts` (both the single-figure and the chosen-columns branches) and in `pptx-deck-edge-core.ts` (`plan` and the columns branch), with a test per path.

### m1 (Minor): the ADR note says "no set fits → keep the half-width set", the code keeps the set with the fewest mistakes
- Evidence (read): `lib/comic/layout.ts` (retry loop) `if (n < best) { best = n; reserved = cand; }` keeps a partial improvement; ADR 0074 implementation memo "どれも引っかからないときは半分の幅の組のまま". Behaviour is safe (every remaining mistake is reported by the final loop; fuzz confirmed), only the text differs. Related: the score counts mistakes, not overflow, so in the reporter's composition (204px panel, 13+9 characters + narration, band of 2 lines) the 7-line, 2-characters-wide bubbles that run ~175px past the band are kept (reported, but the worst-looking drawing).
- Fix: change the ADR sentence to "the set with the fewest mistakes (half width when none is better)"; optionally break ties by total overflow px.

### m2 (Minor): the columns branch of the `renderDeck` change has no test
- Evidence (ran): reverting only `render-deck.ts:98` (chosen-columns `warnings: f.value.verdict.warnings`) keeps `comic-row-fixes`, `present-render-deck`, `deck-columns` green (27/27).
- Fix: add a deck test with an auto-columns slide whose column figure has a problem.

### n1 (nit): the clip rectangle is the panel's outer edge, so a clipped body still paints over the inner half of the frame stroke
- Evidence (read): `lib/comic/emit.ts` `clipPath` rect = panel rect; persons are drawn after the frame. Same as assets already do; visible only as a slightly thinner frame where the body touches it (`p1.me` at x≈40 in the 204px panel).
- Fix: none needed; or inset the clip by `FRAME / 2`.

## Recommendation on (a): errors or warnings
Dropping `problems` was a general gap, not a comic one: `renderDeck`, `pptx-deck` and the edge all ignored the figure verdict's problems for every band (the repro shows a generic canvas-overflow problem and a tail problem in a figure without the comic fix). Everywhere else a problem stops output: `build` (`lib/build-verdict.ts`), `check`, the `deck` HTML command (ADR 0018, `deck-diagram.ts:42` puts `problems` in `failures`), `markdown --strict`. Rules can already be demoted per figure or project with `accept`. Recommendation: make them **errors** (the slide is not drawn, `site`/`pptx-deck` write nothing), uniformly in all three deck paths, and say in the message that `accept` is the escape hatch. Blast radius in the repo is nil (no deck fixtures; the targeted deck tests and the golden job pass); external decks that start failing are exactly the ones whose figures are drawn broken today. If the owner wants a softer landing, warnings in all three paths now plus an ADR note scheduling the switch is acceptable, but serve-only warnings (this PR) are not.

## Other checks
- Targeted tests: `comic-row-fixes`, `comic-row-layout`, `present-render-deck`, `deck-columns`, `wordart-slide`: 73/73 pass. CI golden: pass; test shards pending at review time.
- Clip: `.pptx` picture SVG has `clip-path="url(#pptx-band-0-pc-pN)"` with a matching `<clipPath id="pptx-band-0-pc-pN">`; the PNG shows the left body inside the frame. Column / 2x2 panels (head 104px from the side) are not clipped (test asserts).
- Interference: #473 (chat band) touches `lib/comic/layout.ts` and `emit.ts`; `git merge-tree` shows a content conflict in `layout.ts` with this PR.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 2 / nit 1)
