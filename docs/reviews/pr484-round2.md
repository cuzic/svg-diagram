# PR #484 review (Opus, round 2)

Target: feat/venn-detail-and-dialog-position @ 46ef4a3e5a691b69d4822d68bbe36ad40adb5e81

## Conclusion
The venn side is now right. The fit check checks each drawn line on its own, catches every crossing in a 4,000-layout random search, and no longer rejects layouts that fit. Both clauses are pinned by tests, and lint is clean. One Major is left. The M3 fix makes a dialog card that does not fit on its screen **throw**, and that includes the default `center`. Figures that main draws, and that pass `check` on main, now fail to build. Some of them are only a few pixels too tall. The repo's own precedent (PR #472, `stamp-too-wide`) is to draw the figure and report a problem.
converged: no.

## Previous round
- M1 (lint errors): resolved. `pnpm lint` on 46ef4a3e reports 0 errors (26 warnings, the same as main). CI `golden` and `test (2/3)` pass. `test (1/3)` and `test (3/3)` were still pending when this was written; see CI below.
- M2 (the "outside the other circles" clause had no test): resolved. Deleting `&& pos.every((o, j) => j === i || dist(x, yy, o) >= r + 2)` now fails `venn of three: items that stay in their own circle but cut into a neighbour are reported`. The placement test now checks all 4 corners of every line.
- M3 (a card taller than its screen left the screen silently): the hole is closed, but by throwing. That causes a regression, which is reported as M1 below.
- m1 (schema allowed `items: []`): resolved. `sets[].items` has `"minItems": 1` in `schema/spec.schema.json`.
- m2 (a wrapped item was checked as one box): resolved in behaviour. I reran the round-1 search (4,000 layouts, 2 and 3 sets, mixed Japanese and Latin items of 1–24 chars, 1–4 items, widths 300–1300, seed 7). 2,327 sets were flagged, 0 crossings went unflagged, and 0 flagged sets had 4px or more of clearance. In round 1, 147 of 1,342 flagged sets had that much clearance. There is no test for this, see m1.
- m3 (no hanging indent, words split): the indent is resolved. Continuation lines start at `left + width('・')`, and mutating that back to `left` fails the new wrap test. Words are still split, see n1.
- n1 (`label` replaces the title): resolved. The README says so.
- n2 (the 16px edge margin was not pinned): resolved. Changing `x + edge` to `x` for `left` fails the `dialog at` test.

## Findings
### M1 (Major): a dialog card that does not fit now throws, including for the default `center`, so figures that build and pass `check` on main fail to build
- Evidence (ran the same script against origin/main 6b0c6252 and the PR head): `wireframe([wf.text('main')], {h: 140, overlays: [wf.dialog('確認', {body: '長い本文です。'.repeat(6), buttons: [wf.btn('はい')]})]})` at width 640.
  - Main: `checkDiagram` → `ok: true`, and the figure is drawn.
  - PR: `wf.dialog(): the card (380x151px) does not fit inside the screen (594x134px); …`. The card is only 17px too tall.
  - The round-1 repro (`repeat(20)`, 230px tall) behaves the same way: drawn on main, throws on the PR.
  - `svg-diagram check` reports it as `build-error` with no SVG. The message is clear and has no stack.
  - Off-centre positions add a second step change. `at: 'top'` with a one-line body (a 132px card on a 134px screen) throws because of the 16px margin, even though the card would fit on the screen with a smaller margin.

  The throw is at `lib/wireframe-layout-core.ts:778-779`. The only check before it is `room = at === 'center' ? 0 : edge`.

  For a long body, failing the whole build turns a drawn figure with one reportable flaw into no figure at all. This hits every caller (`build`, MCP `render_diagram`, decks) for content that main accepted. PR #472 settled the same question for stamps the other way. A stamp that used to throw is now drawn in full and reported as the `stamp-too-wide` problem (`lib/bands/box.ts:58`, `lib/bands/group.ts:33`), and round 1 of #472 recommended "drawn + problem" over clipping or spilling. The brief for this item asked for the same thing: keep the card inside its screen, and report a problem when it cannot fit.
- Fix:
  1. Keep throwing only for a bad `at`.
  2. For an off-centre `at`, use `min(16, (h - dh) / 2)` as the margin (and the same for width). A card that fits on the screen then never fails because of the margin.
  3. When `dh > h` or `dw > w`, clamp the card to the screen's top-left (`dy = y`, `dx = max(x, …)`) so the title stays visible.
  4. In that case, record the overflow on the laid-out band (as `callouts` are recorded on `WfCtx`), and have the wireframe band's `verify.check` report a `problem` (for example `wf-dialog-too-big`). Use the current message, which already says how to fix it.
  5. Change the README and `skills/svg-diagram/references/wireframe.md` from "throw" to "problem".
  6. Change the new test to assert the problem and the clamped position instead of `rejects`.

### m1 (Minor): nothing pins the per-line box (round-1 m2)
- Evidence: I replaced `boxes.push([x, y, x + lw, y + lh])` with the whole-block width `[left, y, left + listW, y + lh]`. `test/flow-shapes.test.ts` still passes (18/18). The behaviour is correct today: the search above found 0 false positives.
- Fix: add one case that only fits when lines are checked one by one. For example, 3 sets at width 640, with set 甲 holding `とても長い特徴の説明がここに入る` (round 1's example). Assert `misfits` is `undefined`.

### n1 (nit): Japanese items still break mid-word in figures that pass
- Evidence: 2 sets, set A `items: ['拡張しやすい', '保守が楽']`, no misfit. At widths 310–380 it wraps as `・拡張し|やすい`, and at 390–400 as `・拡張しや|すい`. The venn's titles and overlap labels go through the same `t.wrap`, and flow shapes have no `keepWords`, so this is consistent with the rest of the part.
- Fix: none needed for this PR. If it matters later, run the venn's wrap through `keepWords` with the other flow shapes.

## Checked and fine
- Venn search (above): 0 crossings went unflagged, and 0 layouts that fit were rejected. Strict width: each item is now also listed without its bullet in `vennTexts`, so the wrapped lines are measured.
- Mutations: M2's clause, the hanging indent and the 16px margin each fail a test when removed. The per-line box (m1) is the only one that does not.
- Local tests on the PR head: `flow-shapes`, `wireframe`, `spec*`, `schema*` and `exports*` give 322 pass and 0 fail. `pnpm lint` reports 0 errors and `pnpm typecheck` is clean.
- The dialog error goes through `check` as a `build-error` finding with file and line, not a raw stack. `examples/inventory-wireframe.ts` (the only example with a dialog) is unaffected, and golden passes.
- Other open PRs: #480 (README, schema) and #479 (README) touch different sections. Resolve a schema conflict by re-running `pnpm schema`.

## CI
Run 45768907498 on 46ef4a3e: `golden` and `test (2/3)` pass. `test (1/3)` and `test (3/3)` were still pending after about 10 minutes of waiting. They are not judged here.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 1 / nit 1)
