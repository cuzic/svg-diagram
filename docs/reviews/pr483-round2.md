# PR #483 review (Opus, round 2)

Target: fix/compare-row-header-and-cols @ 218532fd7e071ec44a8d66453aca47f1f3b311fa

## Conclusion
The M1 fix works. With the row-header floor, every long single-word row name that main drew still builds, and about 330 cases in my sweep that main rejected now draw too. m2 and n1 are resolved. The m1 fix, however, brings back the M1 regression for column heads. A ruled table now asks every bold column head to fit `colW - 16` with no fallback. Ordinary option names that main drew, such as "Maintainability" or "Infrastructure" in a 6-column compare at width 800 or at the default 960, now throw "the column name … is too long" (M1 below). converged: no.

## Previous round
- M1 (row header floor): resolved. Real-font `checkDiagram` at width 640 with "Telecommunications Infrastructure" and with "Internationalizations": OK with 0 problems. In a layout sweep (widths 360–900, 2–6 columns, compare plus ruled and unruled harvey, real Node fonts), no row-name rejection that main drew comes back. The new test fails when the floor is removed (mutation `Math.max(floorW, …)` → `(floorW, …)`). Deck columns: a long row word now builds at the column width, so the round-1 path where it fell back to document width is gone.
- m1 (ruled column heads padding 8px): applied, but it regresses. See M1 below. The test does not pin it: with the old `colW - 8, colW - 4` restored, all 11 tests still pass, because the probed head "Alpha" is far narrower than the column.
- m2: resolved. With 7 columns and ≤ 6 rows the message suggests transposing. With 7 × 7 it suggests only splitting. The spec `cols` description (and `schema/spec.schema.json`) now says how to fix it. One edge case remains (m2 below).
- n1: resolved. The messages are English, matching the rest of `compare()`.
- Unruled harvey heads keeping `colW - 8 / colW - 4` (author's call): agreed. Unruled tables draw no column rules, so the only neighbour is the next centred head, and that still leaves ≥ 4px between heads. Keep it.

## Findings
### M1 (Major): ruled column heads that main drew at normal widths now throw "the column name … is too long"
- Evidence: `lib/charts-rating-table.ts:44`, `fit(k, colW - 16, colW - 16, …)` for ruled tables. This has the same shape as round-1 M1: a single unbreakable word whose bold width falls between colW−16 and colW−4 used to draw and now fails. Real-font `checkDiagram(diagram({width}).add(compare(rows, cols, …)))` built on main and throws on the PR for these cases:
  - width 800, 6 columns, first column "Maintainability" or "Interoperability", rows `['Cost','Price']` → `the column name "Maintainability" is too long for 102px`
  - width 760, 6 columns, "Maintainability" or "Infrastructure"
  - width 960, 6 columns, "Maintainability" or "Interoperability", rows including "Telecommunications Infrastructure"
  - width 640/680, 4–5 columns, the same words
  
  My e2e sweep (widths 560–960, 3–6 columns, 6 common English option names, 3 row sets) found 30 OK→ERR cases on compare, and the layout sweep found the same for ruled harvey (48). The spec allows option names up to 20 characters, so MCP specs reach this. Deck columns fall back to document width with a warning. No test or CHANGELOG entry says the rejection is intended.
- Fix: keep `colW - 16` as the preferred wrap/limit, but when a head cannot meet it, fall back to the old `colW - 8 / colW - 4` instead of failing. For example, try `fit` at 16 and, if it would fail, call it at the old values. Add a test with a real-length word (bold width between colW−16 and colW−4) that asserts it builds, plus one that asserts an ordinary head gets ≥ 8px. The current "Alpha" probe proves neither.

### m1 (Minor): wider row headers squeeze columns, so some narrow tables with long row names and long heads now fail
- Evidence: this follows from measuring `rowW` in bold (round 1, C1) and from the new floor. Both are correct for the row names, but they take 5–15px from the columns. In the layout sweep, unruled harvey failed in 35 cases that main drew (for example w=800, 7 columns, rows "Interoperability"/"Internationalization", head "Infrastructure" → `too long for 88px`). The unruled head limits are unchanged, so the cause is the narrower `colW`. A few ruled tables now hit "N columns do not fit" (ruled harvey w=600, 4 columns, row "Internationalizations"). Every such case pairs a long row name with a long column word at a narrow width. Fixing M1 with the fallback does not help the unruled ones.
- Fix: acceptable as a trade-off for C1. Mention it in the CHANGELOG ("long row names now take their real bold width; at narrow widths this can leave less room for column heads"). Follow-up optional.

### m2 (Minor): the transpose advice is still wrong when there are more than 12 columns
- Evidence: `lib/charts-compare.ts:24`. `resolveCompare(['a','b','c'], 13 columns, …)` tells the user to transpose, but the transposed table has 13 rows and fails the 12-row limit. Only DSL users reach this, since the spec caps `cols` at 6 and the description is fine.
- Fix: suggest transposing only when `rows.length <= 6 && cols.length <= 12`.

## Checked, no finding
- `atomW` uses `c.wrap(v, 1, bold)`, which splits into unbreakable pieces (whole Latin words, and CJK characters with kinsoku glue). The floor is therefore exactly the width `fit` needs, so `fit(r, rowW-16, rowW-16)` cannot fail for a name the floor covered. The sweep had no row-name failure on the PR where the floor applied.
- When the floor pushes `rowW` past the cap and the columns then do not fit, the error is "N columns do not fit". Main gave the same error for these inputs (for example "Hypertransportabilityness" at width 600), so this is not a regression.
- Tests run locally: `test/charts-compare.test.ts` 11/11, harvey + spec-r2 + spec-r5 12/12. CI: golden passed (no golden change). The test shards were still pending at review time.
- Overlap: #372 (native PPTX tables) still touches `charts-rating-table.ts`/`charts-compare.ts`, and its cell boxes reuse `rowW`/`colW`, so it inherits whatever this PR settles on. #480 and #484 touch only the generated `schema/spec.schema.json` (regenerate on merge).

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 2 / nit 0)
