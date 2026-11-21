# PR #423 review (Opus, round 2)

Target: feat/source-locations-u4a @ 7301ee599c3ab19e37ac6ea45527394cb2447eb3

## Conclusion

All six round-1 findings are fixed, and I checked each fix by behaviour.

- Both M1 reproductions now refresh the map.
- Box, group, banner and node frames in all 191 examples equal the drawn `<rect>` exactly.
- `loc.file` and `source` resolve from the map's directory.
- `final` matches what the main SVG draws.
- Without the flag, SVG bytes, stdout, stderr and exit codes are the same as main.

One Major is left, and it is the round-1 M1 gap in a smaller form. The map's `provenance` records only source, deps and tool. The SVG's freshness check also uses `configSha256` and `noSourceLine`, and both feed layout. So `--stale` can still keep a map that no longer matches the SVG it says is current (M1). The other findings are two item kinds whose map rects are still layout rects (m1), and some per-kind branches no test covers (m2).

## Previous round

- M1 (`--stale` keeps a stale map): fixed for source, deps, tool and `issues`. Both reproductions pass. A residual gap remains for config and `--no-source-line` (new M1).
- m1 (unsnapped rects): fixed for box, group, banner and framed tree, cause, states, bpmn, fta, classes, bowtie and cloud nodes. These match the SVG exactly. Gantt bars and screens items are not covered (new m1).
- m2 (untested branches): fixed. All six round-1 mutations now fail a test, including the new `build` capture probe.
- m3 (path base, hidden parts): fixed. Paths are relative to the map's directory, and `final: false` is documented and correct.
- n1 (internal pseudo-parts): fixed with `generated: true`. The labels are unchanged, which the spec allows.
- n2 (wrong "old SVG" warning): fixed and tested.

## Findings

### M1 (Major): `provenance` omits the config hash and `noSourceLine`, so `--stale` still keeps maps that do not match the SVG

- **Location:** `build-diagram.ts:193` (`provenance = {sourceSha256, depsSha256, tool}`), `locationsCurrent` (`build-diagram.ts:129-136`), compared with the SVG check at `build-diagram.ts:199`.
- **What happens:**
  - The SVG counts as current only when `configSha256` and `noSourceLine` also match.
  - The map counts as current when source, deps and tool match.
  - `--no-source-line` drops the source-line band. `.svg-diagram.json` sets `wrap`, `measure`, `fonts` and `legend`, all of which feed layout (`lib/config.ts:97`, `lib/layout.ts:47`).
- **Reproduction:**
  - A figure with `diagram({sourceLine: '出典: テスト'})`. Run `build h.ts --locations h.json`: the map is 940x129.
  - Run `build --no-source-line h.ts`. The SVG is now 940x93.
  - Run `build --stale --no-source-line h.ts --locations h.json`. It prints `最新（スキップ）` and exits 0, but the map is still 940x129, and every rect below the removed band is off.
  - A config edit follows the same path by analysis: SVG rebuilt without `--locations`, then `--stale --locations`.
- **Why Major:** it is the same failure mode as round-1 M1, a silently wrong map under `--stale` for correct input, triggered by inputs that the SVG's own staleness check already covers. The spec's field list followed my round-1 wording only partly. Its intent ("SVG の `<metadata>` と同じ値の作り方を使う") covers these two inputs.
- **Fix:**
  - Add `configSha256` (when there is a config) and `noSourceLine` to `provenance`, exactly as `d.source` writes them, and compare them in `locationsCurrent`. Simplest is to compare against the same fields as the SVG check on line 199.
  - Extend the README sentence on `provenance`.
  - Add a test: `--no-source-line` (or a config change) between a `--locations` build and a `--stale --locations` build.

### m1 (Minor): gantt bars and `screens` items still carry layout rects, not the drawn rects

- **Location:** `lib/locations-map.ts` `drawsFrame` (the `default: return false` branch).
- **What happens:** I compared every map entry against the SVG `<rect>` elements in all 191 examples. Every framed box, group, banner and node matches exactly. Everything that does not match is either:
  - a container that draws no frame (band-level `tree`/`cause`/`states`/`bpmn`, `frame: false`, frameless icon cards);
  - a non-rect shape (hexes, circles, diamonds, events, gateways);
  - a part with `final: false`.

  The exceptions are two item kinds whose drawn rects the emitter snaps:
  - `examples/gantt.ts`: `req` is `{x: 128, y: 103, w: 130.48, h: 18}` in the map and drawn as `x="128" y="104" width="132" height="18"`.
  - `examples/inventory-component-spec.ts` screens: `{x: 144, y: 833.2, w: 145.6, h: 117}` in the map and drawn as `x="144" y="832" width="144" height="120"`.
- **Why Minor:** at most 3px, so hit-testing is unaffected. README scopes the snap promise to "箱やグループの枠", which is accurate. The spec's rule ("地図の `rect` は描いた四角") is broader.
- **Fix:** Either snap these items the way their emitter does (gantt and screens items in `lib/emit-handlers.ts`), or keep README's narrower wording and say in D6 that item rects of other kinds are layout rects.

