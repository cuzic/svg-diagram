# PR #423 review (Opus, round 1)

Target: feat/source-locations-u4a @ f77ad28b20d2f20c2bfaf04acda9fbfaf51ef637

## Conclusion

The map itself is right. I built all 191 examples with `--locations-dir` and checked them:

- `width` / `height` equal the SVG `viewBox` in all 191 maps.
- The emitter puts no transform on the root, so layout coordinates are viewBox coordinates.
- With capture on, every one of the 662 placed bands and every connect carries a location, so no part is silently dropped.
- The maps have no duplicate entries.
- Connect `segments` match the drawn `<path d>` (to its rounding) in the 20 figures with connects.
- Rects agree with the drawn frames to within the emitter's 4px snap (m1).

The failure path matches the ADR and Issue #420:

- A layout-check failure writes the map plus `issues` deep-equal to `check --format json`, and keeps the same exit code and the same byte-identical stdout/stderr.
- A load or `define()` failure removes the old map.
- Two sources with `--locations` exit 2.
- The PR #417 round-2 n1 fallback is now tested through both CLIs.

One Major blocks convergence. `--stale` keeps a map that no longer matches the source. In one variant the map lists layout `issues` for a figure that now builds cleanly, and the run exits 0 (M1). The rest are a pixel-snap note, test gaps, and extension-contract wording.

## Previous round

None.

## Findings

### M1 (Major): `--stale` keeps a stale map, including a stale `issues` list, whenever the SVG is current

- **Location:** `build-diagram.ts:173-183` (`if (!locationsPath || fs.existsSync(locationsPath))`).
- **What happens:** The SVG's provenance (source, deps, config, tool version) decides whether the SVG is current. The map is then trusted just because the file exists, but the map carries no provenance. Two reproductions (`--no-lint`):
  1. Build `f.ts` with `--locations f.json`. Insert a line above the box. Build without `--locations`, so the SVG is now current. Then run `build --stale f.ts --locations f.json`. The run says `最新（スキップ）`, and the map still points the box at line 3, but it is now on line 4. A click jumps to the wrong line.
  2. Build `g.ts` (valid) with `--locations`. Change it to an overlapping figure and build again. That fails, writes the map with an overlap `issue`, and leaves the old SVG. Revert to the valid source and run `build --stale g.ts --locations g.json`. The run exits **0**, and the map still holds 2 parts and `"First" overlaps "Second"`. The figure on disk has 1 part and no problems. An mtime test like `pngCurrent` would not catch this case, because the map is newer than the SVG.
- **Why Major:** Correct input, a plain `--stale` workflow, a silently wrong map, and no error. ADR D6 literally says to backfill only when the map is missing ("まだないとき"), so the ADR wording has the same gap.
- **Fix:**
  - Write the SVG's provenance into the map (e.g. `sourceSha256`, `depsSha256`, `configSha256`, `toolVersion`, `noSourceLine`, or simply the `d.source` object).
  - In the `--stale` branch, treat the map as current only when it has no `issues` and its provenance equals the SVG's. Otherwise backfill.
  - Change D6 to "地図がないか、SVG と生成元が一致しないとき".
  - Test reproduction 2. It also gives the extension a way to tell a map is stale.

### m1 (Minor): map rects are unsnapped layout rects; the drawn frames are snapped to 4px

- **Location:** `lib/locations-map.ts` `rectOf` / `ownRect`, compared with `lib/emit-boxes.ts:68` (`snap4`).
- **What happens:** `renderBoxRect` snaps x, y, the right edge and h to a 4px grid, so a frame can sit up to 2px away from its map rect:
  - `examples/slide-canvas.ts`: the map has `{x: 34, y: 36, w: 1212, h: 110}`, but the drawn rect is `x="36" … height="112"`.
  - `examples/cloud-architecture.ts`: the zone group is `h: 197.6` in the map and drawn as `height="196"`.

  The test hides this. Its fixture uses `padY: 17.5` so that the snapped and unsnapped values coincide, and then asserts exact equality.

  For hit-testing, 2px rarely matters, and ADR D6 does say "レイアウトの座標がそのまま使える". But README promises "SVG の `viewBox` 座標の `rect`", and readers will take that as "the drawn box".
- **Fix:** Either say in README/D6 that `rect` is the layout box and that drawn frames may differ by up to 2px (snap), or apply the same snap when writing the map. In either case, drop the `padY: 17.5` trick, or add a case with a non-grid height that asserts the chosen rule.

### m2 (Minor): several branches of the map and the D2 "capture only with the flag" rule are untested

- **What happens:** Each of these hand mutations passes `test/build-locations.test.ts` plus `test/check-layout-locations.test.ts` (21/21):
  - `captureSourceLocations(true)` made unconditional in `build-diagram.ts`. D2 says build captures only with `--locations`. `test/cli.test.ts` has the probe `check: only diagram checks capture part sources` for `check`, but there is no equivalent for `build`.
  - Dropping `...lifeOf(r.life ?? {})`, so item-level `reveal`/`until` is lost (e.g. the `bars` items in `examples/reveal-replace.ts`).
  - `ownRect` without the grid branch.
  - The `cause` synthetic-node check forced to `false`.
  - The own-band condition forced to `true` (adds duplicates).
  - Row children's `node` left unqualified (`part.id` instead of `qualify(scopeOf(part), part.id)`).
