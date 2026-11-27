# PR #500 review (Opus, round 2)

Target: feat/callouts-string-table-flex @ 7a117146b49f8907c3fee360a4941091e23a2cd8

## Conclusion
The split rules are now right: the 60/61 boundary, digits around `：` followed by a later separator, and the long-label fallback all behave as the README says. The n1 change to the generic validator changes no acceptance, and it changes messages only where it should. converged: no. M1 is only half fixed. The new placement and hint (`callouts[j]` plus the "written as a string" text) reach `validateDeck` on raw input (MCP, edge PPTX). They never reach the file entry paths (`pptx-deck`, `serve`, `site`, `loadDeck`), because `readDeckFile` turns the strings into objects before `validateDeck` sees them. The README now promises the new placement on exactly those paths.

## Previous round
- M1: partly resolved. The split no longer makes a label over 60 characters (ran the boundary cases below). Placement and hint work only through `validateDeck` on the raw deck; the CLI still reports `callouts[j].text` / `.label` with no hint (see M1 below).
- m1: resolved. `１２：３０に集合` and `1：2` stay whole; `１２：３０：x` splits at the second `：`; `第3：x` and `x：3 件` (a digit on one side only) split. The test pins the right-hand check but not the left-hand one (see m2).
- m2: resolved. `schema/deck.schema.json` string branch is `maxLength: 300`, and the new test asserts that it equals the object's `text` limit.
- m3: resolved in wording ("半角は後ろの空白も", the `{"text": …}` escape, the list of cases that are not split, the plugin follow-up). One new sentence is wrong for the CLI (part of M1).
- n1: resolved. `{label: 'x'}` gives `callouts[0].text: is required`. The side effects on other parts are listed in m1.
- n2: resolved. The test now matches two `<a:r>` runs. Mutation: making the label run bold in `lib/deck-layout.ts` `calloutLines` fails `loadDeck and the .pptx draw a string callout …`.

## Findings

### M1 (Major): on `pptx-deck`, `serve`, `site` and `loadDeck`, errors in a string callout are still placed at `callouts[j].text` / `.label`, a field the author never wrote, and they carry no hint
- Evidence: I ran `bin/svg-diagram pptx-deck d.json` on a deck with `callouts: ["x"×301, "   ", "x: " + "y"×301]` and `["ab\u0001: cd"]`. The output was `✗ slides[0].callouts[0].text: is 301 characters; the limit is 300`, `✗ slides[0].callouts[1].text: must not be empty`, `✗ slides[0].callouts[2].text: …` and `✗ slides[1].callouts[0].label: contains U+0001 …`, exit 1. `loadDeck` gives the same strings. `validateDeck` on the same parsed JSON gives `slides[0].callouts[0]: … (it is written as a string, …)`, as intended. The cause is in `lib/deck-file.ts:61`: `resolved = withCalloutObjects(resolved0)`, and `checked` is built from `resolved`. So `stringCalloutIssues` (`lib/deck-spec-core.ts:122`) looks up `slides[i].callouts[j]` in a deck that holds only objects, and it never rewrites anything. The new test calls only `validateDeck`, so nothing covers the file path. README line 75 says the shorthand works on `pptx-deck` / `serve` / `site` and that its errors are reported at `callouts[j]` with the hint, which is false for those three.
- Fix: validate the deck as the author wrote it on the file path. Either build `checked` from `resolved0` (convert after validation, as `renderDeckPptxEdgeWith` does), or let `validateDeck` take the original callouts. Add a `loadDeck` test that asserts the `callouts[j]` path and the hint.

