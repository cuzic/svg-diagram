# PR #423 review (Opus, round 3)

Target: feat/source-locations-u4a @ 2dc4771be532229913bd045a8d15a0fe0ffb6533

## Conclusion

All four round-2 findings are fixed, and I checked each one by its behaviour. The main merge keeps U3b intact, and the emitter refactor does not change any SVG byte. I found nothing new at Blocker, Major or Minor level. The PR has converged.

- **M1:** the map's `provenance` now goes through the same comparison as the SVG freshness check (`matchesBuildProvenance`). Both reproductions now refresh the map: the round-2 `--no-source-line` case and a config edit.
- **m1:** gantt bars and `screens` items now carry the rects that are drawn in the SVG.
- **m2:** the per-kind frame rules and the `source` check now have tests, and each mutation fails a test.
- **n1:** the frame geometry now comes from small helpers that the emitters also call. No regex is involved any more.

## Previous round

- **M1** (`provenance` lacks the config hash and `noSourceLine`): fixed.
  - The SVG check and `locationsCurrent` share `matchesBuildProvenance`, and the map writes the same fields as `<metadata>`.
  - Round-2 reproduction: the map was 940x198. After `--no-source-line` and then `--stale --no-source-line --locations`, it is 940x162 with `noSourceLine: true`.
  - Adding `.svg-diagram.json`, then changing it, then deleting it refreshes the map each time, and `configSha256` follows each change.
- **m1** (gantt and screens rects come from layout): fixed with `ganttBarGeometry` and `primRectGeometry`.
  - Every gantt and screens item map rect in all 191 examples equals a drawn `<rect>`.
  - The only rects that differ are the band-level rects of `gantt` and `screens`, which draw no frame of their own.
- **m2** (untested `drawsFrame` branches and the `source` check): fixed. All six round-2 mutations fail a test (see below).
- **n1** (geometry read back from SVG with a regex): fixed. `frameGeometry` in `emit-boxes.ts` is used by `renderBoxRect`, by the states diamond and by the map.

## Findings

None.

## Checked and fine

- **Merge d385b3c (`--remerge-diff`):** two conflicts, both resolved as the spec says.
  - `check-diagram.ts`:
    - U3b's local `findingLocation`/`issueLocation` are gone.
    - `issueLocation(file, issue, resolve)` now lives in `lib/layout-issues.ts` on top of `findingLocation`. `layoutFinding` and rule findings both use it.
    - Only `textLocation` remains local.
    - Key order and fields match main's `{file, rule, severity, message, …location}`.
  - The ADR status line lists U1, U2a, U2b, U3a, U3b, U4a and U4b, and the review notes from both sides.
- **U3b behaviour against main 0fea527:**
  - `check --format json` and the text output over all examples are byte-identical, and so is stderr.
  - Capture-off `checkDiagram` verdicts (findings and problems) over all examples are identical.
  - `lintDiagram` over every `ruleLocationFixtures()` case is identical.
  - `test/check-layout-locations.test.ts` passes, including the grouped-rule and `contrast-main-baseline` tests.
- **Emitter refactor:** the helpers do the same arithmetic as the inline code they replace.
  - `frameGeometry` is the old `snap4(x)`, `snap4(y)`, `snap4(x+w)-x`, `snap4(h)`.
  - The gantt bar keeps the unsnapped `h`.
  - `primRectGeometry` keeps `Math.max(0, …)` for both rect and pill.
  - I built all examples (207 SVGs) on main and on this PR, with and without `--locations`. All three trees are byte-identical, and stdout matches. The CI golden passes on 2dc4771.
- **SVG `--stale` behaviour:** I ran an 8-step script on main and on this PR and got identical stdout, exit codes and final SVG bytes. The steps were:
  1. Build.
  2. `--stale` (skip).
  3. `--stale --no-source-line` (rebuild).
  4. The same again (skip).
  5. Add a config (rebuild).
  6. The same again (skip).
  7. Edit a local dependency (rebuild).
  8. `--stale --dark` (rebuild).
- **Mutations (each fails at least one test in `test/build-locations.test.ts` plus `test/check-layout-locations.test.ts`, 51 tests):**
  - In `matchesBuildProvenance`, dropping the `noSourceLine`, `configSha256` or `depsSha256` comparison.
  - Dropping `map.source === source`.
  - The gantt bar or the screens frame falling back to the anchor rect.
  - `tree` returning `false`.
  - `cause` ignoring `hex`.
  - `states` ignoring `circle`.
  - `bpmn` drawing every node.
  - `banner` returning `false`.
  - The band rect skipping `frameGeometry`.
- **Screens frame lookup:** `layoutScreen` pushes the frame rect before the content, so `find` hits the frame first. When a screen has `frame: 'none'` there is no drawn frame, and the anchor rect is used. That is acceptable.
- **CI:** golden, test 1/3, 2/3 and 3/3 pass on 2dc4771.

## Conflicts

- **#374 (gantt plan/actual):** this PR conflicts with #374 in `lib/emit-figures.ts` `renderGantt`.
  - #374 must keep `ganttBarGeometry` for its bars, including the new `plan` bars.
  - Whether actual bars get map entries is #374's decision.
- **#413, #372, #373:** no conflicts.

## Verdict

converged: yes (Blocker 0 / Major 0 / Minor 0 / nit 0)
