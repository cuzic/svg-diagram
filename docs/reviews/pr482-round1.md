# PR #482 review (Opus, round 1)

Target: feat/sankey-hide-values @ 5717fb04d639f5de8a1c43e0c14fd390bd14b1ba

## Conclusion
`values: false` removes every visible number I could find. I checked the SVG, a deck figure slide and a column slide (`renderDeck`), and the native PPTX text (`renderDeckPptxEdge`). Node heights, ribbon widths and `<desc>` are unchanged. Long or wrapping names, icons, `align: 'left'` and widths 400/600/default all lay out with no problems under the strict-width helper. Spec, schema and DSL agree (same SVG, and the spec rejects a non-boolean). Hiding ribbon numbers too is the right call: a "shape only" figure with some numbers left over would be inconsistent. Keeping values in the alt text is also right, and it matches how `bars` with hidden values behaves (`hiddenBarsDescription`). converged: yes. There are no Blockers or Majors, and two Minors.

## Previous round
None (round 1).

## Findings
### m1 (Minor): `linkLabels: true` with `values: false` is silently ignored, and the `linkLabels` docs do not say so
- Evidence: I rendered `{values: false, linkLabels: true}` through `renderSpec`. It returns no issues and draws no ribbon number (`lib/charts-sankey.ts`: `if (s.linkLabels && s.values)`). The `linkLabels` description in `lib/spec-parts/sankey.ts` / `schema/spec.schema.json` is still "false: no values on the ribbons.", and the JSDoc on `SankeyOpts.linkLabels` still says "default true". A spec author who sets both gets no hint why `linkLabels: true` does nothing.
- Fix: in the `linkLabels` description (spec part + JSDoc), say that `values: false` turns it off. A check warning for the explicit combination is optional.

### m2 (Minor): "the alt text keeps the values" only reaches a reader when `<desc>` is emitted. An untitled `values: false` sankey has its values nowhere
- Evidence: I ran `diagram({theme: 'blue'}).add(sankey(['a','b'], [{from:'a',to:'b',value:5}], {unit:'人', values:false}))` with `renderDiagram`. It emits no `<desc>`/`<title>`, and the only warning is the generic `a11y-no-title`. The same setup with `bars` and hidden values gets the specific `bars-values-hidden` warning (`lib/verify-bars.ts`), which tells the author that the values only survive in `<desc>`. The README sentence "代替テキスト（alt）の値はそのまま" reads as unconditional.
- Fix: either extend the hidden-values rule to sankey `values: false` (doc medium, no title), or add "(題名があるとき `<desc>` に入る)" to the README/charts.md sentence. Since `a11y-no-title` already fires, documenting it is enough.

Checked and fine (not findings):
- Visible numbers: `<text>` in the SVG with `<desc>` and `<title>` stripped has no digits in any variant. There are no `data-*` or `aria-label` value attributes. The `<desc>` of deck slides holds only the alt. The PPTX `<a:t>` runs on figure and column slides are names only. Thin-ribbon numbers no longer go to `omitted`, which is correct because nothing was hidden for lack of room. Sankey has no legend, totals or tooltips.
- Geometry: the last-layer room uses the name only (`fullOf`), and it is still capped at 0.24·w. The wrapped label drops the value line. There are no problems at widths 400/600/default with icons and wrapping JA/EN names, and the strict-width helper registers every measured string.
- Mutations (each reverted): ribbon guard → `s.linkLabels`, `fullOf` always with value, wrap branch always appends the value, validation removed, default flipped to `=== true`. Each one fails at least one sankey test.
- CI: golden and test 2/3 and 3/3 pass. test 1/3 was still pending when I wrote this. Open PRs #480 and #481 touch `README.md`/`schema/spec.schema.json`, and both merge cleanly with this branch (`git merge-tree`).

## Verdict
converged: yes (Blocker 0 / Major 0 / Minor 2 / nit 0)