### m1 (Minor): the n1 change also changes the messages for three other parts, and nothing tests or mentions it
- Evidence: I walked `specSchema` and `deckSchema` in memory. The new fallback in `validateOneOf` (`lib/spec-validation.ts:75`) fires only for a `oneOf` with exactly one object branch that has required fields and no `const`. There are four such places: deck `callouts[]`, `decisionLadder.otherwise` (string | object, needs `label`), mindmap `tags[]` at every depth (string | object, needs `text`), and table `rows[]` (array | object, needs `cells`). I then ran a differential fuzz: 19283 variants, made by replacing or deleting every node of every part's catalog example and of a sample deck with `{}`, `{zz:1}`, `[]`, `[{}]`, `3`, `''`, `null`, `true`, `'x'` and `[[]]`. Each variant was run through `validateSpec` / `validateDeck` on the merge base `064997b1` and on this head. There were no throws, and the only accepted-vs-refused flips are the string callouts this PR adds. Apart from the intended callout changes, the outputs differ only at those three fields. For example, `parts[0].rows[0]: must have the fields of one of these forms: cells` becomes `parts[0].rows[0].cells: is required`, and `{zz:1}` now gives two issues (`…cells: is required` and `…zz: is not a known field`) where it gave one. The new form reads better, and no test, golden or doc in the repo quotes the old message (grep). But it is a change to public output for parts outside the PR's subject, and the commit message names only callouts.
- Fix: add one assertion for a non-callout part (for example table `rows: [{}]` → `rows[0].cells: is required`), and say in the PR body that `decisionLadder.otherwise`, mindmap `tags` and table `rows` errors change shape.

### m2 (Minor): two boundaries of the new split rules are not pinned by tests
- Evidence: mutations on a scratch copy, running `test/deck-callout-string.test.ts`:
  - `label.length <= CALLOUT_LABEL_MAX` → `<= CALLOUT_LABEL_MAX + 5`: all 5 tests pass. The test has 60 (splits) and 71 (whole) but no 61.
  - the digit guard reduced to the left side only (`!digit.test(c[m.index - 1])`): all 5 tests pass, because no test has a digit before `：` and none after it (`第3：x` should split).
  - the right side only: fails (good). Removing `stringCalloutIssues`, or dropping the hint from its message: fails (good). Reverting n1: fails (good).
- Fix: add `'あ'.repeat(60) + '：本文'` → whole, and `'第3：説明'` → `{label: '第3：', text: '説明'}`.

### m3 (Minor): the hint's remedy ("to keep it whole, write {"text": …}") fixes none of the errors it is attached to
- Evidence: after the M1 fallback, a split string can no longer fail on label length. So the errors left on a string callout are: text over 300, empty or blank, and a control character. A string with no separator is already whole, so the advice does nothing for it. For the others, the whole string is longer than its text part and still holds the same control character, so `{"text": …}` fails in the same way. I checked each kind by hand (`x`×301, `"   "`, `"x: "+y×301`, `"ab\u0001: cd"`). Every one gets the same hint.
- Fix: keep the first half (how the string was read), and drop the "keep it whole" advice. Or add it only when the string was actually split and the issue is on the label.

## Other checks
- Split edge cases, all as documented: 59×`あ`+`：` (label 60) splits, and 60×`あ`+`：` (61) is whole. 58×`a`+`": "` (60) splits, and 59×`a`+`": "` (61) is whole. Leading spaces are trimmed before the label is measured. `１２：３０` followed by a 60-character part and then `：` is whole, because the later separator would make a label over 60. `：x：y` is whole (an empty left side does not move on to the next separator; this matches the README). An emoji label is measured in UTF-16 units, the same as the validator's `maxLength`.
- The n1 paths point at the missing child (`…rows[0].cells`). That is the convention every other `is required` already follows (`lib/spec-validation.ts:43`).
- Entry paths: `renderDeckPptxEdgeWith` validates the raw input before converting, so the MCP `render_deck` / `export_deck_pptx` get the placement and the hint. `withoutBreaks` keeps slide indices, so `stringCalloutIssues` looks up the right slide. No later stage (layout, PPTX) reports a path inside `callouts[j]` (grep).
- Tests: the deck, spec, schema, mindmap, ladder, table and mcp test files (43 files, 559 tests) pass on a scratch copy of the head. CI run 45942550484: golden, ooxml-xsd, test 2/3 and 3/3 pass, and test 1/3 was still pending at the time of this review.
- Other open PRs: no other open PR touches `lib/spec-validation.ts`, `lib/deck-spec-core.ts` or `lib/deck-file.ts`. GitHub reports the PR as mergeable.
- All mutations were made on a `git archive` copy in a scratch directory. Nothing in the worktree was changed except this file.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 3 / nit 0)
