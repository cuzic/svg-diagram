# PR #473 review (Opus, round 3)

Target: feat/comic-chat @ a86adedfdfbe83edcfe81b2c1f0ccb5be6f3b808

## Conclusion
Every round-2 finding is fixed, and the fixes hold when checked by behaviour on the real measuring path, in `renderDeck`, and by mutation: B1, M1 and M2 each have a test that fails when the fix is reverted. A grid of 180 normal chats gives zero problems. The examples render through `renderDeck` with no errors, including with #475 merged on top (problems become deck errors there), so #475 will not reject normal chats. Its errors for real chat problems name the rule and say how to fix it. What remains is two small items: a doc line and a code-point split. converged: yes.

## Previous round
- B1 resolved: `chat-name-wide` is a problem for long names in kana, Latin (spaced and unspaced) and mixed scripts at fontSize 28 (469–556px against 400px of room). It stays silent at 18, where the names fit, and also for a 35-character Latin name that fits at 28. `check --explain chat-name-wide` works. Reverting the name measure in `chatMeasure` fails `test/chat-deck.test.ts`.
- M1 resolved: the URL message passes `checkDiagram` and `renderDiagram` with the real font measurer (`budget: 'cacheOnly'`). A URL with an emoji ZWJ sequence and a combining accent also builds. Reverting the per-character measure fails 3 of 4 tests in `test/chat-deck.test.ts`.
- M2 resolved: the placeholder has no `dominant-baseline`, so a chat with `input` goes through `renderDeck`. Putting `dominant-baseline="central"` back fails 2 tests.
- m1 resolved: the three `chat-*` rules are in `RULE_DOCS`, `RULE_LOCATION` and `schema/config.schema.json`, and `--explain` finds them. `chat-input-wide` is gone. That is safe because `chat()` caps `input` at 20 characters, and 20 full-width characters at 16px (320px) fit the 392px the box leaves at its narrowest.
- m2 resolved, as documentation (an ADR open question plus the `references/comic.md` and README lines). Accepted.
- m3 resolved: the band's left edge is snapped (`snap4(x + …)`), so `canvas: 'slide'` with width 800 and fontSize 24 no longer gives `coordinate-grid`. Only the documented `slide-min-text` warning is left.
- m4 resolved: `examples/out/pptx-golden.json` has `chat-draft`, `chat-sheet` and `comic-row`.
- n1 resolved: `String(opts.width)`.

## Findings

### m1 (Minor): the slide note names the wrong smallest text: with `input`, `slide-min-text` reports 16px (the fixed placeholder), not the name size
- Evidence (ran): `canvas: 'slide'`, width 800, fontSize 24, `input: '指示を入力'` gives `[slide-min-text] 最小の文字が 16px`. `INPUT_FONT = 16` does not scale with `fontSize`. `references/comic.md` and the README say the names and the blank prompts (14/18 × fontSize, at most 21.8px) are why the warning appears.
- Fix: add "and the message box text (fixed 16px)" to that sentence. Optionally scale `INPUT_FONT` with `fontSize`.

### n1 (nit): a word wider than the column is split per code point (`for (const ch of a)` in `templateAtoms` and `chatMeasure`), not per grapheme
- Evidence (read and ran): an emoji ZWJ sequence or a base letter with a combining mark inside an over-long word can be broken in the middle of a cluster. The build does not fail (both passes split the same way), so the only possible effect is a rare odd line break.
- Fix: none needed now. If it matters later, split with `Intl.Segmenter` in both places.

## #475 interaction (checked)
- Merged #475's head into a throwaway worktree of this head. The one conflict, in `lib/comic/layout.ts`, is easy to resolve: take #475's `prep`/`reserveAt` and keep this PR's `slotInfo(dlg, sid)` helper. With that resolution:
  - `chat-band` and `chat-deck` pass (26/26).
  - The 180-case grid (widths 480/640/800/880, fontSizes 14/18/22/24/28, 1, 4 or 10 messages with a URL, a blank and a `\n\n`, with no input, a Japanese input or a Latin input) gives 0 problems.
  - `renderDeck` of `chat-draft` and `chat-sheet` as figures, and of `chat-draft` in a two-column slide, gives no errors and no warnings.
- A chat with real problems (`cast` without `me`, and a 24-character name at fontSize 28) gives two deck errors. Each names the rule (`[chat-self-missing]`, `[chat-name-wide]`) and says how to fix it.
- Whichever of #473 and #475 merges second has to resolve the `lib/comic/layout.ts` conflict as above.

## Checked
- Targeted tests: `node --test test/chat-band.test.ts test/chat-deck.test.ts test/rule-locations.test.ts test/comic-*.test.ts` gives 256/256 passing.
- CI at review time: golden passes, and the test shards are pending.
- No lockfile change since round 2.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 1 / nit 1)
