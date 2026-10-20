// math-tex.ts: the part of math() that is not pure (it loads MathJax). lib/math.ts lays the result out.
//
// math(): a TeX formula placed as a part. MathJax (tex -> svg, no browser) turns the formula into outlines, so the diagram stays a
// self-contained SVG: no web font, no foreignObject, and the same picture in every viewer. The formula is converted ONCE, when math()
// is called; layout then needs only its size, and emit draws the outlines scaled to the band's font size.
//
// MathJax is loaded on the first math() call (createRequire), so a diagram without a formula does not pay for it. It is an optional
// peer dependency: a project that never writes a formula does not install it.
import {must} from './must.ts';
import {createRequire} from 'node:module';
import {UNITS_PER_EM} from './math.ts';
import {xmlProblems} from './xml-check.ts';

export interface TexSvg {
  /** The drawing: path outlines in MathJax's units, y down, shifted so the formula's box starts at 0,0. */
  inner: string;
  /** The box, in em. */
  w: number;
  h: number;
}

/**
 * The TeX packages a formula may use: an allowlist. What is left out would put something in the picture that the diagram does not
 * control — `html` (\href \style \class \cssId: attributes written unescaped), `action` (needs a browser DOM), `unicode` (font attribute),
 * `color` / `colortbl` / `bbox` (a colour of its own that ignores the theme, the dark mode and spotlight: use math()'s `tone`),
 * `noerrors` / `noundefined` (a typo must throw, not show as red text), `tagformat` (equation numbers: put a caption beside the formula).
 */
const PACKAGES = ['base', 'ams', 'amscd', 'boldsymbol', 'braket', 'bussproofs', 'cancel', 'cases', 'centernot', 'empheq', 'enclose', 'extpfeil', 'gensymb', 'mathtools', 'mhchem', 'newcommand', 'verb', 'configmacros', 'textcomp', 'textmacros'];

// biome-ignore lint/suspicious/noExplicitAny: MathJax is loaded without its types; these are its untyped modules
type Mj = {mathjax: any; TeX: any; SVG: any; adaptor: any};
let mj: Mj | undefined;

function load(): Mj {
  const require = createRequire(import.meta.url);
  try {
    const {mathjax} = require('mathjax-full/js/mathjax.js');
    const {TeX} = require('mathjax-full/js/input/tex.js');
    const {SVG} = require('mathjax-full/js/output/svg.js');
    const {liteAdaptor} = require('mathjax-full/js/adaptors/liteAdaptor.js');
    const {RegisterHTMLHandler} = require('mathjax-full/js/handlers/html.js');
    require('mathjax-full/js/input/tex/AllPackages.js'); // registers every package, so the allowlist can name them
    const adaptor = liteAdaptor();
    RegisterHTMLHandler(adaptor);
    return {mathjax, TeX, SVG, adaptor};
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND' && /'mathjax-full\//.test((e as Error).message)) throw new Error('math(): needs the mathjax-full package — add it to the project (pnpm add mathjax-full)');
    throw e;
  }
}

/** One conversion in its own MathJax document: a \def / \let / \label in one formula must not reach the next one (or another diagram's). */
function convert(tex: string, display: boolean): string {
  const m = must(mj);
  const doc = m.mathjax.document('', {
    InputJax: new m.TeX({packages: PACKAGES, tags: 'none', formatError: (_: unknown, err: Error) => { throw err; }}),
    OutputJax: new m.SVG({fontCache: 'none'}),
  });
  return m.adaptor.outerHTML(doc.convert(tex, {display}));
}

/**
 * What MathJax's output may contain. The packages are one fence; base's own \mmlToken (any MathML attribute) goes round it, so the output is
 * the other: no link (<a>: \href, \ref, \eqref), no style / id, no colour of its own (a fill or stroke is `none` or the text colour).
 */
const ATTR_OK = /^(?:semantics|d|transform|x|y|width|height|x1|y1|x2|y2|cx|cy|r|rx|ry|points|viewBox|preserveAspectRatio|stroke-width|stroke-linecap|stroke-linejoin|stroke-miterlimit|stroke-dasharray|role|aria-hidden|focusable|xmlns|data-[\w-]+)$/;
/**
 * MathJax leaves some of a drawing to its stylesheet, which a diagram does not carry: an array rule's width and dash (class mjx-solid /
 * mjx-dashed / mjx-dotted), the frame's `fill: none`, and an enclose stroke written as `style="stroke-width: N;"`. Said as attributes here.
 */
