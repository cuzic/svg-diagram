# PR #473 review (Opus, round 1)

Target: feat/comic-chat @ e189fbf20f01c1af5e0fa5d0fe7795a102732655

## Conclusion
The band follows ADR 0074 D7 and ADR 0080 well: the blanks are shared with `comic` (same size, same drawing, values never move the layout), the selective entry `svg-diagram/bands/chat` keeps comic's layout/emit out, and the existing comic golden is unchanged (golden CI green). Two inputs still draw a wrong figure while `check` passes: two chat bands in one SVG lose the second face (duplicate clip ids), and a word wider than the column (a URL in a pasted instruction, the deck use case) pushes the bubble out of the chat frame, contrary to the U5 completion criterion. converged: no.

## Previous round
None (round 1).

## Findings

### B1 (Blocker): two chat bands in one diagram share the avatar ids, so the second face is drawn blank and check/build/lint all pass
- Evidence: `lib/chat/emit.ts` `avatarSvg` uses `prefix = av-${namespace}${index}` where `index` is the avatar's index within its own band and `namespace` is empty without a scope. Ran a diagram with two unscoped `chat()` bands (distinct message ids `a1`, `b1`): `svg-diagram check` = clean, build OK, and the SVG has duplicate `id="av-0-c"`, `av-0-body`, `av-0-sil`. Rendered with Chromium: the second band's avatar is an empty circle (it is clipped by the first band's `<clipPath>`). The same prefix goes to `characterSvg` for asset faces. `comic` does not have this because its ids carry the panel id, which is a unique anchor.
- Fix: build the prefix from the message id (a unique anchor; hex-encode it as the scope already is), e.g. `av-${namespace}${hex(a.id)}`, and add a test with two unscoped chats asserting unique ids.

### M1 (Major): a word wider than the column makes the bubble wider than the column and the frame; only advice, and the test asserts this
- Evidence: a `self` message `…参考資料は https://example.com/very/long/path/to/the/meeting-minutes-2026-11-25-final-version.pdf にあります。` gives a 788px bubble in the 480px band: it starts 324px left of the chat frame (right-aligned bubble), see `check`: only `[comic-bubble-wide]` (warn), exit 0; build lint: "overflows container by 316px". `reserveAtoms(..., cap)` caps the wrap width but an atom wider than `cap` stays on one line (`lib/comic/reserve.ts`, `lib/chat/layout.ts:68-69`). This breaks the U5 completion criterion ("吹き出しの幅が…(列の幅まで)を超えない"). `test/chat-band.test.ts` "a word wider than the column cannot be wrapped" asserts the overflow as the intended behaviour. URLs, file paths and long identifiers are normal in the "paste an instruction, get a draft" slide.
- Fix: in `chat` only, split a non-blank atom wider than `INNER_CAP` by grapheme (char mode) before wrapping, so every bubble is at most the column; keep `comic-bubble-wide` for what still cannot fit (a blank cluster, which cannot exceed 198px with `SLOT_MAX` 9) and change the test to assert the bubble stays inside the column.

### m1 (Minor): when `self` is omitted and the cast has no `me`, every message goes on the left with no finding
- Evidence: `layoutChat` uses `band.self ?? 'me'`; `chat()` only validates an explicit `self`. A worksheet with `cast: {user, ai}` silently draws a one-sided chat.
- Fix: in `chat()`, when `self` is omitted, the cast is non-empty and has no `me`, throw "cast has no 'me'; pass {self: '<cast key>'}" (the narration-only `cast: {}` case keeps working).

### m2 (Minor): `check --explain comic-bubble-wide` describes the comic threshold, not the chat one
- Evidence: `lib/comic/findings.ts` doc: "マンガ(comic)のふきだしの文が、全角 11 字(内側 198px)より広い". In chat the finding fires at the 400px column. The orphan/follower docs also say only "マンガ(comic)".
- Fix: make the three docs band-neutral ("マンガ・チャットのふきだし…", with the chat threshold), keeping the rule names (see Q4).

### m3 (Minor): `examples/out/pptx-golden.json` is not updated for the two new examples
- Evidence: PR body says the manual `pptx-golden` workflow must be run; the file has no `chat` entries.
- Fix: run `gh workflow run pptx-golden.yml --ref feat/comic-chat -f update=true` and commit the manifest before merging.

### m4 (Minor): conflicts with PR #471 (comic row layouts / `fontSize`) are textual and semantic
- Evidence: trial merge of `origin/feat/comic-row-layouts` into this head conflicts in `lib/comic/reserve.ts`, `lib/comic/emit.ts`, `lib/comic/layout.ts` (2 hunks), `docs/adr/0074-comic-worksheet-parts.md`, `README.md`. Semantically both PRs re-parameterise the same functions differently: #471 `templateAtoms(..., font)` / `reserveAtoms(atoms, font, {cap, shrink})` and an in-file `slotSvg(..., font)` using `metricsOf(font)`; #473 `templateAtoms(..., innerMax)` / `reserveAtoms(atoms, innerMax, cap)` and moves `slotSvg` to `slot-svg.ts`. With #471's `fontSize`, a blank is `max × font` wide, so the D7 promise "the same blank is the same size in comic and chat" (and the test `a blank is the same size in the chat as in the comic`) only holds for comic at the default 18px.
- Fix: whichever merges second unifies to one options object (`{font, innerMax, cap, shrink}`; #471's `shrink` is chat's "bubble as wide as its widest line"), keeps `slotSvg` in `slot-svg.ts` with the `font` argument, and states in ADR 0074 that chat uses the 18px metrics (a comic with `fontSize` has differently-sized blanks).

### n1 (nit): a message id equal to a blank id throws a generic duplicate-anchor error
- Evidence: list input `{id: 'day', tpl: '{day}です'}` → `duplicate anchor id "day": a chat message or blank takes an id that another anchor already has`. It does not say to rename the message or the blank. (Worksheet input cannot hit this: message ids contain `.`.)
- Fix: check in `sheetOf` for list input and throw "message id "day" is also a blank id; rename one".

### n2 (nit): `\n` in `tpl` works as a hard line break (and `\n\n` as an empty line) but is not tested or documented
- Evidence: probe: `'次の文を要約してください。\n\n本文：…'` → lines `["次の文を要約してください。", "", "本文：会議は午後三時に", "始まりました。"]`, no `\n` in the `<text>` runs. This is what a pasted multi-paragraph instruction needs.
- Fix: one test and one line in `references/comic.md`.

## Deck use (chat screen as a 16:9 slide figure)
- Short exchanges fit: `examples/out/chat-draft.svg` is 520×500 and fits the 1280×720 slide's figure area at about 1:1.
- Long messages wrap correctly for Japanese (bunsetsu, left-aligned, bubble as wide as its longest line), except M1 (URLs, paths, long ASCII words).
- The band is fixed at 480px wide with a 280px wrap width (about 15 full-width characters per line). A long pasted instruction plus a long draft becomes a tall portrait figure: 2 long messages were 548px tall; 300+ characters of draft go past 720px and the deck scales the whole figure (and the text) down, while more than half the slide width stays empty. Recommendation: follow-up option `width` (for example 480 to 880) that scales the column and keeps the D7 rule "wrap at 70% of the column"; at 800px the inner width is about 500px (about 28 characters per line), roughly halving the height.
- The message box shows only a grey placeholder. For "the user pastes an instruction" a later option for typed text in the box (ink colour) would help; not needed for v1.

## Open questions (recommendations)
1. `self` as a band option, default `'me'`: agree (it is a view choice, not data). Add the m1 guard.
2. Bubble width = longest wrapped line, left-aligned text: agree; that is how chat apps look and it reads better than comic's fixed inner width. Keep comic unchanged.
3. Column 400 / band 480 / face 40 fixed: fine as the v1 default; record them in ADR 0074 D7 as the default and plan the `width` option above for slides.
4. Reuse comic rule names (`comic-orphan-line` etc.): agree, do not add `chat-*` duplicates (rules, schema, fixtures). Fix the wording of the docs (m2) so `--explain` is correct for both bands.
5. Message id = blank id throws (same as comic): acceptable; improve the message (n1).
6. No spec JSON part, `input` 20 characters / one line, expression always `neutral`: agree for this PR; add chat to the spec together with comic in U4. `chat-input-wide` is nearly unreachable at 20 characters (20 em × 16px = 320px < 392px), so keep it only as a guard for wide Latin text. A per-message `expression` can come later.

## Checked
- ADR 0074 D2: blanks are `max × 1 em`, shared `reserveDialogue`, `fit2q` glue, values never move geometry (`renderChat` tests; ran `test/chat-band.test.ts`: 14/14 pass). D7: right/left, face + name on the first message of a run, small one-sided tail, no time/read marks, `separators` only between panels, 70% wrap rule with the column cap (except M1). U5 notes match the code.
- ADR 0080: band definition in `lib/bands/chat.ts`, `./bands/chat` export, `FULL_DEFINITIONS`, selective equality test, bundle case with comic layout/emit/render excluded and a budget (CI test 2/3, 3/3 and golden green; test 1/3 still running at review time).
- Comic golden unchanged (golden job green); comic default wrap unchanged (`innerMax = INNER_MAX`, `cap = Infinity`).

## Verdict
converged: no (Blocker 1 / Major 1 / Minor 4 / nit 2)
