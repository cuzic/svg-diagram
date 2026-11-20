# ADR 0071 review, round 2 (feat/json-schema-files, 7b1ed72 + 9ad1762)

Scope: the whole of `git diff origin/main...HEAD`, not only what changed after round 1. Every claim below comes from a probe. The scripts are in the session scratchpad under `review2/`: `real.ts`, `neg.mjs`, `neg2.mjs`, `hover.mjs`, `perf.mjs`, `fuzz.ts`, `specs.ts`, `snip.ts` and `every.ts`. The language-service probes use vscode-json-languageservice with `workspaceContext.resolveRelativePath`, as VS Code does. The schema is found **only through the file's own `"$schema"`**: no `fileMatch` association. The schema folder is reached through a symlinked `node_modules/svg-diagram/schema`, as pnpm lays it out.

## What I checked and found sound

- **Tests, typecheck, lint:** `node --test test/schema-files.test.ts test/package.test.ts test/site.test.ts test/deck-*.test.ts` passes 104/104. `pnpm -s typecheck` is clean. `pnpm -s lint` exits 0 (warnings and infos only), so round-1 B1 is fixed.
- **Real files, through the CLI, ajv and the language service:**
  - Decks: `~/ai-premium-lounge/nov18/deck.json`, `deck-five-diagrams.json`, `~/ai-dev-training/nov27/deck.json` and `~/research/decks/seller-report-automation/deck.json`. Each was checked twice, both times with `"$schema"` added. The first copy is as written. In the second, every inline figure is split into its own `.json` figure file that names `figure.schema.json`; that makes 108 figure files. Every copy passes `loadDeck`, ajv and the language service with 0 diagnostics.
  - The three real `.svg-diagram.json` files: clean.
  - The 13 stand-alone spec files in `~/reports/svg-diagram-lt/figures/` (most with `canvas`) and the 28 specs in `~/research/reports/figs/specs.json`: `validateSpec` and `spec.schema.json` agree on all of them (all valid).
- **The one-line `pattern` agrees with the CLI.**
  - Under ajv (`u` flag) and the language service (`extendedRegExp` tries `u` first), `^(?=[\s\S]*\S)[^\u0000-\u001f\u007f-\u009f]*$` compiles. In JS, `\S` is exactly the complement of what `String.prototype.trim` strips.
  - I fuzzed 20,000 random 1–4 character labels drawn from whitespace, controls, NEL, NBSP, U+3000, U+2028, BOM, ZWSP, U+180E, emoji, lone surrogates and U+FFFE/FFFF. The schema never refused a label that `validateSpec` took.
  - The only disagreements are labels holding a lone surrogate, U+FFFE or U+FFFF, which the CLI refuses and the schema takes. See m2.
- **The cross-file `$ref` resolves.**
  - `figure.schema.json` and the deck's inline figures resolve `spec.schema.json#/definitions/parts` through the relative `$schema`.
  - The `#/definitions/part.X` refs inside it resolve against spec.schema.json. For example, `{"type":"chevron", |}` completes exactly `steps, direction, current`, and a missing `steps` is reported, both in a figure file and in a deck's inline figure.
  - ajv resolves it too, through `addSchema(s, name)`.
- **Editor features work.**
  - `"type": "|"` completes all 65 types, each with documentation (`enumDescriptions`), and hovering a type value shows the part's description.
  - `parts: [|]` offers 65 `defaultSnippets`, which insert the catalog example. Every snippet body is deep-equal to `partCatalog()[i].example`.
  - `"figure": "x.svg"`, `"a.json.bak"` and `""` get the `patternErrorMessage`. An object figure still gets its own errors (`Property colour is not allowed.`).
  - Notes and column text with `\n` and `\t` are clean, while a slide title with `\n` is flagged.
  - An inline figure's `$schema` is flagged, as the CLI refuses it.
- **The `every` helper:** with tsc `--strict`, a missing member and an extra member both fail to compile (`never` and `not assignable to 'W'`). Duplicates compile, which is harmless.
- **`$schema` that is not a string:** `loadDeck` keeps it, and `validateDeck` reports `$schema: is not a known field`. `parseSite` reports `needs a string`. All `$schema` readers are `loadDeck` (pptx-deck, site, present/render-thread) and `parseSite` (site).
- **Speed:** a 300-slide, 490 KB deck validates in 130–200 ms in the language service, about what round 1 measured before the patterns were added.
- **Exports:** `require.resolve('svg-diagram/schema/deck.schema.json')` and `import … with {type: 'json'}` both resolve. `svg-diagram/schema/deck.schema` (without `.json`) is not exported, which is correct.

