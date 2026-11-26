# PR #472 review (Opus, round 2)

Target: fix/stamp-too-wide @ ba7e717bf5bbdd8f509fec8eb566b3e5d3c1266d

## Conclusion
All round-1 findings are fixed, and I checked each one by running it. A wrapped stamp now exports to PPTX at the one-line badge size, one line per paragraph, inside its badge. A stamp that does not fit keeps every character and grows its chip one line at a time, inside the frame. An unbreakable word gets a one-line-high chip. The unused-space test tells the fix apart from the round-1 code. What is left is small: a single word wider than its chip still overflows (it is reported), the stamp-too-wide message can read as self-contradictory, and the PPTX badge leaves empty space under its lines.
converged: yes.

## Previous round
- M1 resolved (ran): the round-1 repro, a `row` of two boxes 480 wide with stamps `仮説` and `見本として…`, now gives a wrapped badge of 194x38 px. It has two `<a:t>` lines split by one `<a:br>` at `sz="648"`, the same size as the one-line badge (it was 900 on one line). Its line spacing is 9.07 pt, so two lines take about 24 px of the 38 px badge. A three-line hopeless stamp gives a 180x58 badge with three lines and two `<a:br>`, all at 648. The new pptx test fails if `sizeRect` is dropped, because the badge would then be sized from the 38 px rect (12 → `sz="900"`).
- m1 resolved (ran): `fitStamp` no longer re-joins the lines. For the hopeless text the lines are `これは短くできない非常に` / `長い注意書きの文章であり` / `二行でも収まらない`, and `join('')` gives back the source exactly. The test asserts this.
- m2 resolved for wrappable text (ran): box 200 wide → chip 180x64 inside the frame. Group in a row 212 wide → chip 194x64, and the frame grows to fit it (`ctx.y += fit.h`). The inventory badge uses `stampH`, so the badge rect covers the whole chip. The case of one wide word is still open; see m1 below.
- m3 resolved (ran): `https://example.com/averyveryverylongpathname` in a 160 px box → `stampLines.length 1`, `stampH 24`.
- n1 resolved (read + reasoned): `layout-metrics` is back to main's rule (`STAMP_STRIP` 30 < `UNUSED_MIN_PX` 48, so a stamped frame is never flagged). The new test, a 130 px box with `stampH: 64`, would be flagged under round-1's `stampExtra` code: its free space is up to 70 px, more than 48 px and over 50% of the frame. So the test pins the fix.
- Golden note: ba7e717b changes only the 10 toc-* entries named in round 1 (toc-compact, -core, -crt, -crt-loop, -frt, -hop, -hop-all, -legend, -nbr, -tt), and the commit message says this is main's drift. The `golden (examples/out)` check passes. The `test` shards were still pending when I reviewed.

## Findings
### m1 (Minor): one word wider than its chip still overflows the frame, and here the canvas (reported, not silent)
- Evidence (ran): the URL stamp in a 160 px box at x=20 gives a 144 px chip, but the text is 330 px wide. It is centred at x≈100, so it runs from about x=-65 to x=265, past the frame and off the left edge of the canvas. The PPTX export (`wrap="none"`) overflows the same way. `stamp-too-wide` reports it, so check does not pass silently.
- Fix (optional): when `over.width > maxWidth`, break that word per character, as `wrapStyledAtoms` already does for over-wide phrase units, so the chip grows instead of spilling. Or accept the overflow as reported, as other text does for a long Latin word.

### n1 (nit): the stamp-too-wide message for the 3+-line case can read as self-contradictory
- Evidence (ran): `…枠(幅 200px)に収まらない(折り返すと 3 行で、最長の行は 168px、チップに使えるのは 172px)`. Here the longest line (168 px) fits within the 172 px available. The real problem is the line count, and the stamp is in fact drawn inside the frame.
- Fix: word the two causes differently, for example `2 行に収まらない(3 行になる)` versus `1 語が 330px あり、チップは 132px`.

### n2 (nit): the PPTX wrapped badge is top-anchored with about 12 px per line, so the lower part of a taller badge is empty
- Evidence (ran): the 3-line badge is 58 px high, and its lines take about 36 px from the top (`anchor="t"`). The SVG uses a 20 px pitch that fills the chip. This is cosmetic. The badge text size was already smaller than the SVG's on main.
- Fix: set the PPTX line spacing from the SVG pitch, or anchor the text in the middle.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 1 / nit 2)
