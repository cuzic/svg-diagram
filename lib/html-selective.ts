import {prepareBands} from './core.ts';
import {htmlDocument, stripSvg} from './html-document.ts';
import {htmlAdapterFor} from './html-adapter.ts';
import type {FontBox, HtmlAdapters} from './html-adapter.ts';
import {visibleAt} from './reveal-visibility.ts';
import {toneEnv} from './tokens.ts';
import type {LaidOutBand} from './types/index.ts';

export type {FontBox, HtmlBandAdapter} from './html-adapter.ts';

type HtmlOptions = Parameters<typeof prepareBands>[1] & {
  fontBox: FontBox;
  adapters?: HtmlAdapters;
  overlay?: (svg: string, fontBox: FontBox) => string;
  id?: string;
  strict?: boolean;
};

/** Render selected bands to HTML, reporting the parts embedded as SVG. */
export async function renderBandsHtml(bands: Parameters<typeof prepareBands>[0], opts: HtmlOptions) {
  if (opts.id !== undefined && !/^[A-Za-z][A-Za-z0-9_-]*$/.test(opts.id)) throw new Error('renderBandsHtml: id must be a CSS identifier (letters, digits, underscores or hyphens, starting with a letter)');
  const adapters = opts.adapters ?? {};
  const {placed, stage, verdict, emit} = await prepareBands(bands, opts);
  const tones = toneEnv(placed.tones);
  const fallbacks: {type: string; id?: string}[] = [];
  const visible = placed.laidOut.filter(band => visibleAt(band, stage));
  const parts: string[] = [];
  let svgRun: LaidOutBand[] = [];
  let rawRun = false;
  const addSvg = (bands: LaidOutBand[], connects: typeof placed.connects = [], raw = false) => {
    const svg = emit({...placed, laidOut: bands, connects}, true);
    parts.push(opts.overlay && !raw ? opts.overlay(svg, opts.fontBox) : stripSvg(svg, 'sd-ov sd-raw'));
  };
  const flush = () => {
    if (svgRun.length) addSvg(svgRun, [], rawRun);
    svgRun = [];
  };
  for (const band of visible) {
    const adapter = htmlAdapterFor(adapters, band);
    if (adapter?.accepts(band)) {
      flush();
      parts.push(adapter.render(band, placed.day, tones, opts.fontBox, placed.roles, stage));
    } else {
      fallbacks.push({type: band.type, ...('id' in band && band.id ? {id: band.id} : {})});
      const raw = band.type === 'raw' || band.type === 'wordart';
      if (opts.overlay && raw !== rawRun) flush();
      rawRun = raw;
      svgRun.push(band);
    }
  }
  flush();
  const connects = placed.connects.filter(connect => visibleAt(connect, stage));
  if (connects.length) {
    fallbacks.push(...connects.map(() => ({type: 'connect' as const})));
    addSvg([], connects);
  }
  if (opts.strict && fallbacks.length) {
    throw new Error(`renderBandsHtml: SVG fallback for ${fallbacks.map(item => item.id ? `${item.type} "${item.id}"` : item.type).join(', ')}`);
  }
  return {html: htmlDocument(placed, tones, parts.join(''), opts.id), width: placed.width, height: placed.canvasHeight, fallbacks, verdict};
}
