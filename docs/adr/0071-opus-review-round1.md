# ADR 0071 review, round 1 (feat/json-schema-files, 7b1ed72)

Scope: `git diff origin/main...HEAD` (one commit). I backed each claim with a probe; the scripts are in the session scratchpad
(`review1/fuzz.ts`, `review1/realdecks.ts`, `jls/probe2.mjs`, `jls/alt.mjs`, `jls/oneof.mjs`).

What I checked and found sound:

- **Structure matches the CLI.** A generator walked `specSchema` and `deckSchema`, picking random oneOf branches and optional fields. It made 6,000 parts and 200 decks that the CLI's shape check (`validateAgainst`) accepts, and ajv rejected none of them against `schema/*.schema.json`. All nested `oneOf`s in the spec are exclusive under standard semantics: they differ by kind (string/array/integer/…), or their object branches are closed and differ by `required`. Every object is closed (`additionalProperties: false`), so the custom validator's "always closed" behaviour does not diverge.
- **The four real decks on this machine pass both the CLI and the schemas**, including their `.json` figure files: `~/ai-premium-lounge/nov18/deck.json`, `~/ai-premium-lounge/nov18/deck-five-diagrams.json`, `~/ai-dev-training/nov27/deck.json` and `~/research/decks/seller-report-automation/deck.json`.
- **The ADR's claim about `oneOf` holds.** With `oneOf` kept, `"type": "|"` completes 1 item (`"quadrant"`) and reports another part's fields as missing. With if/then it completes all 65, and after `"type":"chevron"` it offers exactly `steps, direction, current`.
- **Speed is fine on a large deck.** A 300-slide, 490 KB deck validates in vscode-json-languageservice in about 110–170 ms with if/then (about 40 ms with oneOf). Completion takes under 2 ms.
- **All `$schema` readers go through `loadDeck` or `parseSite`:** serve (render-thread), site, pptx-deck. Inline figures and MCP input still refuse `$schema`, as D4 says.
- **Tests, typecheck and packaging pass.** The named tests pass (101/101), `pnpm -s typecheck` is clean, and `npm pack --dry-run` ships `schema/` (684 KB unpacked).

---

## Blocker

### B1. `pnpm lint` fails, and CI runs it (`lib/schema-files.ts:37`)

- **What happens:** `pnpm -s lint` exits non-zero with `Found 1 error`. That error is `lint/suspicious/noThenProperty` on the `then:` key of the if/then objects. It is the only error in the repository (`biome lint` on the changed files alone reports the same single error). `.github/workflows/test.yml:43` runs `pnpm lint`, so the PR goes red.
- **Fix:** keep the keyword and silence the rule on that line, for example
  `// biome-ignore lint/suspicious/noThenProperty: "then" is the JSON Schema keyword (draft-07 if/then)`
  on the line above `allOf: …`. Then run `pnpm lint` again.

## Major

None.

## Minor

### M1. Completing a part type shows no description of the 65 parts (`lib/schema-files.ts:33-37`)

- **What happens:** `PartDef.description` ("what each part is for", the text MCP clients get from `partCatalog()`) appears nowhere in the files. `definitions["part.chevron"]` has no `description`, and the `type` enum has no per-value docs. In the language service, `"type": "|"` lists 65 bare names, and hovering a value only shows "The kind of part: its fields follow from it." Someone writing JSON by hand cannot tell `pert` from `dependencyNetwork`, or `isIsNot` from `compare`, without leaving the editor. Completion and explanation are the main point of the ADR.
- **Fix:**
  - Add `markdownEnumDescriptions` (or `enumDescriptions`, in the same order as `enum`) on `items.properties.type`, taken from `partCatalog()`.
  - Add `description` to each `definitions["part.X"]`.
  - Optionally, add `defaultSnippets` on `items` from each part's `example`, so that choosing a type inserts a valid skeleton.
  - ajv strict mode then needs `ajv.addVocabulary(['markdownEnumDescriptions', 'defaultSnippets'])` in the test.

### M2. A deck figure written as a wrong path gets a misleading message (`lib/schema-files.ts:56`)

