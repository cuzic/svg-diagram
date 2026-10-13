// Drawing an SVG to pixels, for `svg-diagram show` (sixel), `preview` (PNG) and `contact` (a sheet of figures).
//
// Two engines. 'resvg' (the default) is a Rust renderer with no browser: it draws with the font files the measuring uses
// (lib/font-metrics.ts), so what you see is what was laid out. 'chromium' draws the SVG as an <img> in a real browser, the way a
// web page shows it (playwright-chromium, optional). 'auto' is resvg, or Chromium if resvg cannot be loaded here.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fontCoverage, resolveFontFile} from './font-metrics.ts';
import {withColorEmoji} from './emoji-color.ts';
import {subsetFont} from './font-subset.ts';
import {computeStyles, elements, parseXml, type El} from './svg-dom.ts';
import {familyKind} from './svg-geom.ts';
import {EMOJI_RE} from './tokens.ts';
import type {FontFamily, FontSpecs} from './types.ts';
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

/** The SVG with everything it draws turned to grey (luma, as a mono print or a colour-blind reader sees it): the content goes inside a group filtered by a colour matrix.
 *  The filter region is the canvas in user units (the viewBox, with a margin), not the group's bounding box: a box-relative region is empty for content with no height (a lone horizontal line),
 *  which would drop it. Absolute numbers, not percentages: resvg panics on a userSpaceOnUse region in percent when the viewBox does not start at 0 0. */
export function grayscaleSvg(svg: string): string {
  const open = /<svg\b[^>]*>/.exec(svg);
  const end = svg.lastIndexOf('</svg>');
  if (!open || end === -1) return svg;
  const vb = /\sviewBox="\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*"/.exec(open[0])?.slice(1).map(Number), size = svgSize(svg);
  const [x, y, w, h] = vb ?? (size ? [0, 0, size.w, size.h] : [0, 0, 0, 0]);
  const region = w > 0 && h > 0 ? ` filterUnits="userSpaceOnUse" x="${x - w}" y="${y - h}" width="${3 * w}" height="${3 * h}"` : '';
  const filter = `<filter id="svg-diagram-gray"${region} color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0.299 0.587 0.114 0 0  0 0 0 1 0"/></filter>`;
  const at = open.index + open[0].length;
  return `${svg.slice(0, at)}${filter}<g filter="url(#svg-diagram-gray)">${svg.slice(at, end)}</g>${svg.slice(end)}`;
}

export const NOT_LOADABLE = `a figure could not be drawn: @resvg/resvg-js could not be loaded on this machine (no prebuilt binary for it?).
  Use the browser instead:  --engine chromium  (needs: pnpm add -D playwright-chromium)`;

let resvgModule: Promise<typeof import('@resvg/resvg-js')> | null = null;
const loadResvg = () => (resvgModule ??= import('@resvg/resvg-js'));

/**
 * What resvg draws this figure with. It parses every font it is given on every drawing and cannot keep them between drawings, which for a
 * 14 MB Japanese font is seconds; so it is given, per font the figure needs (sans, bold, mono, emoji: only those used), that font cut down to the
 * characters of the figure (lib/font-subset.ts). The pixels are the same. The system's fonts are read as well only when some character of the
 * figure has no glyph in the layout's fonts (resvg falls back per glyph; reading them costs seconds). Call `cleanup()` when the drawing is done:
 * the cut fonts are temporary files.
 */
export function prepareResvgFonts(svg: string, specs?: FontSpecs): {options: ResvgFontOptions; cleanup: () => void} {
  let root: El | null = null;
  try { root = parseXml(svg); } catch { /* an SVG resvg will reject anyway: take every font, whatever the text */ }
  const styles = root ? computeStyles(root) : null;
  const roles = new Set<string>(); // 'sans:400', 'sans:700', 'mono:400', ...
  const chars = new Set<number>();
  if (root && styles) {
    for (const t of elements(root).filter(e => e.tag === 'text')) {
      const walk = (e: El) => {
        for (const c of e.children) {
          if (typeof c !== 'string') { if (c.tag === 'tspan' || c.tag === 'a') walk(c); continue; }
          for (const ch of c) if (!/[\n\r\t]/.test(ch)) chars.add(ch.codePointAt(0)!); // (a newline or tab in the source is drawn as a space: the cut adds that one)
          const st = styles.get(e)!;
          roles.add(`${familyKind(st.fontFamily)}:${st.fontWeight >= 600 ? 700 : 400}`);
        }
      };
      walk(t);
    }
  } else for (const r of ['sans:400', 'sans:700', 'mono:400', 'mono:700', 'emoji:400']) roles.add(r);
  for (const cp of chars) if (EMOJI_RE.test(String.fromCodePoint(cp))) roles.add('emoji:400');
  const drawn = [...chars].some(cp => cp > 0x20); // any character to draw at all (a figure of shapes needs no font)

  const resolve = (role: string) => { const [family, weight] = role.split(':'); return {role, r: resolveFontFile(family as FontFamily, +weight, specs), cov: fontCoverage(family as FontFamily, +weight, specs)}; };
  const loaded = [...roles].map(resolve).filter(x => x.r);
  // a character none of the needed fonts has may be in another of the layout's fonts (a symbol only the emoji font draws): take that one too
  const missing = (list: typeof loaded) => [...chars].filter(cp => cp > 0x20 && cp !== 0xfe0f && cp !== 0x200d && !list.some(x => x.cov!.has(cp)));
  for (const cp of missing(loaded)) {
    const extra = ['sans:400', 'mono:400', 'emoji:400'].filter(r => !loaded.some(x => x.role === r)).map(resolve).find(x => x.r && x.cov!.has(cp));
    if (extra) loaded.push(extra);
  }
  const needSystem = drawn && (loaded.length === 0 || missing(loaded).length > 0);

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'svg-diagram-fonts-'));
  const files: string[] = [], seen = new Set<string>();
  let n = 0;
  for (const {r} of loaded) {
    const key = `${r!.file}#${r!.index}`;
    if (seen.has(key)) continue;
    seen.add(key);
    try {
      const out = path.join(dir, `${n++}.ttf`);
      fs.writeFileSync(out, subsetFont(fs.readFileSync(r!.file), r!.index, [...chars, 0x20, 0xa0])); // a space is a glyph too: without it the gaps take another font's width
      files.push(out);
    } catch { files.push(r!.file); } // a font HarfBuzz cannot cut: resvg gets it whole
  }
  const first = (family: FontFamily) => loaded.find(x => x.role.startsWith(`${family}:`))?.r?.name ?? ''; // (only fonts the figure uses are looked up at all)
  const sans = first('sans'), mono = first('mono');
  return {
    options: {
      fontFiles: files,
      loadSystemFonts: needSystem,
      ...(sans ? {defaultFontFamily: sans, sansSerifFamily: sans} : {}),
      ...(mono ? {monospaceFamily: mono} : {}),
    },
    cleanup: () => fs.rmSync(dir, {recursive: true, force: true}),
  };
}

