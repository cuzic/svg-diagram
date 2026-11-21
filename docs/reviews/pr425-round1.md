# PR #425 review (Opus, round 1)

Target: feat/spec-finding-paths @ c445da73cc93399802f4bacba6b0492e174e168d (base main @ 44e75344)

## Conclusion

The change is one line (`locateVerdict` passes `f.loc` to `locateMessage`) plus three tests and one ADR sentence. For per-part rules it does what D7 asks. It fills in 2,784 warning paths that main left null over the catalog sweep, and it leaves every other output unchanged. For grouped rules it breaks "narrow, never coarsen". The guess is limited to the **first** part (`loc`), and the parts in `related` are ignored. So when the quoted text that main found sits in a later affected part, a correct field path becomes the bare `parts[i]` of a different part. This happens with catalog examples as they are, in both `renderSpec` and `renderSpecEdge`. One Major.

## Previous round

None.

## How this was checked

- An independent clone, and a worktree of `origin/main` beside it. A probe outside the repo ran `renderSpec` (font measure, `JA_FONTS`) and `renderSpecEdge` (`realEngine()`) in both trees. It compared `ok`, an SVG hash, width/height, `issues`, `problems` and `findings` (message/rule/severity/fix/order, then `path`).
- Sweep A (node + edge, 1,040 specs each): each of the 65 catalog examples alone, doubled (`[p, p]`), paired with its neighbour, and as `[r, p, p]` with a title. Widths: default, 240, 320 and 480.
- Sweep B (node, 12,675 specs): every ordered pair of catalog examples at widths 240, 320 and 480.
- Results: the SVG bytes, size, `issues`, `problems`, warning count, text, rule, severity, fix and order are identical everywhere. The node and edge paths agree. Sweep A has 175 null→path improvements and no other change. Sweep B has 2,784 null→path improvements and **27 changes from a non-null main path**, all listed under M1.
- Deck validation reaches these paths only through `renderSpec`/`renderSpecEdge` per slide (`locateVerdict` has no other caller), so the sweeps cover it.
- Mutations: dropping `f.loc` in `locateVerdict` makes 2 of the new tests fail. Returning the bare stamp `parts[i]` in the narrowing makes 7 tests fail in `spec-source-locations` + `spec`. Both mutations the Issue asks for are caught.
- `gh pr checks 425`: golden, test 1–3 all pass. `gh pr list`: mergeable, CLEAN. #374 also touches `lib/spec.ts`, but only the part table (lines 320–380), so it does not conflict.

## Findings

### M1 (Major): grouped warnings lose a correct field path, or point to the wrong part, because only `loc` is searched and `related` is ignored

`lib/spec.ts:940` passes only `f.loc`. `locateMessage` then searches only that one part and otherwise returns `loc.specPath`. Grouped rules (`fromSources(refs)`: `text-mid-word-break`, `glyph-missing`, `term-*`, `gray-tone-collision`, `graph-disconnected`, `edge-crossings`, …) put the other affected parts in `related`. Their message often quotes text from one of those later parts. `text-mid-word-break` lists the broken words longest first, and they often come from part 2.

Reproduction with catalog examples only, `{version: 1, title: '例', width: 320, parts: [matrix.example, table.example]}`. The output is identical in node and edge:

| | path of `text-mid-word-break` |
| --- | --- |
| main | `parts[1].columns[2].label` (「スタンダード」, which is really broken in the table) |
| PR | `parts[0]` (the matrix: coarser and in a different part) |

Sweep B has 15 such regressions. In each one, rendering main's part alone emits the same warning, so main's field path was right:
matrix+table, fmea+table, isIsNot+table, raci+table, whyWhyTable+table, valueChain+table (w320 → `parts[0]`); matrix+valueChain, fmea+valueChain, raci+valueChain, whyWhyTable+valueChain (w320); fmea/isIsNot/raci/table/whyWhyTable + valueChain (w480). In each, `parts[1].{columns[2]|primary[3]}.label` → `parts[0]`.

The other 12 changes are corrections and are fine: main's field path was in a part that does not emit the warning on its own. They are raci↔tree, raci↔sequence, gantt↔whyWhyTable, rangeBars↔matrix, rangeBars↔whyWhyTable (`text-mid-word-break`) and table↔timeline (`rowheader-tone-collides`: main pointed at the timeline's `deadline.label`).

This breaks D7 ("置き換えず、狭める") and the Issue's acceptance condition ("1 か所にしかない文言はフィールドまでの path のまま"). The Issue's "まとめる規則は最初の部品" was meant as the **fallback** when nothing narrower is found. It was not meant to override a field that one of the affected parts holds.

Suggested fix (checked with a local patch, not committed): for a finding, try the guess in each stamped part of `[f.loc, ...f.related]` in order (`linkOf([part], …, i) ?? locateIn(part, 'parts[i]', …)`). Fall back to `locateMessage(spec, message, f.loc)` only when none of them hits. With that patch, sweep B has 0 regressions, the 12 corrections and all 2,784 improvements stay, and the 80 tests of `spec-source-locations` + `spec` still pass. Add a test: `[matrix, table]` at width 320 (or a smaller hand-made pair) must keep `parts[1].columns[2].label`. Also update the ADR sentence to say "the finding's parts (`loc`, then `related`), and the first part when none names a field".

## Verdict

converged: no (Blocker 0 / Major 1 / Minor 0 / nit 0)
