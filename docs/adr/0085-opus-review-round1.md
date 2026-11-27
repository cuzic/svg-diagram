# ADR 0085 review (Opus, round 1)

Target: adr/0085-deck-figure-text-size @ a7b88ac1

## Conclusion

The measurements are real. I re-ran them with `loadDeck` + `renderDeck` (`measure: 'font'`, Japanese font) and got the ADR's numbers exactly for every case I tried. The root cause (k = min(room / figure, 1.5) with fixed 14px roles, and fixed radii in concentric, venn and cycle) is correct against `fillSearch`, `FILL_FIGURE_SCALE` and the part code. The design still needs changes before the owner decides. Q1's "relative to the body text" rests on a false premise: the lead size is a constant, so the rule is really an absolute threshold, and it skips slides that have no lead. On real decks the recommended threshold fires on 14 % of figures, mostly figures that D2–D4 never touch. The warning's fix advice is wrong for the fixed-size parts. D2 can push text past ADR 0060's 21px ceiling. D2's "existing fit checks" do not exist for cycle. D2 also has to reach entry points the ADR does not list, MCP `render_deck` among them. converged: no.

## Previous round

None. This is the first round.

## Measurements re-run

Invented words only. Slides used `title + lead` (A), `+ one callout` (B), or a title only (C).

| case | ADR | re-measured |
|---|---|---|
| concentric A, 3 rings | k 1.115, 15.6px | k 1.115, 15.6px |
| concentric B, 5 rings | k 1.008, 14.1px | k 1.008, 14.1px |
| venn A (universe, 1 overlap) | k 0.960, 13.4px | k 0.960, 13.4px |
| venn B (universe, 3 overlaps) | k 0.868, 12.2px | k 0.868, 12.1px (9.11pt) |
| cycle A, 4 and 6 steps | k 0.988, 13.8px | k 0.988, 13.8px (both) |
| sankey C, 8 nodes in one layer | k 1.095, 15.3px | k 1.095, 15.3px |
| versus A / B | 21px / 12.3px | 21px / 12.3px |
| table, mindmap (controls) | 21px | 21px |
| venn B with `fit: 'width'` | – | k 0.940, the same as `fill` (height-bound either way) |
| cycle, venn in a 2-column slide | – | k 1.5 (21px) |
| concentric in a 2-column slide | "radial parts reach 1.5" | k 1.115 (does not reach it) |

Root causes checked:
- `smallTextWarning` (`lib/deck-layout.ts:310`) is an absolute 9pt check on `minTextPt` from the PPTX plan's shapes.
- `analyzeFit` (`lib/fit.ts:50`) applies only to the old `diagram({slide})` medium, not to deck figures.
- `FILL_FIGURE_SCALE = 1.5`.
- concentric `R = min(220, w × .42)`, venn `r = min(w × .21, 170)`, cycle `h0 ≤ 520` / `nr ≤ 54`, sankey `H = max(300, 46n + 120)`.

All of these are as the ADR says. Wider layouts (`wideWidths`, B6) do not help either, because R, r and h0 are capped (nit 1).

## Findings

### M1 (Major): Q1's "relative to the lead" is an absolute threshold that exempts slides with no lead
- Evidence: `STYLE.lead.size` is the constant 19 (`lib/deck-layout.ts:30`), and `deck.schema.json` has no text-size option (its only `*Scale` is `columnScale`).
  - So Q1a is "< 15.2px when the slide has a lead, < 12.8px when it has only a callout, and no relative check otherwise".
  - The recommendation's reason, "stricter as the user uses larger body text", cannot happen. Q1c's drawback, "too strict on slides with small body text", cannot happen either.
  - A slide with a heading only (condition C, the case with the most room) is never checked. The Q1 table says Q1a warns on sankey C, but sankey C is a heading-only slide, so D1 as written would not warn on it.
  - In the local decks counted below, 11 of 208 figure slides have no lead.
- Fix: define one effective-size threshold T (px on the slide) for every deck figure, whatever text the slide has, and put T in a named constant beside `MIN_TEXT_PT`. Reword Q1 as a choice of T (15.2 / 14.25 / 14), with the counts from M2.

