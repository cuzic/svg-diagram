import {band} from '../band-def.ts';
import type {BandDef, WithBandDef} from '../band-def.ts';
import {texts} from '../band-text-sizes.ts';
import {renderComicBand} from '../comic/emit.ts';
import {comicAcceptHint, comicAdvice, comicProblems, comicRuleDocs} from '../comic/findings.ts';
import {layoutComic} from '../comic/layout.ts';
import {comicMeasure} from '../comic/measure.ts';
import {parseTemplate, slotIdsOf} from '../comic/template.ts';
import {comic as build} from '../dsl/comic.ts';
import {appendPlacedBand} from '../layout-placed.ts';
import type {ComicBand, ComicOpts, ComicWorksheet, LaidOutComic} from '../types/comic.ts';
import {comicConnectorProblems, comicRects} from '../verify-comic-rects.ts';

const definition = {
  type: 'comic',
  textSizes: texts,
  internal: true,
  ids({sheet}) {
    const ids = new Set<string>();
    for (const panel of sheet.panels) {
      ids.add(panel.id);
      for (const dlg of panel.dialogue) {
        const id = `${panel.id}.${dlg.id}`;
        ids.add(id);
        for (const slot of slotIdsOf(parseTemplate(dlg.tpl, `comic(): ${id}`))) ids.add(slot);
      }
    }
    return [...ids];
  },
  layout(data, ctx, x, w) {
    const laid = layoutComic(data, x, ctx.originOf(data, ctx.y), w, ctx.widthOf);
    appendPlacedBand(data, laid, ctx, 'a comic takes an id that another anchor already has',
      'a comic panel or bubble takes an id that another anchor already has');
  },
  measure(data, {atoms}) {
    for (const [text, size, weight, font] of comicMeasure(data)) atoms(text, size, weight, font);
  },
  emit: laid => renderComicBand(laid),
  nameNodes: laid => ({...laid, nodeIds: true}),
  nodeIds: 'self',
  rectsQualified: true,
  rules: comicRuleDocs,
  verify: {
    rects: comicRects,
    layoutFindings: comicAdvice,
    check: (laid, {connects}) => [
      ...comicProblems(laid),
      ...comicConnectorProblems(laid, connects).map(message => ({rule: 'comic', severity: 'problem' as const, message})),
    ],
    acceptHint: comicAcceptHint,
  },
} satisfies BandDef<ComicBand, LaidOutComic>;

/** Builds a comic worksheet band for renderBands(). */
export function comic<const Id extends string = never, const Sheet extends ComicWorksheet = ComicWorksheet>(
  sheet: Sheet, opts?: ComicOpts & {id?: Id},
): WithBandDef<ReturnType<typeof build<Id, Sheet>>, LaidOutComic> {
  const data = build<Id, Sheet>(sheet, opts);
  return band<typeof data, LaidOutComic>(definition, data);
}

/** @internal Definition used by the full renderer. */
export const comicDefinition: BandDef<ComicBand, LaidOutComic> = definition;