---

## Blocker

None.

## Major

None.

## Minor

### m1. `spec.schema.json` invites `"$schema"`, but every reader of a stand-alone spec file refuses it (`lib/schema-files.ts:148`, `:26`; ADR D4)

- **What happens:**
  - `spec.schema.json` declares `$schema` with the description "…for the editor… The CLIs ignore it.", and ADR D4 says "どのファイルも先頭に `"$schema"`(文字列)を書いてよい".
  - Stand-alone JSON spec files exist and are used. `~/reports/svg-diagram-lt/figures/*.json` holds 13 of them, 11 with `canvas`, so `spec.schema.json` is the right schema for them and `figure.schema.json` is not. They are drawn with `renderSpecEdge` (`svg-diagram/spec/edge`), and the same applies to `renderSpec`/`specToDiagram` (`svg-diagram/spec`) and the MCP tools.
  - All of these call `validateSpec`, which refuses the field. `validateSpec({$schema: './node_modules/svg-diagram/schema/spec.schema.json', ...02-bottleneck.json})` → `$schema: is not a known field (known: version, …)`.
  - So a user who follows the schema's own hint gets a clean editor and a broken build.
  - Round-1 M3 assumed that the only reader of a `.json` spec is `loadDeck`. That holds for the CLIs, but not for the library entry points that these files are written for.
- **Fix:** pick one.
  - (a) Make the spec readers drop a top-level string `$schema`, as `loadDeck` does: in `validateSpec`, or in `renderSpec`/`renderSpecEdge`, with `withoutSchemaField` moved to `spec-kit` and exported. Then update D4. The MCP input can still refuse it at its own boundary if wanted.
  - (b) Or leave `$schema` out of `spec.schema.json`, and say in the README/ADR that a stand-alone spec is associated through the editor's settings (`json.schemas` with `fileMatch`), not through `$schema`. At the least, the description must not say "The CLIs ignore it" for this file.

### m2. D5's list of where the editor is looser is incomplete, and notes / column text get no check at all (`lib/schema-files.ts:31`, `:89-102`; ADR D3, D5)

- **What happens:** D5 presents its bullets as "the places where the editor and the CLI disagree". These cases are missing:
  - **Notes and column text** (exempt from ONE_LINE): `"notes": "   "`, `"text": "  "` and `"text": "\u0007"` are all refused by `validateDeck` (`must not be empty`, `contains U+0007`), but the language service shows 0 diagnostics (`neg2.mjs`, b.json). `deck-spec.ts` only turns `\r\n`/`\r`/`\n`/`\t` into spaces, so every other control character is still an error there.
  - **Lone surrogates, U+FFFE and U+FFFF:** `UNDRAWABLE` (`lib/spec.ts:653`) is `[\p{Cc}\p{Cs}￾￿]`, but ONE_LINE covers only `\p{Cc}`. These are the only disagreements in the 20k fuzz.
  - **Strings without `minLength`:** the CLI applies `UNDRAWABLE` to every string, but ONE_LINE is only added where `minLength` is set. Five places: `timeline.unit`, `pert.unit`, `quadrant.centre`, the `raci.assignments` cells, and `$schema`.
- **Fix:**
  - Give notes and column text a multi-line variant that the CLI agrees with, for example `{pattern: '^(?=[\\s\\S]*\\S)[^\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f-\\u009f]*$', patternErrorMessage: 'Not blank; line breaks and tabs only, no other control character.'}`.
  - Optionally, add `\\ud800-\\udfff\\ufffe\\uffff` to ONE_LINE's negated class. Under the `u` flag, a lone surrogate is one code point and a valid pair is not matched by the class. Check this in VS Code before relying on it, because a validator without `u` would refuse every emoji.
  - Either way, add the remaining looser points to D5 so that the list is true.

## Nit

### n1. An empty string gets two diagnostics at the same place (`lib/schema-files.ts:37`)

`"title": ""` reports both `String is shorter than the minimum length of 1.` and `Write plain text on one line…`. ONE_LINE already implies at least one non-blank character, so when `minLength === 1`, `oneLine` could drop `minLength`. Keep it when it is greater than 1, as for dates.

