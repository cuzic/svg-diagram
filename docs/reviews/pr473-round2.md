# PR #473 review (Opus, round 2)

Target: feat/comic-chat @ ac097bfa754dd36bf9e995cf90e51042cba8b923

## Conclusion
B1, m1, m2, n1 and n2 are fixed and the merge of #471 is clean: comic behaviour is unchanged (183 chat/comic tests pass, comic and chat goldens rebuild byte-identical, CI golden green). Used in a real deck, the chat still fails in three ways. A long speaker name is drawn outside the chat frame and cut off by the slide, and `check` and `renderDeck` say nothing. The M1 fix makes any message with a long URL fail to build ("width was not measured"). A chat with the message box (`input`, used by `examples/chat-draft.ts`) is refused by `renderDeck`. converged: no.

## Previous round
- B1 resolved: two unscoped chat bands in one diagram (`check` clean, build OK) give distinct ids `av-71_31-*` / `av-71_32-*`, with no duplicate ids in the SVG.
- M1 **not resolved**: the layout no longer overflows in the unit test, but a real build of the same input throws (see M1 below). The test passes only because its `widthOf` helper measures anything.
- m1 resolved: `cast: {user, ai}` with no `self` gives `[chat-self-missing]` as a problem. `check` exits 1 and the message says how to fix it. (It is a finding, not a throw; that is fine.)
- m2 resolved: the `comic-bubble-wide`, `comic-orphan-line` and `comic-follower-split` docs now name both bands.
- m3 **not resolved**: `examples/out/pptx-golden.json` still has no `chat-*` entries (nor `comic-row`, from main).
- m4 resolved: one `reserveDialogue(parts, maxOf, atomWidth, font, {cap, shrink, breakAt})` and `slotSvg` in `slot-svg.ts` with `font`. The remerge-diff of `lib/comic/{reserve,emit,layout}.ts` keeps #471's code and only adds `breakAt` (default `Infinity`, so comic is unchanged). The comic tests pass and `check --drift --rebuild` reports `comic-{column,faces,grid,row}` up to date. The ADR now states that chat has no orphan re-widening (because `cap` is set).
- n1 resolved: the error is `the line id "day" is also a blank id …; rename the line or the blank`.
- n2 resolved: a test, plus one line in `references/comic.md`.

## Findings

### B1 (Blocker): a long speaker name is drawn past the chat frame; `check` passes, and in a deck it is cut off with no warning
- Evidence: `cast.ai.name = 'カスタマーサポート担当の生成AIアシスタント試験版'` (24 characters), `chat(…, {fontSize: 28})` in `diagram({width: 520})`. `svg-diagram check` gives ✓ with exit 0. `renderDeck` gives `errors: []` and `warnings: []`. The slide (rendered with Chromium) shows the name running past the frame's right edge, cut off at "…アシスタン". Only `build`'s strict lint catches it ("overflows container by 112.5px", canvas dx=89). The name is `met.slotFont` = 14 × fontSize / 18, placed at `bubbleLeft` (`lib/chat/layout.ts`, the `texts.push({… text: member.name})` line), and nothing measures it. With `fontSize` (new in this round) a name of about 21 or more characters at 24px, or about 19 or more at 28px, overflows a 480 band.
- Fix: measure the name (add it to `chatMeasure`). When it is wider than `right - bubbleLeft`, report a problem finding (for example `chat-name-wide`, saying to shorten the name or widen the band); alternatively, ellipsize it and report advice. Add a test at fontSize 28.

### M1 (Major): a word wider than the column (a URL) now fails every real build: "width was not measured for "h""
- Evidence: the round-1 instruction with `参考資料は https://example.com/very/long/path/to/the/meeting-minutes-2026-11-25-final-version.pdf にあります。` fails in `svg-diagram check`, in `build` and in `renderDeck`. All three report `svg-diagram: expected renderBands: width was not measured for "h", got undefined`, at width 480 and 800 and fontSize 18 and 24. `templateAtoms` splits the word into single characters when it is wider than `breakAt` (`lib/comic/reserve.ts`), but the first pass (`lib/chat/measure.ts` `chatMeasure`) measures only the whole atoms, so the per-character widths are missing on the cached-measure path. The message does not say what to change. `test/chat-band.test.ts` "a word wider than the column is broken per character" passes only because `test/helpers/comic-values.ts` `widthOf` measures on demand.
- Fix: in `chatMeasure`, also emit each grapheme of every non-full-width atom (or of each atom wider than the column could be). Add a test that runs the URL message through `renderBands` / the CLI path with the strict, cached measure (as `check` does), not the helper `widthOf`.

