#!/usr/bin/env node
// svg-diagram pptx-deck <deck.json> [--out FILE] [--png-scale N] [--font NAME]
// A deck (lib/deck-spec.ts, ADR 0055) as one PowerPoint file of 16:9 slides. A slide's `figure` is a JSON spec, or the path of a diagram
// source (.ts) or of a spec file (.json), relative to the deck file. Measured and drawn as `svg-diagram pptx` does (the project's fonts,
// resvg for the PNG fallbacks); ./lib/pptx-deck-edge.ts is the same writer for a Worker.
import fs from 'node:fs';
import path from 'node:path';
import {installResolveHook} from './lib/resolve-hook.ts';
import {applyConfig, loadConfig} from './lib/config.ts';
import {loadDiagram} from './lib/load-source.ts';
import {renderDiagram} from './lib/dsl/render.ts';
import {closeMeasurer, configureMeasure, measureAll, splitAtoms, textWidth} from './lib/measure.ts';
import {specToDiagram, SpecError} from './lib/spec.ts';
import {figurePath, validateDeck, type DeckSlide, type DeckSpec} from './lib/deck-spec.ts';
import {deckEntries, deckTexts, planDeckSlide, roomMessage, smallTextWarning, type DeckFigure, type TextWidth} from './lib/pptx/deck.ts';
import {planSlide, fontsOf} from './lib/pptx/slide.ts';
import {fontFilesOf, rasterize} from './lib/pptx/emit.ts';
import {zipStore} from './lib/pptx/zip-node.ts';
import {formatBuildError} from './lib/error-format.ts';
import type {Diagram, MeasureRequest} from './lib/types/core.ts';

installResolveHook();
const USAGE = 'Usage: svg-diagram pptx-deck <deck.json> [--out FILE] [--png-scale N] [--font NAME]';
const args = process.argv.slice(2), values = ['--out', '--png-scale', '--font'];
const usage = (message?: string): never => { console.error(message ? `✗ ${message}\n${USAGE}` : USAGE); process.exit(2); };
for (const [i, arg] of args.entries()) {
  if (arg.startsWith('--') && !values.includes(arg)) usage(`unknown option ${arg}`);
  if (values.includes(arg) && (args[i + 1] === undefined || args[i + 1]?.startsWith('--'))) usage(`${arg} needs a value`);
}
const value = (name: string): string | undefined => { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; };
const files = args.filter((arg, i) => !arg.startsWith('--') && !values.includes(args[i - 1] ?? ''));
if (files.length !== 1 || !files[0]?.endsWith('.json')) usage('pptx-deck takes one deck .json file');
const scaleText = value('--png-scale'), pngScale = scaleText === undefined ? 2 : Number(scaleText);
if (!(Number.isFinite(pngScale) && pngScale > 0)) usage(`--png-scale needs a positive number (got ${scaleText})`);
const font = value('--font');

const deckFile = path.resolve(files[0] as string), dir = path.dirname(deckFile);
const fail = (lines: string[]): never => { for (const l of lines) console.error(`✗ ${l}`); process.exit(1); };

