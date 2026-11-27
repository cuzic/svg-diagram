# PR #500 review (Opus, round 1)

Target: feat/callouts-string-table-flex @ 33833cc79977c07bc8f7a98126ee656d9a3e12e1

## Conclusion
Every deck entry path accepts the string form. `pptx-deck`, `serve` (render thread), `site` and `loadDeck` all go through `readDeckFile`, which now calls `withCalloutObjects`. `validateDeck`/`validateDeckWith` convert before the schema check, and `renderDeckPptxEdgeWith` converts before it draws, so the MCP `render_deck` / `export_deck_pptx` (svg-diagram-mcp-plugin `src/deck.ts`, via `svg-diagram/pptx/deck/edge`) work too once the plugin moves to this version. The table `flex` change is a plain ratio change and is safe. converged: no. One Major: a string whose first separator sits more than 60 characters in is refused with an error on a `label` the author never wrote, and nothing says how to keep the string whole.

## Previous round
- (first round)

## Findings

### M1 (Major): a string callout whose split gives a label over 60 characters is refused at `callouts[j].label`, a field the author never wrote, and the message does not mention the split
- Evidence: I ran `./bin/svg-diagram pptx-deck` on a deck with `callouts: ["<70 kana>：<text>", "x\u0001: y"]`. The output was `✗ slides[0].callouts[0].label: is 71 characters; the limit is 60` and `✗ slides[0].callouts[2].label: contains U+0001 …`, exit 1. `calloutOf` (`lib/deck-spec-core.ts`) always splits at the first `": "`/`"："`, whatever the length of the left side. Full-width `：` needs no space after it, so ordinary Japanese prose with a colon in the middle of a long sentence hits this. The location is wrong in the same way for every string error: `'x'.repeat(301)` and `''` are reported at `callouts[0].text` (the new test asserts this). In the file, `callouts[0]` is a string, so an editor or VS Code locator that resolves the path finds no `.text`/`.label` node. Nothing in the README tells the author to write `{"text": "…"}` to stop the split.
- Fix: in `calloutOf`, fall back to `{text: c}` when the left side would be longer than the label limit (60). Also report errors on a string callout at `callouts[j]`, with a hint such as "written as a string, split at the first ': ' / '：' into label and text; write {"text": …} to keep it whole". Add a test for each.

### m1 (Minor): full-width `：` between digits is split, which silently changes the weight in the middle of a time or ratio
- Evidence: `validateDeck` accepts `"１２：３０に集合"` with no issue, and `calloutOf` turns it into label `"１２："` (plain) + text `"３０に集合"` (bold). The half-width `12:30` is protected because the half-width separator needs a space. The full-width one has no such guard, and a Japanese IME often produces full-width digits and colons. The drawn characters are the same; only the weight changes at the colon, so nothing warns about it.
- Fix: do not split at `：` when the characters on both sides are digits (half- or full-width), and state the rule in the README next to the `12:30` note.

### m2 (Minor): the editor schema allows 360 characters for a string, and the CLI allows 300 for a string with no separator
- Evidence: `schema/deck.schema.json` sets `maxLength: 360` on the string branch (60 + 300). `validateDeck` never sees that branch, because the strings are converted first. So `'x'.repeat(350)` passes in the editor and fails in the CLI with `callouts[0].text: is 350 characters; the limit is 300`.
- Fix: set the string branch to 300, the case with no separator. A split string is then rarely refused by the editor alone. Or say in the description that the limits apply after the split.

### m3 (Minor): the README describes the label imprecisely and leaves out the escape hatch
- Evidence: README line 75 says the label is "コロンまで", but a half-width split keeps the trailing space as well (`"a: b"` gives label `"a: "`). That is intended, because label and text are drawn concatenated (`lib/deck-layout.ts:298`), but the README does not say so. It also does not say that writing the object form keeps a string with a colon whole (see M1). The MCP plugin's `render_deck` description ("a plain label and a bold text") will need a matching line when the plugin bumps its dependency.
- Fix: say "コロン（半角は後ろの空白も）まで". Add "分けたくないときはオブジェクト `{"text": …}` で書く". Note the follow-up for the plugin's tool description.

### n1 (nit): the `oneOf` makes the message for an object callout without `text` worse
- Evidence: `{label: 'x'}` now reports `slides[0].callouts[0]: must have the fields of one of these forms: text`. For an object that is clearly the object form, a plain "is missing the field text" reads better.
- Fix: optional. Pick the object branch by `typeof` before the `oneOf` message.

### n2 (nit): the PPTX assertion does not check the split
- Evidence: `test/deck-callout-string.test.ts` accepts `xml.includes('見本の印：見本の本文') || (…label… && …text…)`. Both branches pass when the string is drawn whole as bold text. Mutation testing still catches a missing conversion (see below), but only because the unconverted string then fails to draw at all.
- Fix: check for two `<a:r>` runs, the label without `b="1"` and the text with it.

## Other checks
- Entry paths: `loadDeck`, `loadDeckSelective` (`pptx-deck`, `site`, `serve`'s render thread) → `readDeckFile` → `withCalloutObjects`; `renderDeck` takes the converted `loaded.deck`; `renderDeckPptxEdgeWith` (full and selective edge) converts after validation. `svg-diagram check` takes no deck file, so it is not an entry path for decks. The MCP plugin's `saving.ts` re-validates a saved deck with `validateDeck`, so saved decks with string callouts load again.
- Mutation: removing the `withCalloutObjects` call from `lib/pptx-deck-edge-core.ts`, or from `lib/deck-file.ts`, makes `loadDeck and the .pptx draw a string callout …` fail. Both were reverted, and nothing was committed.
- Ratchets: `pure-exports` passes (`calloutOf` and `withCalloutObjects` are imported by the new test), and `band-type-literals` passes. `pnpm bundle-size` gives `./browser` 1081824 against a limit of 1085440. `check-package-bundles.ts` passes in CI shard 1.
- Full suite, re-run locally on 33833cc7: 4174 tests, 4153 pass, 13 skipped, 8 fail. All 8 are about the host's fonts, emoji or Chromium (atoms vs Chromium, emoji glyphs, system-font Japanese, the examples' lint/layout budgets), and none touches the changed files. CI run 45940997732 is green on all three shards, plus golden and ooxml-xsd. `pnpm typecheck` and `pnpm lint` pass.
- `flex` up to 12: `layout-table.ts` and `wireframe-layout-core.ts` only divide by the sum. `schema/deck.schema.json` refers to `spec.schema.json#/definitions/parts`, so it picks up the new limit.
- Other open PRs: #497 also touches `README.md` and `schema/spec.schema.json`, and `git merge-tree` against its head is clean. The branch merges cleanly with main.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 3 / nit 2)
