# PR #472 review (Opus, round 1)

Target: fix/stamp-too-wide @ ca8765f7184447e53df69c4c19e8f1223b257fff

## Conclusion
The SVG side works as described: a stamp that fits keeps the 24px chip (byte-identical locally against the base for the
probed examples), a long stamp wraps to two lines inside a taller chip, and a hopeless one is drawn and reported as
`stamp-too-wide` for box, banner, group, a group in a row and a group nested in a group. The PowerPoint export of a wrapped
stamp is wrong, though: the badge is drawn as one unwrapped line at a larger font size, so it overflows its chip.
converged: no (1 Major).

## Previous round
None (round 1).

## Findings
### M1 (Major): a wrapped stamp exports to PPTX as one line at a ~40% larger font size, overflowing its badge
- Evidence (ran): `row([box({title:'a', stamp:'仮説'}), box({title:'b', stamp:'見本として載せている架空の数字です'})])`, width 480, `planSlide(...)`.
  The one-line stamp gets `sz="648"`. The wrapped stamp's badge is 194px x 38px with `sz="900"`, `bodyPr wrap="none"`, `anchor="t"`, and a single
  `<a:t>` holding the whole text. `badgeSize` (lib/pptx/box-decoration.ts:11, `min(12, max(8, h*0.48))`) grows with the taller rect
  (`h: 18 + extra`, line 22). `stampBadge` is given the full `stamp` and never `stampLines`. The SVG chip was sized for 14px regular text on 2 lines,
  so 17 bold 9pt glyphs on one unwrapped line run past the badge's right edge, leaving the lower half empty.
  None of the pptx-golden examples has a wrapped stamp, so the golden cannot catch this.
- Fix: size the font from the one-line badge height (18), not from the grown rect, and write `stampLines` as separate paragraphs (or `<a:br/>`) in the badge.
  Add a pptx test that checks a wrapped stamp's badge holds 2 lines at the one-line size.

### m1 (Minor): in the hopeless case, CJK lines after the first are joined with a space that is drawn
- Evidence (ran): group `stamp: 'これは短くできない…二行でも収まらない'` in a 212px frame → `stampLines[1] = "い注意書きの文章であり二行 でも収まらない"`.
  lib/layout-util.ts:85 `wrapped.slice(1).join(' ')`. The stray space also goes into the `need` width used in the message.
- Fix: join with `''` when the boundary is not whitespace in the source, or (better, see recommendation 2) do not re-join at all.

### m2 (Minor): the spill case can put text outside the frame and the canvas
- Evidence (ran): box in a 240px group, `over.width` 336 vs chip 140. The centred second row extends about 100px past each side of a 168px box,
  over its neighbours and, near the left edge, off the canvas. The inventory `badge` rect (`stampGeometry`) covers only the chip, not the spilled text.
  It is reported (`stamp-too-wide`), so this is not silent, but the figure is worse than it needs to be.
- Fix: see recommendation 2.

### m3 (Minor): a single unbreakable atom (URL, long Latin word) gets a two-line-high chip with one line in it
- Evidence (ran): `stamp: 'https://example.com/averyveryverylongpathname'` in a 160px box → `stampLines.length === 1`, `stampH 44`.
- Fix: `h = STAMP_H + (lines.length - 1) * stampLineH(roles)`.

### n1 (nit): `layout-metrics` unused-space change (`stampExtra`) has no test
The arithmetic looks right (`STAMP_STRIP + stampH - 24`). A wrapped-stamp case in the unused-space test would pin it.

## Note on the pptx-golden run on this branch (10 toc-* hashes changed)
This PR did not cause it. The same 10 toc-* names (toc-compact, -core, -crt, -crt-loop, -frt, -hop, -hop-all, -legend, -nbr, -tt) changed with
**identical new hashes** in the pptx-golden runs on `feat/tree-edge-style` (45607457260) and `feat/tree-tags` (45607586098) on 2026-11-25,
before this branch existed. Those PRs committed only their new mindmap hashes, so main's manifest was already stale for toc-*.
No toc example uses `stamp`. Locally, `planSlide(...).xml` + pictures for `examples/toc-core.ts` are byte-identical between the base (8379af91) and this head.
Committing the regenerated manifest here is harmless, but it belongs to main's drift, not to this change. Say so in the commit message.

## Recommendations on the open questions
1. **Shrinking `note` when a canvas scales it up**: do not add it in this PR. Wrapping already covers the default and only stamps that used to throw take
   the new path. A shrink-before-wrap step (to the 14px floor, as stat values do under ADR 0024) would add a second fitting axis that has no figure
   asking for it yet. Revisit only if a real scaled canvas hits `stamp-too-wide`.
2. **Spill vs clip when two lines do not fit**: neither. Keep every wrapped line and let the chip grow to N lines (`h = STAMP_H + (N-1) * pitch`),
   still reporting `stamp-too-wide` above two lines. Layout already reserves the chip's height, so nothing overlaps. All text stays inside the frame,
   and the stray-space join (m1) and the inventory mismatch (m2) both go away. Clipping hides the author's words, which is the silent loss a check
   problem should prevent. Spilling draws over neighbours.

## Verdict
converged: no (Blocker 0 / Major 1 / Minor 3 / nit 1)