### M2 (Major): a chat with the message box cannot go in a deck: `renderDeck` refuses it with a message that does not name the box
- Evidence: the same figure with `input: '指示を入力'` gives `slides[0]: text drawn with dominant-baseline cannot be outlined, so the slide would lose it: take it out of the figure`. Without `input` the figure renders cleanly at 480 and 800 with fontSize 18 and 24. The cause is `lib/chat/emit.ts:67`: the placeholder `<text … dominant-baseline="central">`. `examples/chat-draft.ts` (the PR's own "paste an instruction" example) has `input`, so it cannot be shown in `serve` or a deck. The PR body and the ADR present the box as part of that slide.
- Fix: draw the placeholder with a computed baseline `y` (as the bubble runs do, `met.baseline`), with no `dominant-baseline`. Add a test that runs a chat with `input` through `renderDeck` (or `checkSlideSvg`).

### m1 (Minor): the `chat-*` rules are not registered: `check --explain chat-self-missing` says the rule does not exist
- Evidence: `chat-self-missing`, `chat-speaker-unknown` and `chat-input-wide` appear only in `lib/types/comic.ts` and `lib/chat/layout.ts`. They are not in `lib/rules.ts` or `schema/config.schema.json`, while the `comic-*` rules are. `svg-diagram check --explain chat-self-missing` → `✗ ルール "chat-self-missing" はない`.
- Fix: add docs for the three rules in `comicRuleDocs` (or a chat equivalent) so `rules.ts`, `--rules`, `--explain` and the schema list them.

### m2 (Minor): the deck's small-text warning cannot see chat text, so a larger `fontSize` silently gives smaller text on the slide
- Evidence: `figureMinPt(laidOut)` is `null` for a chat (and for comic), because `lib/pptx/bands.ts` maps `chat: 'image'`, so `smallTextWarning` never fires. With a long instruction and a long draft on one slide: at width 480 and fontSize 18 the figure is scaled to about 66% (text about 12px on the 1280×720 slide); at width 480 and fontSize 24 it is 1464px tall and scaled to about 40% (text about 9.5px, names about 7px). `renderDeck` gives no warning in either case. On `canvas: 'slide'` the same figure does get `slide-min-text` and `slide-canvas-overflow`, so the gap is only in the deck path. The comic band shares this gap.
- Fix: give image bands a smallest text size (for chat: `min(slotFont, font, INPUT_FONT)`) that `figureMinPt` can use, or document that for a deck the user must use `canvas: 'slide'` and run `check`. Note this for the comic fix branch too.

### m3 (Minor): on `canvas: 'slide'` the chat cannot meet the slide rules: the band is off the 4px grid, and the name text is always under 24px
- Evidence: `canvas: 'slide'` puts the band at `x=402` (`bx = x + snap4(…)`, but `x` itself is not on the grid). Lint: `[coordinate-grid] only 67% (fontSize 18) / 56% (fontSize 24) of 18 shape coordinates are on a 4px grid`. `slide-min-text` reports 19px at fontSize 24. Names and blank prompts are 14 × fontSize / 18, at most 21.8px. Comic avoids the prompt limit with `numbering: false` and `blank: 'line'`, but chat has no way to drop the names.
- Fix: snap the band's left edge to the grid (as #471 did for comic rows). Then either let the name grow to 24px when `fontSize` ≥ 24, or say in ADR 0074 U5 and `references/comic.md` that a chat on `canvas: 'slide'` needs `accept: {'slide-min-text': …}`.

### m4 (Minor, carried over): `examples/out/pptx-golden.json` has no entries for `chat-draft` or `chat-sheet`
- Evidence and fix: as in round 1, m3 (run `pptx-golden.yml` with `update=true` on the branch).

### n1 (nit): `chat(…, {width: NaN})` reports `got null`
- Evidence: `chat(): width is a whole number from 480 to 880 in steps of 4 (got null)`.
- Fix: print the value with `String(v)`.

## Deck use (checked this round)
- Built a deck with `loadDeck` + `renderDeck` (serve path): a slide with the chat as the figure, and a two-column slide with the chat beside text. Content: a pasted instruction (3 paragraphs, a blank, `\n\n`) and a 14-paragraph AI draft. Sizes: width 480 and 800, fontSize 18 and 24. Rendered the slides with Chromium.
- Without the URL (M1) and the box (M2), every slide renders. No bubble, tail, face or blank leaves the frame. The layout probe at widths 480/800/880 and fontSizes 14–28, with a 9-character blank, a URL and a 20-character input, gave 0 bubbles or texts outside the band and 0 blanks past their bubble. The only out-of-frame text found is the name (B1).
- Width 800 at fontSize 18 suits a slide best (716px tall, scaled to about 78%). fontSize 24 at width 480 is counter-productive on a slide (see m2).

## Checked
- Merge `ac097bfa` (`git show --remerge-diff`): the conflict hunks in `lib/comic/{reserve,emit,layout}.ts` take #471's side plus `breakAt`. The README and ADR hunks keep both texts. No open PR touches `lib/chat`, `lib/comic`, the deck code or the rules (`gh pr list`).
- Targeted tests: `node --test test/chat-band.test.ts test/comic-*.test.ts` gives 183/183 passing. `check --drift --rebuild` on `examples/{comic,chat}*.ts` reports all up to date. CI: golden, test 2/3 and test 3/3 green; test 1/3 was still pending at review time.
- Option validation: `width` 476, 884, 482 and NaN throw; `fontSize` 13, 29 and 15.5 throw; 17 is accepted.

## Verdict
converged: no (Blocker 1 / Major 2 / Minor 4 / nit 1)