try {
  let raw: unknown;
  try { raw = JSON.parse(fs.readFileSync(deckFile, 'utf8')); } catch (e) { fail([`${files[0]}: ${e instanceof Error ? e.message : String(e)}`]); }
  const slides = ((raw as {slides?: unknown} | null)?.slides);
  // a figure given as a path: a .json spec is read in place; a .ts source is drawn as it is. The deck is checked with a .ts figure left out
  // (and a stand-in heading where the slide has none, as a figure is enough), and drawn from the slides as written
  const sources = new Map<number, string>(), pathErrors: string[] = [];
  const resolved = Array.isArray(slides) ? {...(raw as object), slides: slides.map((s: unknown, i) => {
    const f = (s as DeckSlide | null)?.figure;
    if (typeof f !== 'string') return s;
    const abs = path.resolve(dir, f), {figure: _f, ...rest} = s as DeckSlide;
    if (f.endsWith('.ts')) { if (fs.existsSync(abs)) sources.set(i, abs); else pathErrors.push(`slides[${i}].figure: ${f} does not exist`); return rest; }
    if (f.endsWith('.json')) {
      try { return {...rest, figure: JSON.parse(fs.readFileSync(abs, 'utf8')) as unknown}; }
      catch (e) { pathErrors.push(`slides[${i}].figure: ${f}: ${e instanceof Error ? e.message : String(e)}`); return rest; }
    }
    pathErrors.push(`slides[${i}].figure: a path must name a diagram source (.ts) or a spec file (.json); otherwise write the spec itself`);
    return rest;
  })} : raw;
  if (pathErrors.length) fail(pathErrors);
  const checked = Array.isArray((resolved as {slides?: unknown}).slides)
    ? {...(resolved as object), slides: (resolved as DeckSpec).slides.map((s, i) => sources.has(i) && s.title === undefined ? {...s, title: '-'} : s)} : resolved;
  const issues = validateDeck(checked);
  if (issues.length) fail(issues.map(x => `${x.path || '(deck)'}: ${x.message}`));
  const deck = resolved as DeckSpec;
  const cfg = loadConfig(dir);
  configureMeasure(cfg);
  const fonts = fontsOf(font), rasterFonts = fontFilesOf(cfg.fonts);
  const figures: (DeckFigure | undefined)[] = [], errors: string[] = [];
  for (const [i, s] of deck.slides.entries()) {
    const source = sources.get(i);
    if (s.figure === undefined && !source) { figures.push(undefined); continue; }
    try {
      const d: Diagram = source ? await loadDiagram(source, cfg) : applyConfig(specToDiagram(s.figure), cfg);
      const r = await renderDiagram(d, {name: `slide${i + 1}.svg`, budget: 'cacheOnly'});
      for (const warning of r.verdict.warnings) console.error(`⚠ ${figurePath(i, '')}: ${warning}`);
      figures.push({plan: planSlide(r.laidOut, fonts), w: Math.max(96, r.laidOut.width), h: Math.max(96, r.laidOut.canvasHeight)});
    } catch (e) {
      if (e instanceof SpecError) errors.push(...e.issues.map(x => `${figurePath(i, x.path)}: ${x.message}`));
      else errors.push(formatBuildError(source ?? figurePath(i, ''), e));
      figures.push(undefined);
    }
  }
  if (errors.length) fail(errors);
  // the slide's own text is measured as the figures are: in one batch, by atoms (lib/atoms.ts)
  const requests = new Map<string, MeasureRequest>();
  const key = (atom: string, size: number, weight: number) => `${size}|${weight}|${atom}`;
  for (const s of deck.slides) for (const t of deckTexts(s)) for (const atom of splitAtoms(t.text)) requests.set(key(atom, t.size, t.bold ? 700 : 400), {text: atom, size: t.size, weight: t.bold ? 700 : 400});
  const measured = await measureAll(requests);
  const widthOf = (atom: string, size: number, weight: number): number => measured.get(key(atom, size, weight))?.w ?? atom.length * size;
  const width: TextWidth = (text, size, bold) => textWidth(widthOf, text, size, bold ? 700 : 400);
  const planned = deck.slides.map(({figure: _f, ...s}, i) => { const f = figures[i]; return planDeckSlide(f ? {...s, figure: f} : s, fonts, width); });
  const noRoom = planned.flatMap((p, i) => p.noRoom ? [`slides[${i}]: ${roomMessage(figures[i] !== undefined)}`] : []);
  if (noRoom.length) fail(noRoom);
  planned.forEach((p, i) => {
    const w = smallTextWarning(p);
    if (w) console.error(`⚠ ${figurePath(i, '')}: ${w}`);
  });
  const pngs = planned.map(p => p.pictures.map(pic => rasterize(pic.pngSvg, rasterFonts, pngScale)));
  const out = value('--out') ?? path.join(dir, path.basename(deckFile, '.json') + '.pptx');
  fs.mkdirSync(path.dirname(path.resolve(out)), {recursive: true});
  fs.writeFileSync(out, zipStore(deckEntries(planned, pngs, deck.title)));
  console.log(`wrote ${out} (${planned.length} slides)`);
} finally { await closeMeasurer(); }
