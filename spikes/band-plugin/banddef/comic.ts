// `svg-diagram/bands/comic` in prototype form: the REAL comic modules (lib/comic/*, lib/dsl/comic.ts) behind one BandDef. Nothing else is imported.
import {comic as comicBuild} from '../../../lib/dsl/comic.ts';
import {layoutComic} from '../../../lib/comic/layout.ts';
import {renderComicBand} from '../../../lib/comic/emit.ts';
import {comicMeasure} from '../../../lib/comic/measure.ts';
import {checkComicFindings} from './comic-findings.ts';
import type {ComicBand, ComicWorksheet, LaidOutComic} from '../../../lib/types/comic.ts';
import {band, defineBand} from './band-def.ts';

export const comicDef = defineBand<ComicBand, LaidOutComic>({
  type: 'comic',
  measure: (d, m) => { for (const [text, size, weight, font] of comicMeasure(d)) m.atoms(text, size, weight, font); },
  layout: (d, env) => { const laid = layoutComic(d, env.x, env.y, env.w, env.widthOf); return {laid, h: laid.h, anchors: laid.anchors as never}; },
  emit: laid => renderComicBand(laid),
  verify: laid => checkComicFindings(laid),
});
/** The DSL constructor: the real comic() validation, then the value that carries its definition. */
export const comic = (sheet: ComicWorksheet, opts: {id?: string} = {}) => band(comicDef, comicBuild(sheet, opts), opts.id);