- **What happens:** with `{"slides":[{"figure":"flow.svg"}]}`, vscode-json-languageservice reports `Incorrect type. Expected "object".`, which does not tell the user what is actually wrong.
- **Fix:** put `FIGURE_PATH` first in the `anyOf` and give it `patternErrorMessage: "A figure path must end in .ts or .json (relative to this deck), or write the spec itself"`. I probed this (`jls/alt.mjs`): the message becomes that text. An object figure still gets its own errors (`Property colour is not allowed.`), and completion inside an object figure is unchanged.

### M3. `spec.schema.json` accepts `canvas`, but a JSON spec file is only ever read as a deck figure, which refuses it (`lib/schema-files.ts:108`, README.md:1406)

- **What happens:** the only reader of a `.json` spec file is `loadDeck` (`lib/deck-load.ts:55-57`). `build` and the other CLIs take `.ts` only. `checkFigure` refuses `canvas` there with "is for a figure drawn alone…". The README tells users to point these files at `spec.schema.json`, which allows `canvas` (as well as `canvas` together with `width`). The editor therefore shows a clean file that the CLI rejects.
- **Fix:** do one of the following.
  - Ship a `figure.schema.json` (the same object as `definitions.figure` in the deck file, plus `$schema`) and use it in the README row "デッキが指す図の `.json`".
  - Or say in the README/ADR that `spec.schema.json` is the stand-alone spec and that `canvas` is refused inside a deck.

### M4. The tests do not cover the two editor-specific shapes in D3 (`test/schema-files.test.ts`)

- **What happens:** I mutated a copy of the repository (`review1/copy`), ran `pnpm schema` and then the test file:
  - (a) Making `byPartType` return `oneOf` again, which undoes D3's whole purpose, still passes 8/8.
  - (b) Dropping the `$` from `FIGURE_PATH`'s pattern (`'\\.(ts|json)'`), so that `"x.json.bak"` and `"a.ts.svg"` pass, still passes.
- **Fix:**
  - For (a): assert that `spec.properties.parts.items` has `properties.type.enum` with every `partCatalog()` type, and an `allOf` of if/then with no `oneOf`. Do the same for `definitions.figure` in the deck file.
  - For (b): add `{figure: 'a.json.bak'}` and `{figure: 'a.ts.svg'}` to the deck "wrong" list.

### M5. The most common hand-written text mistakes are not reported (`lib/schema-files.ts`, ADR D5)

- **What happens:** the CLI refuses control characters in every one-line text (`UNDRAWABLE`, `lib/spec.ts:667`) and whitespace-only text (`minLength` is applied as `!v.trim()`, `lib/spec.ts:666`). The schemas accept both. For example, `{"type":"flowchart","nodes":[{"id":"a","label":"a\nb"}]…}` shows no diagnostic for the `\n` (probe `h3`), although writing a line break inside a label is a very likely mistake when typing JSON by hand. The ADR D5 lists only the code-point/UTF-16 difference as the place where the editor is looser.
- **Fix:**
  - Either emit `pattern: "^[^\\u0000-\\u001f\\u007f-\\u009f]*\\S[^\\u0000-\\u001f\\u007f-\\u009f]*$"`, or a cheaper `"\\S"` plus the control-character class, for strings that have `minLength` in the source schema. Deck `notes` and column `text` would be exempt, because they allow `\n` and `\t`. Put the pattern in `definitions` with a `$ref`, so that the files do not grow much.
  - Or at least list both looser points in D5 and in the README.

## Nit

### N1. `$schema` is handled three different ways

- `loadDeck` drops `$schema` of any type (`lib/deck-load.ts:35-39`), so `"$schema": 1` is accepted silently.
- `parseSite` refuses a non-string `$schema` (`lib/site.ts:43`).
- `readConfigFile` ignores it.

ADR D4 says "(文字列)". Either make `withoutSchemaField` keep a non-string `$schema`, so that `validateDeck` reports it as an unknown field, or relax the site check. Pick one rule.

### N2. One shared description names `deck.schema.json` in every file (`lib/schema-files.ts:21`)