- **Fix:**
  - Add a `build` capture probe: off without `--locations` and on with it, like the `check` one.
  - Add one fixture that has a `bars` item with `reveal`/`until`, a `grid`, a scoped row child, and a `cause` with an unanchored node, and assert those fields.

### m3 (Minor): two contract points the extension needs are not stated

- **Location:** README's map paragraph, ADR D6.
- **What happens:**
  1. `source` and every `loc.file` are relative to the **build's cwd**, but the map does not record that base, and README says it only for `source`. The extension (`svg-diagram-vscode` `src/preview.ts`) runs `build` with `cwd: path.dirname(source)` and an absolute source path. It can resolve paths only because it knows the cwd it used. A part from a shared file comes out as `../shared/parts.ts`.
  2. The main SVG shows the last reveal stage. Parts with `until` are therefore in the map but not drawn: in `examples/reveal-replace.ts`, the `gate` box (`until: 2`) is listed at `{x: 20, y: 92, w: 440, h: 53}` and is invisible. If nothing covers that empty spot, a click there jumps to a hidden part.
- **Fix:**
  - State that `loc.file` is relative to the cwd of the `build` run (or write absolute paths, or a `cwd`/`root` field).
  - State the visibility rule for hit-testing: a part is visible in the stage-`s` SVG when `(reveal ?? 0) <= s` and `(until === undefined || s < until)`, and the main SVG is the last stage. Alternatively, write the last stage number into the map.

### n1 (nit): internal pseudo-parts appear with a user-facing `kind`/`label`

- A group title appears as two entries:
  - `kind: 'caption'` with the full-width caption band;
  - `kind: 'caption'`, `label: 'group title "VPC 10.0.0.0/16"'`, an internal `collectRects` label.

  `areas()` cells add synthetic `group` / `row` entries labelled with the area key (`hm`, `node: 'hm'`). All of them carry the right `loc` (the group or `areas()` call), so a click still lands in the right place. Still, `kind`/`label` do not describe what the user wrote.
- **Fix (optional):** Name these entries by the user's part (`kind: 'group'`, label = the group title), or say in README that `kind`/`label` describe the placed band and are not always the user's part.

### n2 (nit): a map-write failure after a successful SVG write prints the "old SVG remains" warning

- **Location:** `build-diagram.ts:218`.
- **What happens:** In the success path, `writeLocations(...)` runs after `build()` has written the new SVG. If the map write throws (e.g. the map's directory is a file), `failedBuild(err, true)` removes the map and prints `⚠ 前回の … が残っている(ソースと一致しない古い絵)`. That is false, because the SVG is new.
- **Fix:** Catch the map error separately in the success path and report it as `✗ <map>: …`.

## Checked and fine

- **viewBox:** `width`/`height` equal `viewBox="0 0 W H"` in all 191 maps. `emit.ts` adds no root transform.
- **Coverage:** with capture on, every placed band (662) and every connect in `examples/*.ts` has a `SOURCE`, so no entry is dropped. Nested items (tree/cause nodes, chart bars, row/grid cells, nested groups, which are placed as separate bands) each get their own entry. Table cells and chart marks inside one band share the band's entry. That is part-level granularity, as D6 allows.
- **Connects:** `segments` equal the `<path d>` points (to rounding). Label and chip boxes are inside `rect`. `reveal` comes from the connect.
- **Failure path:**
  - The overlap figure gives exit 1 and identical stdout/stderr with and without `--locations`, and `issues` deep-equal `check --format json` `findings`.
  - A `define()` throw or a syntax error removes an old map.
  - Layout-time throws without `laidOut` (unknown anchor, bad `raw`) also remove it. That is reasonable, since there is no layout.
  - `--locations` with 2 sources gives exit 2 before anything is written. A missing value gives exit 2. `--locations` together with `--locations-dir` gives exit 2.
  - `--locations-dir` names files `<parse(mod).name>.locations.json`, like `--out-dir`.
- **No flag, no change:** the code paths without a map path are untouched apart from the `skipSvg` restructure, which is equivalent there. The golden CI job passes.
- **Legacy fallback (PR #417 round-2 n1):** the resolve-hook fixture strips `issues` for both `check` and `build`. Mutating either fallback to `?? []` would fail it.
- **`BuildResult.laidOut`:** non-enumerable (tested). Per-source maps are written and dropped inside the loop, so nothing accumulates. Building 191 examples with the flag took about 3s.
- **CI:** test 1/3, 2/3, 3/3 and golden pass on f77ad28.

## Conflicts

- **#419 (U3b):** conflicts in `check-diagram.ts` and in the ADR 0072 status line. Both PRs rewrite the layout-issue block: this PR moves it to `lib/layout-issues.ts`, and #419 adds `issueLocation`/`textLocation`. Whichever merges second should build #419's rule findings on `layoutFinding`/`findingLocation` from `lib/layout-issues.ts`, not keep a second copy.
- **#422 (U4b):** conflicts only in the ADR status line.

## Verdict

converged: no (Blocker 0 / Major 1 / Minor 3 / nit 2)
