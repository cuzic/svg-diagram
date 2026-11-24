import type {BandDef} from '../band-def.ts';
import {texts} from '../band-text-sizes.ts';
import {renderComicBand} from '../comic/emit.ts';
import {layoutComic} from '../comic/layout.ts';
import {comicMeasure} from '../comic/measure.ts';
import {appendPlacedBand} from '../layout-placed.ts';
import type {ComicBand, LaidOutComic} from '../types/comic.ts';
import {comicRects} from '../verify-comic-rects.ts';

/** @internal Selective adapter for comic layout and obstacle rectangles. */
export const comicDefinition: BandDef<ComicBand, LaidOutComic> = {
  type: 'comic',
  textSizes: texts,
  internal: true,
  layout(data, ctx, x, w) {
    const laid = layoutComic(data, x, ctx.originOf(data, ctx.y), w, ctx.widthOf);
    appendPlacedBand(data, laid, ctx, 'a comic takes an id that another anchor already has',
      'a comic panel or bubble takes an id that another anchor already has');
  },
  measure(data, {atoms}) {
    for (const [text, size, weight, font] of comicMeasure(data)) atoms(text, size, weight, font);
  },
  emit: laid => renderComicBand(laid),
  rectsQualified: true,
  verify: {rects: comicRects},
};