const CSS_STROKE: Record<string, string> = {'mjx-solid': ' stroke-width="70"', 'mjx-dashed': ' stroke-width="70" stroke-dasharray="140"', 'mjx-dotted': ' stroke-width="70" stroke-linecap="round" stroke-dasharray="0,140"'};
function inlineCss(drawing: string): string {
  return drawing.replace(/<(\w+)\b([^>]*?)(\/?)>/g, (whole, tag: string, attrs: string, close: string) => {
    let a = attrs, extra = '';
    a = a.replace(/\sclass="\s*(mjx-solid|mjx-dashed|mjx-dotted)\s*"/, (_, c: string) => { extra += CSS_STROKE[c]; return ''; });
    a = a.replace(/\sstyle="stroke-width:\s*([\d.]+);?"/, (_, n: string) => { extra += ` stroke-width="${n}"`; return ''; });
    a = a.replace(/\sstroke-thickness="([\d.]+)"/, (_, n: string) => { a = a.replace(/\sstroke-width="[\d.]+"/, ''); extra += ` stroke-width="${n}"`; return ''; });
    if (/\sdata-frame="/.test(a) && !/\sfill=/.test(a)) extra += ' fill="none"';
    return a === attrs && !extra ? whole : `<${tag}${a}${extra}${close}>`;
  });
}

function foreign(drawing: string): string | undefined {
  if (/<a\b/.test(drawing)) return 'a link (\\href, \\ref, \\eqref)';
  for (const [, tag, attrs] of drawing.matchAll(/<(\w+)\b([^>]*)>/g)) {
    if (tag === undefined || attrs === undefined) continue;
    for (const [, name, value] of attrs.matchAll(/\s([\w:-]+)="([^"]*)"/g)) {
      if (name === undefined || value === undefined) continue;
      if (name === 'fill' || name === 'stroke') { if (value !== 'none' && value !== 'currentColor') return `a colour of its own (${name}="${value}"): use math()'s tone`; } else if (name === 'class') { if (value.trim() !== 'MathML-Unit') return `a class on <${tag}>`; } else if (!ATTR_OK.test(name)) return `the attribute ${name} on <${tag}> (\\style, \\mmlToken…)`;
    }
  }
  return undefined;
}

const NUM = '(-?[\\d.]+(?:e-?\\d+)?)';

/** The formula as outlines. Throws with MathJax's message when the TeX does not parse. */
export function texToSvg(tex: string, display: boolean): TexSvg {
  mj ??= load(); // outside the try: a missing package is not a mistake in the TeX
  let html: string;
  try { html = convert(tex, display); } catch (e) {
    throw new Error(`math(): cannot read the TeX "${tex}": ${(e as Error).message}`);
  }
  const vb = new RegExp(`<svg\\b[^>]*\\bviewBox="${NUM} ${NUM} ${NUM} ${NUM}"`).exec(html);
  const body = /<g\b[^>]*\btransform="scale\(1,-1\)"[^>]*>([\s\S]*)<\/g><\/svg>/.exec(html);
  if (!vb || !body) throw new Error(`math(): MathJax gave no drawing for "${tex}" (equation numbers — \\tag, \\label — are not supported: put a caption beside the formula)`);
  // characters outside MathJax's own font come out as <text>: a font of the viewer's, whose width is a guess — so they are refused
  const bodyHtml = body[1] ?? '';
  if (/<text\b/.test(bodyHtml)) throw new Error(`math(): "${tex}" has a character the formula font does not have (CJK, emoji…), which would be drawn as text in whatever font the viewer has — set that wording in a caption beside the formula`);
  const drawing = inlineCss(bodyHtml);
  const other = foreign(drawing);
  if (other) throw new Error(`math(): "${tex}" would put ${other} in the picture`);
  const [x = 0, y = 0, w = 0, h = 0] = vb.slice(1).map(Number);
  // the body is drawn y-up inside scale(1,-1); the viewBox is in the flipped (y-down) frame, so y is the box's top
  const inner = `<g transform="translate(${-x} ${-y}) scale(1 -1)">${drawing}</g>`;
  // MathJax writes some attribute values (a \href, a \unicode font) unescaped: whatever the packages let through must still load as XML
  const bad = xmlProblems(`<svg xmlns="http://www.w3.org/2000/svg">${inner}</svg>`);
  if (bad.length) throw new Error(`math(): "${tex}" would make the SVG invalid XML (${bad[0]})`);
  return {inner, w: w / UNITS_PER_EM, h: h / UNITS_PER_EM};
}
