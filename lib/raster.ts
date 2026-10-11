// Drawing an SVG to pixels, for `svg-diagram show` (sixel), `preview` (PNG) and `contact` (a sheet of figures).
//
// Two engines. 'resvg' (the default) is a Rust renderer with no browser: it draws with the font files the measuring uses
// (lib/font-metrics.ts), so what you see is what was laid out. 'chromium' draws the SVG as an <img> in a real browser, the way a
// web page shows it (playwright-chromium, optional). 'auto' is resvg, or Chromium if resvg cannot be loaded here.
import {resolveFontFile} from './font-metrics.ts';
import type {FontSpecs} from './types.ts';
import {xmlProblems} from './xml-check.ts';

export type RasterEngine = 'auto' | 'resvg' | 'chromium';

export interface Raster {
  width: number;
  height: number;
  /** RGBA, row-major, 4 bytes per pixel (what the sixel encoder takes). */
  rgba: Buffer;
  /** PNG of the same pixels, when asked for. */
  png?: Buffer;
}

/** The SVG's own width and height (the root's attributes, or its viewBox). */
export function svgSize(svg: string): {w: number; h: number} | null {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  const num = (n: string) => { const m = new RegExp(`\\s${n}="([0-9.]+)(?:px)?"`).exec(root); return m ? parseFloat(m[1]) : NaN; };
  let w = num('width'), h = num('height');
  if (!(w > 0 && h > 0)) { const vb = /viewBox="[-0-9.]+[ ,]+[-0-9.]+[ ,]+([0-9.]+)[ ,]+([0-9.]+)"/.exec(root); if (vb) { w = parseFloat(vb[1]); h = parseFloat(vb[2]); } }
  return w > 0 && h > 0 ? {w, h} : null;
}

export const NOT_LOADABLE = `a figure could not be drawn: @resvg/resvg-js could not be loaded on this machine (no prebuilt binary for it?).
  Use the browser instead:  --engine chromium  (needs: pnpm add -D playwright-chromium)`;

let resvgModule: Promise<typeof import('@resvg/resvg-js')> | null = null;
const loadResvg = () => (resvgModule ??= import('@resvg/resvg-js'));

/** The font files resvg is given: what the measuring reads (sans, mono, emoji; regular and bold), so layout and picture agree. */
export function fontFilesForResvg(specs?: FontSpecs): {files: string[]; sans: string; mono: string} {
  const found = (['sans', 'mono', 'emoji'] as const).flatMap(f => [400, 700].map(w => ({f, w, r: resolveFontFile(f, w, specs)}))).filter(x => x.r);
  return {
    files: [...new Set(found.map(x => x.r!.file))],
    sans: found.find(x => x.f === 'sans')?.r?.name ?? '',
    mono: found.find(x => x.f === 'mono')?.r?.name ?? '',
  };
}

export async function rasterizeWithResvg(svg: string, {scale = 1, png = false, fonts}: {scale?: number; png?: boolean; fonts?: FontSpecs} = {}): Promise<Raster> {
  const size = svgSize(svg);
  if (!size) throw new Error('the SVG has no width/height (or viewBox) on its root element');
  const problems = xmlProblems(svg);
  if (problems.length) throw new Error(`could not load it as an <img> (not well-formed XML): ${problems[0]}`);
  let Resvg: typeof import('@resvg/resvg-js').Resvg;
  try { ({Resvg} = await loadResvg()); } catch { throw new Error(NOT_LOADABLE); }
  const f = fontFilesForResvg(fonts);
  let rendered;
  try {
    rendered = new Resvg(svg, {
      background: '#ffffff',
      fitTo: scale === 1 ? {mode: 'original'} : {mode: 'zoom', value: scale},
      font: {
        fontFiles: f.files,
        loadSystemFonts: f.files.length === 0, // none found by the measuring: let resvg look
        ...(f.sans ? {defaultFontFamily: f.sans, sansSerifFamily: f.sans} : {}),
        ...(f.mono ? {monospaceFamily: f.mono} : {}),
      },
    }).render();
  } catch (e) { throw new Error(`could not load it as an <img>: ${(e as Error).message}`); }
  return {width: rendered.width, height: rendered.height, rgba: Buffer.from(rendered.pixels), png: png ? Buffer.from(rendered.asPng()) : undefined};
}

export async function rasterize(svg: string, opts: {scale?: number; png?: boolean; engine?: RasterEngine; fonts?: FontSpecs} = {}): Promise<Raster> {
  const engine = opts.engine ?? 'auto';
  const {engine: _e, fonts, ...rest} = opts;
  const inBrowser = async () => (await import('./measure.ts')).rasterizeInBrowser(svg, rest);
  if (engine === 'chromium') return inBrowser();
  try { return await rasterizeWithResvg(svg, {...rest, fonts}); }
  catch (e) { if (engine === 'auto' && (e as Error).message === NOT_LOADABLE) return inBrowser(); throw e; }
}

/**
 * `svg` as a nested <svg> element at (x, y), w × h, to put several figures into one SVG. Unlike an <image> of the file (whose
 * text resvg draws without any font), a nested element is drawn with the same fonts as the sheet. Ids are prefixed per figure so
 * that two figures that both define `id="arrow"` do not capture each other's references.
 */
export function embedSvg(svg: string, box: {x: number; y: number; w: number; h: number}, idPrefix: string): string {
  const size = svgSize(svg);
  if (!size) throw new Error('the SVG has no width/height (or viewBox) on its root element');
  const open = /<svg\b[^>]*>/.exec(svg);
  if (!open) throw new Error('no <svg> element');
  const viewBox = /\sviewBox="([^"]*)"/.exec(open[0])?.[1] ?? `0 0 ${size.w} ${size.h}`;
  const ns = /\sxmlns="([^"]*)"/.exec(open[0])?.[1] ?? 'http://www.w3.org/2000/svg';
  const extra = [...open[0].matchAll(/\s(xmlns:[\w-]+="[^"]*")/g)].map(m => m[1]).join(' ');
  let inner = svg.slice(open.index! + open[0].length, svg.lastIndexOf('</svg>'));
  const ids = [...new Set([...inner.matchAll(/\sid="([^"]+)"/g)].map(m => m[1]))];
  for (const id of ids) {
    const re = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    inner = inner.replace(new RegExp(`(\\sid=")${re}(")`, 'g'), `$1${idPrefix}${id}$2`)
      .replace(new RegExp(`url\\(#${re}\\)`, 'g'), `url(#${idPrefix}${id})`)
      .replace(new RegExp(`((?:xlink:)?href=")#${re}(")`, 'g'), `$1#${idPrefix}${id}$2`);
  }
  return `<svg xmlns="${ns}" ${extra} x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" viewBox="${viewBox}">${inner}</svg>`;
}