### n2. Snippet bodies are not escaped for VS Code's snippet syntax (`lib/schema-files.ts:62`)

vscode-json-languageservice inserts `defaultSnippets[].body` through `getInsertTextForSnippetValue`. That function uses `JSON.stringify` for each value without escaping `$`, `}` or `\`, and it strips a leading `^` from a string value and inserts the rest raw. No catalog example has any of these today (`snip.ts`). A future example with `"$1.2M"` or a `\` in a label would be inserted wrongly, and nothing would fail. Add a test that no example string contains `$` or `\` or starts with `^`, or escape them when writing `body`.

### n3. `oneLine` walks into `defaultSnippets` and `enumDescriptions` (`lib/schema-files.ts:65`)

`oneLine({...parts, items})` runs after `items.defaultSnippets` holds the catalog examples. An example containing an object such as `{type: 'string', minLength: 1}` (a plausible table or class-diagram column) would be rewritten with a `pattern` key. No example has one today. Skip `defaultSnippets` in `oneLine` alongside `enum` and `const`, or attach the snippets after `oneLine`.

### n4. The test does not check that the type descriptions line up with the types (`test/schema-files.test.ts:53`)

The test only asserts `enumDescriptions.every(d => d.length > 0)`. If the two lists were misaligned, every completion would show the wrong part's text, and the test would still pass. Assert `enumDescriptions[i] === partCatalog()[i].description`, as the `enum` assertion on line 52 does for the types.

### n5. README statements that are not accurate (`README.md:1400`, `:1409`)

- "4 つのファイルは同じフォルダに置いたまま使う": there are 5 files, and `spec.schema.json`, which the table does not list, is the one that must be present.
- "全 65 種": the number goes stale when a part is added. Say "全部品" instead.
- "CLI は文字列の `$schema` を読み飛ばす（文字列でなければ知らないフィールドとして誤り）" is true only for decks and figure files:
  - `.svg-diagram.json` ignores a `$schema` of any type.
  - `site.json` says `needs a string`.
  - The stand-alone spec readers refuse a string `$schema` too (m1).

### n6. ADR "結果" figures are stale (`docs/adr/0071-json-schema-files.md`, 結果)

- It says "約 0.7 MB … spec とデッキのスキーマが大半". After the shared-parts change, the files total about 595 KB:
  - spec 513 KB
  - config 63 KB
  - deck 14 KB
- About 96 KB of `spec.schema.json` is the ONE_LINE pattern and message, inlined at every text. That is acceptable, and the `$ref` alternative does not work for draft-07 siblings, but update the sentence.

### n7. Where the cross-file `$ref` and schema association do not reach (ADR D1, 結果)

- `deck.schema.json` and `figure.schema.json` work only when they are loaded from a URI with `spec.schema.json` next to them. Loading one by content fails to resolve `spec.schema.json#/definitions/parts`, and the figures then go unchecked. Three ways to do that:
  - VS Code `json.schemas[].schema` with an inline object, whose base is `vscode://schemas/custom/N`
  - an extension that serves the schemas under a custom URI scheme
  - `ajv.compile(deck)` without `addSchema(spec)`
- The ADR says the extension "can apply them without `$schema`". That holds for the deck, `site.json` and `.svg-diagram.json`, which have names to match. It does not hold for figure `.json` files, which have no naming convention, so the extension would have to read the decks to find them.
- Say both in the ADR so that the extension's design takes them into account: register the schemas by `file:` URI into `node_modules/svg-diagram/schema/`, and find figure files through the decks.

### n8. A plain `new Ajv()` cannot compile the files (README)

ajv 8 is strict by default, so it throws `unknown keyword: "enumDescriptions"` (and the same for `defaultSnippets` and `patternErrorMessage`). The test passes `addVocabulary(EDITOR_KEYWORDS)`. One README line for library users would help: `ajv.addVocabulary(['enumDescriptions', 'defaultSnippets', 'patternErrorMessage'])`, or `strict: false`.

### n9. Round-1 nits still open (for the record)

- N6: the `extra` key rules (`extraPathProblem`) are still not expressed as `propertyNames`.
- N7: `withoutSchemaField` is still not reachable from a package entry point. m1(a) would cover this.
- N11: `SchemaNode` is still a loose type.

None of these blocks the merge.

---

Counts: Blocker 0, Major 0, Minor 2, Nit 9.
