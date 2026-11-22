// The page script of test/comic-web.test.ts: the comic of the ADR sample drawn through the browser entry, measured by Chromium itself (svgMeasurer).
import {comic, diagram, renderComic, renderInBrowser, svgMeasurer} from '../../lib/web.ts';
import {SAMPLE} from '../helpers/comic-sample.ts';

(globalThis as any).drawComic = async () => {
  const r = await renderInBrowser(diagram({theme: 'blue', title: 'マンガ', width: 480, legend: false}).add(comic(SAMPLE)), {measure: svgMeasurer()});
  return {ok: r.verdict.ok, xml: r.xml, svg: r.svg};
};

(globalThis as any).drawFilledComic = async () => {
  const {svg} = await renderComic(SAMPLE, {values: {day: '水曜', what: null, change: '早く帰る'}, measure: svgMeasurer()});
  return svg;
};