`SCHEMA_FIELD.description` gives `"./node_modules/svg-diagram/schema/deck.schema.json"` as its example, but the same description is used in the spec, site and config files. Pass the file's own name in, for example `schemaField('config')`.

### N3. Dates are checked by length, and the messages are odd (`lib/spec-kit.ts:153`, `lib/spec-parts/r3.ts:45`)

- `DATE` is `minLength 10` and `maxLength 10`; `TL_DATE` is 4 to 10. ajv and VS Code enforce these lengths, but the CLI's shape check does not: it only applies `minLength` as "not blank", and the part checks catch bad dates later.
- So the editor says "String is shorter than the minimum length of 10" for `"2026-1-1"`.
- `pattern: '^\\d{4}-\\d{2}-\\d{2}$'` (and `'^\\d{4}(-\\d{2}(-\\d{2})?)?$'` for `TL_DATE`) in the source schemas would give a clearer message.
- D5 also implies that the editor is only ever looser, which is not true for these fields.

### N4. Enums copied by hand into the config schema (`lib/schema-files.ts:91,93,94`)

The `wrap`, `measure` and font-family lists are copied by hand. `satisfies` only checks the keys, not the values. Export the value lists next to `Config`, or from `lib/config.ts`, and use them in both places.

### N5. `640.0` is valid for the CLI but not in VS Code

The CLI accepts `"width": 640.0`, because `JSON.parse` turns it into `640`. VS Code reports "Incorrect type. Expected integer", because it decides by the token text. This is harmless, but worth one line in D5.

### N6. site.json rules not expressed in the schema (`lib/schema-files.ts:98-102`)

`RESERVED_SLUGS` (`assets`, `cdn-cgi`, …) and the `extra` key rules (`extraPathProblem`: no absolute path, `..` or `\`) could be stated as `not: {enum: [...RESERVED_SLUGS]}` and `propertyNames: {pattern: …}`. Both are cheap and use existing constants.

### N7. Deck file content cannot be passed to the public APIs as is

`validateDeck` and `deckSchema`, exported from `svg-diagram/pptx/deck/edge`, and the MCP tools still refuse `$schema`, as D4 intends. As a result, a client that reads a deck file (the VS Code extension previewing a deck, or a user pasting `deck.json` into `render_deck`) has to strip the field itself, and `withoutSchemaField` is not exported. Consider exporting it, or stripping a top-level `$schema` in `validateDeck`.

### N8. The deck file repeats the whole spec (`lib/schema-files.ts:72`)

`deck.schema.json` repeats every part definition from `spec.schema.json`: about 300 KB each, out of 684 KB. A cross-file `$ref` (`"spec.schema.json#/definitions/part.chevron"`) would roughly halve the package addition. VS Code resolves relative `$ref`s, and ajv needs `addSchema`. This is optional.

### N9. `byPartType` would silently write a wrong key (`lib/schema-files.ts:31`)

If a future part's schema has no `type` const, the file would contain `"part.undefined"` and nothing would fail. Throw when `typeOf(b)` is not a string.

### N10. The site test hides its expectation in a string (`test/schema-files.test.ts:105`)

`parseSite(...).ok === JSON.stringify(wrong).includes('Bad Slug')` makes the expected result hard to read. List the expectation next to each case instead, for example `[[{decks: []}, false], …]`.

### N11. A loose type, and an unused file in the package (`lib/schema-files.ts:17`)

`SchemaNode = JsonSchema | {[key: string]: unknown}` turns off type checking of everything the file writes. Also, `lib/schema-files.ts` compiles into `dist/` and ships there without being used at run time (only `scripts/schema.ts` uses it). Neither is harmful.

### N12. README statements that are not quite accurate (README.md:1400, 1409)

- "CLI は `$schema` を読み飛ばす" is not exact for `site.json`, which refuses a non-string `$schema` (N1).
- "CLI が検査に使うものから作るので、版がずれない" is only true for the spec and the deck. The config and site schemas are written by hand (D2 says so). Say that the config and site schemas are kept in step by `satisfies` and the tests.

---

Counts: Blocker 1, Major 0, Minor 5, Nit 12.