/**
 * resvg (2.6) does not know orient="auto-start-reverse" and draws such a marker unrotated, so every arrowhead points right whatever
 * the line's direction. Rewrite it for resvg: the marker becomes orient="auto" (what auto-start-reverse is at a line's end), and a
 * marker-start gets a copy turned half a turn about its reference point (what auto-start-reverse is at a line's start).
 */
export function withResvgMarkerOrient(svg: string): string {
  const flipped = new Set<string>();
  const out = svg.replace(/<marker\b([^>]*?)\borient="auto-start-reverse"([^>]*)>([\s\S]*?)<\/marker>/g, (_m, a: string, b: string, body: string) => {
    const attrs = `${a}orient="auto"${b}`;
    const end = `<marker${attrs}>${body}</marker>`;
    const id = /\bid="([^"]+)"/.exec(attrs)?.[1];
    if (!id || !svg.includes(`marker-start="url(#${id})"`)) return end;
    flipped.add(id);
    // turned about the middle of its box (a marker is clipped to its viewBox), so the reference point moves to its mirror image
    const num = (name: string, dflt: number) => Number(new RegExp(`\\b${name}="([^"]+)"`).exec(attrs)?.[1] ?? dflt);
    const vb = /\bviewBox="([^"]+)"/.exec(attrs)?.[1].trim().split(/[\s,]+/).map(Number);
    const [cx, cy] = vb && vb.length === 4 ? [vb[0] + vb[2] / 2, vb[1] + vb[3] / 2] : [num('markerWidth', 3) / 2, num('markerHeight', 3) / 2];
    const startAttrs = attrs.replace(`id="${id}"`, `id="${id}--start"`).replace(/\brefX="[^"]*"/, '').replace(/\brefY="[^"]*"/, '') + ` refX="${2 * cx - num('refX', 0)}" refY="${2 * cy - num('refY', 0)}"`;
    return `${end}<marker${startAttrs}><g transform="rotate(180 ${cx} ${cy})">${body}</g></marker>`;
  });
  return flipped.size === 0 ? out : out.replace(/marker-start="url\(#([^)"]+)\)"/g, (m, id: string) => flipped.has(id) ? `marker-start="url(#${id}--start)"` : m);
}

export interface ResvgFontOptions {fontFiles: string[]; loadSystemFonts: boolean; defaultFontFamily?: string; sansSerifFamily?: string; monospaceFamily?: string}

export async function rasterizeWithResvg(svg: string, {scale = 1, png = false, fonts}: {scale?: number; png?: boolean; fonts?: FontSpecs} = {}): Promise<Raster> {
  const size = svgSize(svg);
  if (!size) throw new Error('the SVG has no width/height (or viewBox) on its root element');
  const problems = xmlProblems(svg);
  if (problems.length) throw new Error(`could not load it as an <img> (not well-formed XML): ${problems[0]}`);
  let Resvg: typeof import('@resvg/resvg-js').Resvg;
  try { ({Resvg} = await loadResvg()); } catch { throw new Error(NOT_LOADABLE); }
  let rendered;
  const prepared = prepareResvgFonts(svg, fonts);
  try {
    rendered = new Resvg(withResvgMarkerOrient(withColorEmoji(svg, fonts)), {
      background: '#ffffff',
      fitTo: scale === 1 ? {mode: 'original'} : {mode: 'zoom', value: scale},
      font: prepared.options,
    }).render();
  } catch (e) { throw new Error(`could not load it as an <img>: ${(e as Error).message}`); }
  finally { prepared.cleanup(); }
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
