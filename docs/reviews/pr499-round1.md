# PR #499 review (Opus, round 1)

Target: fix/pptx-deck-invalid-xml @ 7aad63f9353b782fd1b1c2630c86a5c8654fb2a5

## Conclusion
The fix is correct and complete for `pptx-deck`: `xml:space` on `<a:t>` was the only emitter of that attribute on a DrawingML element in `lib/` (the other hits are SVG `<text>`), every `ppt/**/*.xml` part of a deck (slides, notes, notesMaster, slideMaster, slideLayout, theme, presentation, presProps, viewProps, tableStyles) now validates against pml.xsd, and the new test ran (not skipped) in CI shard 3 and fails when the attribute is put back. Whitespace in notes survives: `<a:t>` is `xsd:string` (whiteSpace=preserve) and XML parsers pass character data through unchanged, so `xml:space` was never needed. converged: yes. The findings are Minor: the most useful one is that the single-figure `svg-diagram pptx` output still ships a `presentation.xml` that fails pml.xsd and nothing checks it. Fix that in a follow-up PR.

## Previous round
- (first round)

## Findings

### m1 (Minor): single-figure `svg-diagram pptx` output has a `presentation.xml` that fails pml.xsd, and no test validates the non-slide parts of that output
- Evidence: ran `./bin/svg-diagram pptx examples/arrow-weight.ts --out a.pptx`, unzipped it and validated every `ppt/**/*.xml` with pml.xsd. All parts pass except `ppt/presentation.xml`: `Element 'p:notesMasterIdLst': This element is not expected. Expected is one of ( p:sldSz, p:notesSz )`. The template (`lib/pptx/template/ppt/presentation.xml`, from pptxgenjs) has `sldIdLst` before `notesMasterIdLst`. `lib/pptx/deck.ts:196` already reorders it for decks, but `lib/pptx/package.ts:26` only patches `sldSz`. `test/pptx.test.ts:120-134` checks only `ppt/slides/slide1.xml` of 3 examples. This bug was already on main and is not a regression. pptxgenjs files with this order open in PowerPoint, so it is probably tolerated. Still, it is the only remaining schema violation in shipped PPTX output, and it is the same class of bug this PR is about.
- Fix: put `notesMasterIdLst` before `sldIdLst` in the template (or in `packageEntries`). Then extend the `example PPTX files` test (or add one) to validate every `ppt/**/*.xml` part of `emitPptx` output, the way the new deck test does.

### m2 (Minor): the CI schema fetch has no fallback, and an HTTP error is reported as "the archive changed"
- Evidence: `test/helpers/pptx/xsd.ts` `fetchXsd` calls `fetch(URL_PART4)` without checking `res.ok`, a timeout or a retry. A 403/5xx or Cloudflare challenge page gets hashed and throws `the ECMA-376 Part 4 archive changed (SHA-256 mismatch)`, which sends the reader the wrong way. Cost is small: in run 45816981149 the "OOXML schemas" step took about 2 s per shard on a cache miss. Locally the download took about 16 s. On a cache miss every shard downloads the file (only one shard can save the cache, the others log "Unable to reserve cache"). PR caches are scoped to the PR ref, so each new PR misses until main has saved the cache. When ecma-international.org is down or blocks runners, all three test shards fail.
- Fix: check `res.ok` and report the status (and retry once). Then consider vendoring the 26 XSDs (972 KB unpacked) under e.g. `test/fixtures/ooxml-xsd/` with Ecma's copyright and licence notice. Ecma's licence allows copying and redistribution in whole or in part as long as the notice is kept, and the owner's ooxml-rs repo already vendors the same set (`reference/ecma-376-transitional-xsd/`). That removes the network dependency and the cache step. A pinned raw URL of a GitHub mirror at a fixed commit, with the same SHA-256 check, is a lighter alternative.

### m3 (Minor): the older schema checks in `test/pptx.test.ts` can still skip silently in CI
- Evidence: `test/pptx.test.ts:102` has `{skip: !(hasXmllint() && hasXsd())}` and `:134` has `if (hasXmllint() && hasXsd()) ...`, with no `CI` guard, unlike the new deck test. Today the "OOXML schemas" step fails the job when the XSDs are missing, so the XSDs are always there. But if `libxml2-utils` drops out of the apt line, these two checks go quiet without failing. The new ADR 0027 sentence says the `test/pptx.test.ts` schema checks are "never skipped in CI", which is only true while that install step stays.
- Fix: use the same `!process.env['CI'] && ...` skip condition (or an assertion under CI) in both places.

### m4 (Minor): the package parts outside `ppt/` are not schema-checked
- Evidence: the new test filters `n.startsWith('ppt/')`, so `docProps/app.xml`, `docProps/core.xml`, `[Content_Types].xml` and the `.rels` parts are not validated. I checked `docProps/app.xml` of a deck by hand against `shared-documentPropertiesExtended.xsd`, and it passes. `core.xml`, the content types and the rels need the OPC schemas from ECMA-376 Part 2, which are not fetched. These parts are template text plus regex edits (`<Slides>N</Slides>`, `<dc:title>`), so the risk is low.
- Fix: validate `docProps/app.xml` against `shared-documentPropertiesExtended.xsd` in the same test (a single line). Add the Part 2 OPC schemas only if those parts start to be generated.

### n1 (nit): the whitespace tests check the bytes, not PowerPoint
- Evidence: the indent and leading-space expectations (`<a:t>    二</a:t>`) prove that the XML keeps the spaces. They don't prove how PowerPoint renders them. The reasoning holds: `a:t` is `xsd:string`, PowerPoint and python-pptx themselves write `<a:t>` with leading spaces and no `xml:space`, and XML 1.0 §2.10 makes `xml:space` only a hint to the application. Trailing spaces per line are still dropped by `trimEnd()`, which was already the behaviour and is intended. The real-machine check listed in the PR's open questions also covers this.
- Fix: none needed. When the real-machine check is done, include a note with leading spaces in the test deck.

## Other checks
- Mutation: putting `xml:space="preserve"` back in `notesXml` makes 3 tests fail (the new schema test and the two expectation tests), checked with an lxml/libxml2-backed xmllint and `CI=true`.
- CI run 45816981149: all green. `ok 809 - every part of a deck validates against pml.xsd` appears in shard 3 (not skipped), and the cache key is `ooxml-xsd-<hash of xsd.ts>`.
- The branch is behind main (#495, #496), but neither touches these files, and `git merge-tree` reports a clean merge. No other open PR touches the changed files.

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 4 / nit 1)