### m2 (Minor): the per-kind branches of `drawsFrame` and the `source` check in `locationsCurrent` are untested

Each of these mutations passes `test/build-locations.test.ts` plus `test/check-layout-locations.test.ts` (32/32):

- `case 'tree'` set to `return false`.
- `cause` ignoring `hex`.
- `states` ignoring `circle`.
- `bpmn` drawing every node.
- `banner` set to `return false`.
- `map?.source === source` removed from `locationsCurrent`. A map moved or copied next to another source would then be accepted.

The 191-example comparison shows the current code is right, but nothing keeps it right.

- **Fix:**
  - Add a test that builds a few examples (e.g. a mindmap, `toc-crt`, `qc-arrow`, `bpmn`, a banner) and asserts that every map rect of a framed kind is one of the SVG's `<rect>` boxes, as `svgFrames` already does for `slide-canvas`.
  - Add a `--stale` case where the map's `source` differs.

### n1 (nit): `drawnFrame` gets the geometry by rendering an SVG string and parsing it with a regex

- **Location:** `lib/locations-map.ts` `drawnFrame`.
- It works: the geometry is independent of tone and style, and it uses the emitter's own function, as the spec asked. A small exported `frameGeometry(rect)` in `emit-boxes.ts`, used by both `renderBoxRect` and the map, would say the same thing without depending on attribute order.

## Checked and fine

- **Merge 7301ee5:** the only remerge conflict is the ADR 0072 status line. The resolution keeps U1, U2a, U2b, U3a, U4a and U4b, and both PR #422 and PR #423 review notes. Nothing else changed in the merge.
- **Provenance values:** `sourceSha256`, `depsSha256` and `tool` equal the SVG `<metadata>` values in all 191 maps.
- **Round-1 reproductions:**
  - A line-moving edit, then a build without the flag, then `--stale --locations`: the map's line moves from 4 to 5.
  - Built, then failed with an overlap (map has `issues`), then fixed, then `--stale --locations`: exit 0, no `issues`, one part.
  - `slide-canvas` box rects equal the SVG rects (tested).
- **Relative paths:** I ran the build from an unrelated cwd, with one absolute and one relative source in different directories and `--locations-dir ../out/maps`.
  - `source`, every `loc.file` and every issue `file`/`related.file` resolve from the map's directory.
  - All 191 example maps resolve too.
  - The test covers a shared-file part and two different cwds giving identical bytes.
- **`final`:** I checked a group with `until: 2` and its children, a row child with `until: 3`, an item with `reveal: 1`, and connects with inherited `until`, with `maxReveal` = 3.
  - Exactly the parts with `until <= 3` get `final: false`.
  - The value equals `visibleAt(life, d.maxReveal)`, and `maxReveal` is the stage the main SVG draws (`render.ts:94`).
  - `reveal-replace` `gate` and the `order` bar are `final: false` and absent from the main SVG.
- **`generated`:** only group-title captions have `inkBox` (`layout-handlers.ts:198`). Areas wrappers are recognised by the `areas()` source ref, so a user's own `group({frame: false})` in an area (`via-memo` `memo`) is not marked.
- **No flag, no change:** I built the 191 examples on main (bda4684) and on this PR without the flag:
  - The SVG trees are byte-identical, and stdout, stderr and exit codes match.
  - Overlap, `define()` throw, `--stale` on a current source, and a mixed `--stale ok bad` run also give identical output and exit 1/0.
- **n2:** a map-write failure in the success path and in the backfill path exits 1 with a single `✗ <map>: …` line, and the SVG is kept.
- **Mutations (all fail a test):** each round-1 m2 mutation, `drawsFrame` off for bands and for items, `visibility` and connect `final`, `locationsCurrent` without `issues`/deps/tool or as plain existence, each `generated` rule, the n2 warning, and `loc.file` left cwd-relative.
- **CI:** golden, test 1/3, 2/3 and 3/3 pass on 7301ee5.

## Conflicts

- **#419 (U3b):** it still conflicts in `check-diagram.ts` and the ADR status line.
  - In `check-diagram.ts`, #419 re-adds a local `findingLocation`/`issueLocation`/`textLocation`, and this PR's layout block uses `layoutFinding` from `lib/layout-issues.ts`.
  - Keep this PR's side for the layout block. `findingLocation` is already exported from `lib/layout-issues.ts`.
  - #419 should move its `issueLocation` (location plus `related`) into `lib/layout-issues.ts` on top of that `findingLocation`, have `layoutFinding` call it, and use it for rule findings. It keeps `textLocation` as the only local helper. That way check and the map share one location builder.
  - The ADR status line must then list U3b as well.
- **#374, #413:** no conflicts with this PR.

## Verdict

converged: no (Blocker 0 / Major 1 / Minor 2 / nit 1)
