# PR #507 review (Opus, round 2)

Target: feat/forest-u2 @ e06eb52945f4df2d24a74dd76c53d04c7a8f61fb

## Conclusion
Both round-1 Majors are fixed, and mutations confirm it. The digit rule now follows `decimals` and has tests for decimals 0–3. The ref margin is pinned by exact tick arrays: all 10 branch mutations I tried fail the tests. The per-cell widening is a sound choice, but ADR D4 and the `decimals` description do not say that it can widen the whole cell past `decimals`. Linear values below about 5e-21 still collapse to `0` with `check` clean. Both are Minor.
converged: yes.

## Previous round
- M1: resolved. The threshold is `0.5 * 10 ** -decimals` (`lib/charts-forest.ts:126`), and one digit count is used per cell. Each of these mutations fails 1–3 tests:
  - the fixed `5e-4` threshold
  - `<` changed to `<=`
  - no widening
  - per-value digits
  - 3 significant digits instead of 2
  - `max` changed to `min`
  - the cap lowered from 20 to 6
- M2: resolved. Each of these 10 mutations fails 1 test: the linear lower and upper exact-end checks, linear upper removed, linear lower at 0.5 and at 2 steps, linear upper at 2 steps, the log lower and upper pre-fix code, log `a + 2`, and log `b − 2`. That covers the author's 8 and 2 more.
- m1: resolved, with two exceptions. Ticks and values never use exponent form above the cap, and every minus sign is U+2212 (checked in the texts and the alt). Putting the exponent back into `tickText` fails a test. There is still no floor: see m2 below.
- m2: resolved. `validateSpec` reports weight ≤ 0, a log `low` below 1e-6, a log `ref`, a reversed or too-small `domain`, `valueHeader` with `values: false`, and a duplicate `id`, each at its own field. Removing each of the 7 new `check()` branches fails 1 test.
- m3: resolved. The title says "5 拠点のうち 2 拠点で、区間が 1 を上回った" and the lead names A and D, which matches the figure.
- n1: resolved (`README.md:347`).
- n2: not addressed. It was optional.

## Verified (no finding)
- **Per-cell widening, judged.** At decimals 1, `0 / −0.04 / 1.2` prints `0.000 (−0.040, 1.200)`. I think this is the best of the three options:
  - Per-value would give `0.0 (−0.040, 1.2)`. That mixes precisions inside one cell and breaks D4's "fixed form".
  - Column-wide would turn every other row into `12.300 (3.500, 21.000)` because of one row.
  - Per-cell keeps the estimate and its interval comparable. Here it also keeps the sign of −0.04, which matters on a linear axis with ref 0, where it shows that the interval crosses 0. The old output `0.0 (0.0–1.2)` lost that.
  - The cost is false precision (`1.200`) in that one cell only. That is acceptable, but it must be documented (m1).
- **Alignment.** The column is right-aligned at one x (`c.text(…, g.x + g.w, …, 'end')`, `lib/charts-forest.ts:223`), and its width is the widest cell + 16 (`:163`). Right edges stay aligned. Decimal points were never aligned, because cell lengths already differ between rows, so this is not a regression.
- **Overflow (1e-9 linear, no floor).** I could not make it overflow:
  - Data 1e-9–3e-9 with ref 0 at the default width: the ticks read `0`, `0.000000001`, `0.000000002`, `0.000000003` (thinned, all different). The cell reads `0.0000000020 (0.0000000010–0.0000000030)`. No problems, and everything stays inside 940px.
  - Rows `5 (−1e-9, 10)` and `12.3 (3.5, 21)`: the cell is `5.0000000000 (−0.0000000010, 10.0000000000)`, and it fits.
  - The same rows with `−1e-12` at width 480 throw "the figure is too narrow for its labels and numbers". The same figure without the tiny value fits at 480, so a long cell becomes a clear error, never a silent overflow (see n2 for the message).
- **Weight 0: the schema/check split.** This is acceptable. The schema helper type `JsonSchema` in `lib/spec-kit.ts` has no `exclusiveMinimum`, and `bubble`'s `size` already does the same thing: `AMOUNT` (minimum 0) plus a `check()` that rejects 0, with "more than 0" in the description. An editor accepts 0, but `check`/`validateSpec` reports it at `rows[i].weight` with a message that says what to do, and the description now says "(0 is refused)". I did not test the author's budget claim, because the precedent settles the question.
- **Mutation survivors that are equivalent.** `.replace(/-/g)` → `.replace('-')` in `tickText` and in the value text both survive. Without exponent form, a number has at most one '-', so these mutations change nothing.
- **CI.** On e06eb529 all 5 checks pass (test 1/3, 2/3, 3/3, golden, ooxml-xsd).
- **Other PRs.** No other open PR touches forest files.

## Findings

### m1 (Minor): the per-cell widening is not documented
- Evidence:
  - ADR 0084 D4 (`docs/adr/0084-forest-plot.md:100`) still describes the rule per value: "桁数で 0 になる小さな値 … は、有効数字 2 桁で書く（`0.00040`）".
  - The `decimals` description (`lib/spec-parts/forest.ts:24`, "Digits of the numbers in the right-hand column") says nothing about exceeding `decimals`. Neither does the skill's charts reference.
  - A user who writes `decimals: 1` and sees `1.200` has no way to find out why.
- Fix: in D4, say that one cell uses one digit count, set by its smallest non-zero value (two significant digits), even above `decimals`, and add the `0.000 (−0.040, 1.200)` example. Add the same note to the `decimals` description and run `pnpm schema`.

### m2 (Minor): on a linear axis, values below about 5e-21 still collapse to `0` and `check` stays clean
- Evidence: data 1e-25–3e-25 with `{scale: 'linear', ref: 0}` gives:
  - ticks that read `−0 0 0 0 0 0 0 0`: `tickText` does not strip the sign, so `−5e-26` reads `−0`.
  - the cell `0.00000000000000000000 (0.00000000000000000000–0.00000000000000000000)`.
  - `verdict.problems` is `[]`.
  
  The cap of 20 in `cellDigits` and `tickText` causes this. The input is unrealistic, hence Minor, but this is exactly "a wrong figure that passes `check`", and the author left out a linear floor on purpose.
- Fix: in `resolveForest`, fail when a non-zero linear value is below 1e-15 or so (or when two tick texts are equal). Say what to do in the message: rescale the unit.

### n1 (nit): three rules are no longer pinned
- `noZero` removed: survives. The test "zero itself is not small, and has no sign" uses `low: -0.0`, which is `-0`, and `(-0).toFixed(1)` is already `"0.0"`. The rule is only reachable past the cap now (m2), so the test name claims something it does not check.
- `forestAlt`'s new `.replace('-', MINUS)` on `ref` removed: survives, because no test uses a negative `ref`.
- `tickText`'s `+ 2` changed to `+ 1`: survives. No test has a three-significant-digit tick below 0.001, such as 0.000125.
- Fix: one assertion each, or drop `noZero` if m2's floor makes it unreachable.

### n2 (nit): the "too narrow" error blames the labels when the number column is the cause
At width 480, `5.0000000000000 (−0.0000000000010, 10.0000000000000)` throws "raise width, or shorten the labels". When the value column is the widest part, the advice could name it, for example "or round the values / change the unit".

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 2 / nit 2)