### M2 (Major): the warning's reach on real decks is not counted, and most of what it flags is outside D2–D4
- Evidence: I rendered six local decks (208 slides with a figure, 178 figures measured) with `renderDeck`, logging `scale` and `minTextPt` at `smallTextWarning`.
  - The existing 9pt warning fires on **0** of them.
  - Q1a would fire on **25** (14 %), Q1b on 16, and an absolute 14px on 15. The flagged figures measure 12.2–15.1px.
  - By part type the 25 are: `.ts` figures 8, sequence 3, cycle 3, causeTree 2, and one each of versus, tree, timeline, steps, rangeBars, mindmap, journeyMap, flowchart and bpmn.
  - Only 4 of the 25 are parts that D2–D4 address. One is a mindmap, which the ADR uses as a control.
- Fix: put these counts in the ADR. Make clear that U1 is a general readability warning, not one for radial parts. Let the owner choose T knowing about 1 in 7 figures will warn at 15.2 (about 1 in 12 at 14 / 14.25). Say that U2–U4 clear at most a few of them.

### M3 (Major): the proposed message's fix ("fewer items, or split the slide") does not work for the fixed-size parts
- Evidence:
  - cycle with 4 and with 6 steps gives the same k (0.988).
  - concentric's R does not depend on the ring count, and 3 rings still give 15.6px.
  - For venn, r does not depend on the overlaps.
  - Removing items does nothing for these parts. What does help, measured: the same cycle or venn in a column reaches k = 1.5, and dropping the callout or lead gives a taller room.
- Fix: base the fix text on the cause. For a figure whose height is capped by the part (concentric, venn, cycle), suggest giving the figure more height (drop the callout, or put it in a column beside text), and from U2 on rely on D2. For a part that stacks rows (versus, sequence, tree, …), suggest fewer items or a split.

### M4 (Major): D2/Q3 can make figure text much larger than ADR 0060's ceiling
- Evidence: Q3a's rationale assumes k is about 1.0–1.2, but D2 picks the size without looking at k.
  - In a two-column slide, cycle and venn reach k = 1.5 (measured), so 22px comes out at 33px, close to the 37px heading.
  - ADR 0060 caps k at 1.5 so that 14px text stays at about 21px.
- Fix: choose the size from the effective target: `size = clamp(14, floor(21 / k), largestThatFits)`. Lay out at 14 first to get k, then lay out again. This works because the fixed-radius parts do not change size with the font (but see M5). Apply it only when `14 × k` is under T.

### M5 (Major): the "existing fit checks" D2 relies on are missing or do something else
- Evidence:
  - **Plain cycle** (`lib/flow-cycle.ts:50-90`) has no `fits`. Labels are only wrapped to `1.5 × nr` (81px at nr 54), and nothing checks that the wrapped block stays inside the circle. At 22px bold, a 4-character label (88px) wraps to two lines, unchecked.
  - In the same function, a long katakana word grows `nr`, R and the height with the font size.
  - **Cycle with links** (`layoutLinked`) chooses `nr` from the text, so a larger font means larger circles, a taller figure and a lower k. The "fixed size" premise fails there.
  - **venn** `fits` covers only sets that have items. A misfit becomes a figure problem (`verify-flow.ts:8`), which is a slide error in a deck, not a signal to try a smaller size. Overlap labels and the universe label are not checked at all.
  - **concentric**: `chord(k.h)` is a wrap width with up to 3 retries, not a fit test, and the sectors and `labels: 'side'` layouts are separate code paths.
- Fix: in D2, spell out the fit test for each part:
  - concentric: the ring-label block inside its band, in the non-sector `inside` layout only;
  - venn: every set or overlap label inside the region it belongs to;
  - cycle: the label block inside the circle, plain cycles only.
  - Leave out linked cycles and the katakana-growth path, or require the final k to be no lower than at 14px.

### M6 (Major): D2's deck-only option has to reach more entry points than the ADR names, and MCP `render_deck` gets neither D1 nor D2
- Evidence: a deck spec figure is drawn through several entry points.
  - `renderDeckSpec` (`lib/deck-render-spec.ts`).
  - The `specToDiagram` fallback in `renderDeckFigure` (taken whenever `renderDeckSpec` returns undefined).
  - `drawColumnFigure` (used by `chooseColumns`).
  - The edge `services.plan(spec, engine, width?)` in `pptx-deck-edge-core.ts`, with two implementations (`pptx-deck-edge.ts`, `pptx-deck-selective-edge.ts`).
  - CLI `pptx-deck` reaches `renderDeckFigure`, and the Worker's export reaches the edge `plan`. If any of these misses the option, `serve` and the .pptx differ, which breaks ADR 0056 D2.
  - PPTX itself carries the size, because `planSlide` writes the laid-out font size times k as native text. So the option only has to reach the layout.
  - The MCP plugin's `render_deck` draws each figure with `renderSpecEdge` as a document figure (no slide layout, no `smallTextWarning`). Its answer would therefore never carry the D1 warning, and its preview would not show D2 sizing, while `export_deck_pptx` (`renderDeckPptxEdge`) would. The plugin also vendors a released svg-diagram tarball, so nothing reaches it before a release and a vendor bump.
