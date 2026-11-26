# PR #488 review (Opus, round 3)

Target: feat/decision-ladder-numbered @ 0f172638ade634b572b693321a0958f54640850e (scope: 1c2efb26..0f172638)

## Conclusion
Both round-2 Majors are resolved. The `ladder-height-bound` finding now names a width only when the figure, laid out at that width, scores higher. On real deck slides (title only and with a lead), the named width never gave smaller text in 417 cases, and the message no longer contradicts itself. CI is green. What is left is Minor: the cost of the width search (about 0.4s per check, 2.9s for a diamond ladder), and a gain the message overstates when the slide's 1.25 scale cap already applies. converged: yes.

## Previous round
- M1 (wrong width advice): resolved. Checked by running it, not by reading the description. `probe/r3/gen.ts` covers 27 ladders: the user's shape as box, numbered and diamond, plus 24 random ladders from seeds 7, 42 and 99 with 3–8 steps, some numbered. Each ran at widths 420–1000 in steps of 20: 810 checks, 671 findings. 417 findings name a width (all of them "widen", none "narrow"; the new height is always lower), and 254 say the height binds. `probe/r3/deck.ts` renders each (W, N) pair as a real `renderDeck` slide, 1280×720, using the slide's minimum text pt. Title only: 383 larger, 34 equal, 0 smaller. With a two-line lead: 397 larger, 20 equal, 0 smaller. The equal cases are m2. "Height binds" against the actual title-only room (min(1168/W, 578/(h+40), 1.25)): only one case had a better width (+3.4%, W=980, outside the 380–900 search). The message's own ratio ("高さ / 幅 = 0.54（0.47 まで）") and its advice now agree.
- M2 (CI red, bundle budget): resolved. Run 45806310382 passes all 4 jobs. `decision-ladder` esbuild is 170200 bytes against a budget of 171000.
- m1 (compact floor of 15px): resolved. The floor is `GAP_FLOOR` = 20 with no `sp` multiplier, and a new test asserts that compact without words gives 20.

## Findings

### m1 (Minor): the width search costs about 0.4s on every check or render of a too-tall ladder, and about 2.9s for a diamond ladder, where it can never help.
- Evidence: in `probe/r3/gen.ts`, a check with the finding has a median of 409ms (max 3020ms), and a check without it 4ms. The CLI on the user's shape: `check` takes 1.50s against 1.02s for a short ladder, and `build` 1.85s against 1.42s. To count searches, I added a temporary counter (reverted): `renderDeck` runs the search exactly once per slide for `.ts`, for a JSON spec with a width, and for a JSON spec with `fill` (with or without a lead). It is not multiplied by the fill search or by SVG/PPTX output. `probe/r3/dia.ts`: the 5-step `question: 'diamond'` ladder takes 2.85–3.08s per check at both 640 and 940. Its height is 793 at every width, so all 66 relayouts are wasted. That cost lands on every MCP `render_*` or `check_*` and on every VS Code preview refresh of such a figure. `lib/ladder.ts:121-130`.
- Fix: skip the search for `question: 'diamond'` (or return early when the relayout at 900 is no lower than now), and/or search in coarser steps first. Also correct the ADR's "1 回 0.4 秒ほど".

### m2 (Minor): the claimed gain ("約 N% 大きくなる") is not seen on a slide when the figure is already at the deck's 1.25 scale cap.
- Evidence: in 34 of 417 named cases (title only) and 20 of 417 (with a lead), the text is 15.75pt at both W and N, while the message claims +6–22%. Examples: random case c4 at W 480–580 → 596, and c13 at W 420 → 524 (`probe/r3/title.out`, `lead.out`). These are narrow figures (W ≤ about 600) that the slide already draws at `MAX_FIGURE_SCALE` (`lib/deck-layout.ts:11`). The text never gets smaller, so the advice is harmless, only overstated.
- Fix: say "最大で約 N%" or add "（スライドで縮んでいるとき）". Optionally drop the claim when both widths would be capped. The figure does not know the room, so a softer wording is enough.

## Checks run
- CI on 0f172638: golden, test 1/3, 2/3 and 3/3 all pass.
- Probes: `probe/r3/gen.ts` (810 checks), `probe/r3/deck.ts` (2 × 444 real slides, title only and with a lead), `probe/r3/cost/cost.ts` (search count per `renderDeck` path), `probe/r3/dia.ts` (diamond timing). None are committed.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 2 / nit 0)