- Fix: in D2, list these entry points and add a parity test: the same deck through `renderDeck` and `renderDeckPptxEdge` gives the same label `sz`. State the MCP scope explicitly, as a plugin follow-up that maps deck warnings to `findings` and draws previews through the deck layout, or as out of scope for now.

### m1 (Minor): D3's root cause and estimate for sankey are incomplete
- Evidence: `H` is also the budget for ribbon thickness.
  - `fits(sc)` scales flows into H, and a node never gets less than `minH`. Lowering H makes ribbons thinner and pushes more nodes onto the `minH` floor, which distorts the proportions.
  - The "k about 1.4" estimate is optimistic. At layout width 940 the room caps k at 1168 / 940 = 1.24, so 1.4 needs a narrower layout, where labels may wrap and the figure gets taller again.
  - The only measured case is on a heading-only slide, which D1 as written does not check (M1).
- Fix: list "fill search also tries a shorter H, like the widths" as an option. Recommend Q4c (defer) until U1/U2 data shows sankey matters.

### m2 (Minor): "radial parts reach k = 1.5 in two columns" is not true for concentric
- Evidence: concentric in a two-column slide gives k 1.115 (R stays 220 at the narrower widths, because w × .42 ≥ 220 down to 524px). Cycle and venn reach 1.5.
- Fix: correct the sentence. Concentric then gains the most from D2.

### m3 (Minor): D2's scope is open in several places
- Evidence: the ADR does not say whether D2 applies to:
  - concentric with `sectors` or `labels: 'side'`;
  - `fit: 'width'` slides (cap 1.25), which measured the same k as `fill` for venn B;
  - `.ts` deck figures (`loadDiagram` path, no deck option);
  - column figures drawn by `chooseColumns`.
- Fix: state each one. Suggested: non-sector `inside` concentric only; both fits (the size depends on k, not on the fit); spec figures only, with `.ts` figures getting U1 only.

### m4 (Minor): ratchets and budgets to plan for
- Evidence:
  - The `./browser` bundle is 1,081,824 of 1,085,440 bytes, so 3,616 bytes are left for D2 in three flow parts.
  - Naming the part in the D1 message by comparing `band.type === '…'` outside `lib/bands/` trips the band-type-literal ratchet (`test/band-type-literals.test.ts`). Use the band's own `type` string generically.
  - A new exported pure helper (for example a threshold function) needs a test or a line on the `pure-exports` ratchet.
  - Nine tests match on "smallest text". Keep the new message's wording distinct, or check those tests.
- Fix: add these to the U1/U2 acceptance notes.

### m5 (Minor): ADR 0024-style registration and PowerPoint fonts
- Evidence:
  - Registering five candidate sizes in `concentricTexts`, `vennTexts` and `cycleTexts` multiplies the measurement requests by five, so it should happen only when the deck option is set. That keeps documents byte-identical and their measurement unchanged.
  - A label sized to just fit in the measured font may overflow its circle in the .pptx, which is shown in Office's font.
- Fix: register only under the deck option, and fit with a small margin (for example 0.92 of the available width).

### nit 1: wording about the width search and the call path
- "The width search does not help" holds for wider widths (`wideWidths`) too, because R, r and h0 are capped.
- `pptx-deck-edge-core` reaches `smallTextWarning` through `slideIssues` in `lib/pptx/deck.ts`, not directly.

## Recommended changes to the questions

- **Q1**: rewrite it as an absolute effective threshold T for every figure slide: 15.2 (25 of 178), 14.25 (16 of 178) or 14 (15 of 178). Recommend 14 or 14.25 at first, because each warning then points at text that is really small, and lower the noise risk with the M2 counts. Ask the requester for their numbers first, as the ADR already suggests.
- **Q2**: a (warning). No change.
- **Q3**: replace "cap 22px" with an effective target of about 21px on the slide (`floor(21 / k)`, never below 14). Restrict it to the parts and layouts with a real fit test (M5).
- **Q4**: recommend c (defer) and add the "fill tries a shorter height" option (m1).
- **Q5**: a. No change.
- **Q6**: a. Add the entry-point list and the MCP scope note (M6) to U2.

## Verdict

converged: no (Blocker 0 / Major 6 / Minor 5 / nit 1)
